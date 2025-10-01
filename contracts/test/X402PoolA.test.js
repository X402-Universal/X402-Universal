import { expect } from "chai";
import hre from "hardhat";

describe("X402PoolA", function () {
  const toBytes32 = (addr) => `0x${"0".repeat(24)}${addr.toLowerCase().replace(/^0x/, "")}`;

  async function deployFixture() {
    const { ethers } = hre;
    const [owner, payer, provider, other] = await ethers.getSigners();

    const MockTokenGateway = await ethers.getContractFactory("MockTokenGateway", owner);
    const gateway = await MockTokenGateway.deploy();
    await gateway.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20", owner);
    const token = await MockERC20.deploy("Mock USD", "mUSD", 6);
    await token.waitForDeployment();

    // Create a mock USD.h token for testing
    const MockUSDh = await ethers.getContractFactory("MockERC20", owner);
    const usdh = await MockUSDh.deploy("USD.h", "USDh", 18);
    await usdh.waitForDeployment();

    const X402PoolA = await ethers.getContractFactory("X402PoolA", owner);
    const pool = await X402PoolA.deploy(await gateway.getAddress(), await usdh.getAddress(), owner.address);
    await pool.waitForDeployment();

    return { owner, payer, provider, other, gateway, token, usdh, pool, ethers };
  }

  it("sets and emits route", async function () {
    const { owner, token, pool, ethers } = await deployFixture();
    const providerId = ethers.keccak256(ethers.toUtf8Bytes("provider-1"));
    const assetId = ethers.keccak256(ethers.toUtf8Bytes("USD.h"));
    console.log("assetId", assetId);
    const dest = "0x1234";
    const recipient = ethers.Wallet.createRandom().address;

    await expect(pool.connect(owner).setRoute(await token.getAddress(), providerId, assetId, dest, recipient))
      .to.emit(pool, "RouteSet")
      .withArgs(await token.getAddress(), providerId, assetId, dest, recipient);
  });

  it("posts payment: transfers tokens and increments credits", async function () {
    const { owner, payer, token, pool, ethers } = await deployFixture();
    const providerId = ethers.keccak256(ethers.toUtf8Bytes("provider-1"));

    const amount = 1_000_000n;
    await token.connect(owner).mint(payer.address, amount);
    await token.connect(payer).approve(await pool.getAddress(), amount);

    await expect(pool.connect(payer).postPayment(await token.getAddress(), amount, providerId))
      .to.emit(pool, "PaymentPosted")
      .withArgs(payer.address, await token.getAddress(), amount, providerId);

    const credits = await pool.credits(await token.getAddress(), providerId);
    expect(credits).to.equal(amount);
  });

  it("bulkTeleport moves credits, approves gateway and calls teleport", async function () {
    const { owner, payer, token, pool, gateway, usdh } = await deployFixture();

    const providerId = ethers.keccak256(ethers.toUtf8Bytes("provider-1"));
    const assetId = ethers.keccak256(ethers.toUtf8Bytes("asset-USDh"));
    const dest = "0x99";
    const recipient = ethers.Wallet.createRandom().address;

    await pool.connect(owner).setRoute(await token.getAddress(), providerId, assetId, dest, recipient);

    const amount = 2_500_000n;
    await token.connect(owner).mint(payer.address, amount);
    await token.connect(payer).approve(await pool.getAddress(), amount);
    await pool.connect(payer).postPayment(await token.getAddress(), amount, providerId);

    const before = await pool.credits(await token.getAddress(), providerId);
    expect(before).to.equal(amount);

    await expect(pool.connect(owner).bulkTeleport(await token.getAddress(), providerId, amount, 1200))
      .to.emit(pool, "BulkTeleported");

    const after = await pool.credits(await token.getAddress(), providerId);
    expect(after).to.equal(0);

    const allowance = await usdh.allowance(await pool.getAddress(), await gateway.getAddress());
    expect(allowance).to.be.greaterThanOrEqual(await pool.usdcToUSDh(amount));

    const totalTeleported = await gateway.getTotalTeleported(assetId);
    const converted = await pool.usdcToUSDh(amount);
    expect(totalTeleported).to.equal(converted);
  });

  it("reverts bulkTeleport when credits insufficient or route missing", async function () {
    const { owner, payer, token, pool, ethers } = await deployFixture();
    const providerId = ethers.keccak256(ethers.toUtf8Bytes("prov"));

    // Fund credits first so we hit the "route not set" require
    await token.connect(owner).mint(payer.address, 5n);
    await token.connect(payer).approve(await pool.getAddress(), 5n);
    await pool.connect(payer).postPayment(await token.getAddress(), 5n, providerId);
    await expect(
      pool.connect(owner).bulkTeleport(await token.getAddress(), providerId, 5n, 60)
    ).to.be.revertedWith("route not set");

    // Now set route and request more than available credits to trigger insufficient credits
    const assetId = ethers.keccak256(ethers.toUtf8Bytes("asset"));
    const dest = "0x12";
    const recipient = ethers.Wallet.createRandom().address;
    await pool.connect(owner).setRoute(await token.getAddress(), providerId, assetId, dest, recipient);
    await expect(
      pool.connect(owner).bulkTeleport(await token.getAddress(), providerId, 6n, 60)
    ).to.be.revertedWith("insufficient credits");

    // Zero amount on postPayment still reverts
    await expect(pool.connect(payer).postPayment(await token.getAddress(), 0n, providerId)).to.be.revertedWith("zero amount");
  });

  it("evmAddressToBytes32 matches expected packing", async function () {
    const { pool, ethers } = await deployFixture();
    const rnd = ethers.Wallet.createRandom().address;
    const got = await pool.evmAddressToBytes32(rnd);
    expect(ethers.hexlify(got)).to.equal(toBytes32(rnd));
  });

  it("bulkTeleport works when credits are prefilled via storage", async function () {
    const { owner, token, pool, gateway, ethers } = await deployFixture();

    const tokenAddr = await token.getAddress();
    const poolAddr = await pool.getAddress();
    const providerId = ethers.keccak256(ethers.toUtf8Bytes("prefill-provider"));

    // Compute storage slot for credits[token][providerId]
    // Note: Ownable's storage occupies slot 0. 'credits' is next => slot 1
    const slot0 = 1n;
    const abi = ethers.AbiCoder.defaultAbiCoder();
    const outer = ethers.keccak256(
      abi.encode(["address", "uint256"], [tokenAddr, slot0])
    );
    const finalSlot = ethers.keccak256(
      abi.encode(["bytes32", "bytes32"], [providerId, outer])
    );

    // Prefill value
    const amount = 1_000_000n;
    const padded = ethers.zeroPadValue(ethers.toBeHex(amount), 32);
    await ethers.provider.send("hardhat_setStorageAt", [poolAddr, finalSlot, padded]);

    // Verify credits reading
    const preCredits = await pool.credits(tokenAddr, providerId);
    expect(preCredits).to.equal(amount);

    // Set route
    const assetId = ethers.keccak256(ethers.toUtf8Bytes("USD.h"));
    const dest = "0x8888";
    const recipient = ethers.Wallet.createRandom().address;
    await pool.connect(owner).setRoute(tokenAddr, providerId, assetId, dest, recipient);

    // Execute bulkTeleport
    await expect(pool.connect(owner).bulkTeleport(tokenAddr, providerId, amount, 600))
      .to.emit(pool, "BulkTeleported")
      .withArgs(tokenAddr, providerId, amount, recipient, dest);

    // Credits should be zero, gateway counter should reflect amount (converted)
    const afterCredits = await pool.credits(tokenAddr, providerId);
    expect(afterCredits).to.equal(0);
    const totalTeleported = await gateway.getTotalTeleported(assetId);
    const converted = await pool.usdcToUSDh(amount);
    expect(totalTeleported).to.equal(converted);
  });

  it("setCredits: owner can set credits", async function () {
    const { owner, token, pool, ethers } = await deployFixture();
    const tokenAddr = await token.getAddress();
    const providerId = ethers.keccak256(ethers.toUtf8Bytes("owner-set"));

    await pool.connect(owner).setCredits(tokenAddr, providerId, 12345n);
    const got = await pool.credits(tokenAddr, providerId);
    expect(got).to.equal(12345n);
  });

  it("setCredits: non-owner reverts", async function () {
    const { payer, token, pool, ethers } = await deployFixture();
    const tokenAddr = await token.getAddress();
    const providerId = ethers.keccak256(ethers.toUtf8Bytes("not-owner"));

    await expect(
      pool.connect(payer).setCredits(tokenAddr, providerId, 1n)
    ).to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");
  });

  it("setCredits + route => teleport works", async function () {
    const { owner, token, pool, gateway, ethers } = await deployFixture();
    const tokenAddr = await token.getAddress();
    const providerId = ethers.keccak256(ethers.toUtf8Bytes("direct-set"));
    const amount = 777n;

    // Owner sets credits directly
    await pool.connect(owner).setCredits(tokenAddr, providerId, amount);

    // Route
    const assetId = ethers.keccak256(ethers.toUtf8Bytes("USD.h"));
    const dest = "0x7777";
    const recipient = ethers.Wallet.createRandom().address;
    await pool.connect(owner).setRoute(tokenAddr, providerId, assetId, dest, recipient);

    // Approve via bulkTeleport path will auto-approve max if needed
    await expect(pool.connect(owner).bulkTeleport(tokenAddr, providerId, amount, 300))
      .to.emit(pool, "BulkTeleported")
      .withArgs(tokenAddr, providerId, amount, recipient, dest);

    const creditsLeft = await pool.credits(tokenAddr, providerId);
    expect(creditsLeft).to.equal(0);
    const converted = await pool.usdcToUSDh(amount);
    expect(await gateway.getTotalTeleported(assetId)).to.equal(converted);
  });

  it("decimal utils: scaleAmount handles 6->18 and 18->6", async function () {
    const { pool, ethers } = await deployFixture();

    // 1 USDC => 1e18 USDh
    expect(await pool.usdcToUSDh(1_000_000n)).to.equal(1_000_000_000_000_000_000n);
    // 1.5 USDC => 1.5e18 USDh
    expect(await pool.usdcToUSDh(1_500_000n)).to.equal(1_500_000_000_000_000_000n);

    // 1e18 USDh => 1 USDC
    expect(await pool.usdhToUSDC(1_000_000_000_000_000_000n)).to.equal(1_000_000n);
    // 1.5e18 USDh => 1.5 USDC (floors not needed here as divisible)
    expect(await pool.usdhToUSDC(1_500_000_000_000_000_000n)).to.equal(1_500_000n);

    // Rounding down case: 1 wei short of 1e18 => floors to 0.999999 USDC => 999,999
    expect(await pool.usdhToUSDC(999_999_999_999_999_999n)).to.equal(999_999n);
  });
});

