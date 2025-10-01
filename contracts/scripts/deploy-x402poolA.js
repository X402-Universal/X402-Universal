/*
  Deploy X402PoolA to a target network.

  Env (.env):
    BASE_SEPOLIA_RPC_URL=...
    PRIVATE_KEY=0x...
    OWNER=0x...          # optional, defaults to deployer
    TOKEN_GATEWAY=0x...  # optional, overrides network default

  Examples:
    npx hardhat run scripts/deploy-x402poolA.js --network baseSepolia
*/

require("dotenv/config");
const hre = require("hardhat");

const DEFAULT_GATEWAYS = {
  baseSepolia: "0xFcDa26cA021d5535C3059547390E6cCd8De7acA6",
};

async function main() {
  const networkName = hre.network.name;
  const TOKEN_GATEWAY =
    process.env.TOKEN_GATEWAY || DEFAULT_GATEWAYS[networkName];
  if (!TOKEN_GATEWAY) {
    throw new Error(
      `TokenGateway not set for network ${networkName}. Set TOKEN_GATEWAY in .env or add a default.`
    );
  }

  const OWNER = process.env.OWNER; // optional; defaults to deployer

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);
  console.log("TokenGateway:", TOKEN_GATEWAY);
  if (OWNER) console.log("Owner (override):", OWNER);

  const ownerToUse = OWNER ?? deployer.address;

  const X402PoolA = await hre.ethers.getContractFactory("X402PoolA", deployer);
  const pool = await X402PoolA.deploy(TOKEN_GATEWAY, ownerToUse);
  await pool.waitForDeployment();

  const address = await pool.getAddress();
  console.log("X402PoolA deployed at:", address);

  // Emit useful constructor args for verification tools
  console.log("Constructor args:", [TOKEN_GATEWAY, ownerToUse]);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

