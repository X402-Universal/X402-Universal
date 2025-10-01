/* Print the mock data for X402PoolA interactions (no deployments). */
const hre = require("hardhat");

async function main() {
  const { ethers } = hre;

  // Inputs you provided
  const USDC = process.env.USDC || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";  // base sepolia usdc address
  const providerLabel = "provider1";
  const assetId = "0x829f01563df2ff9752a529f62c33a4b03b805da1e1dfc748127d6d37795d7257"; // USD.h
  const destChainLabel = "EVM-11155111"; // ETH Sepolia
  const recipient = "0x0D7587f2DAea482586388d4903972FC0870769fd";

  // Derived values
  const providerId = ethers.keccak256(ethers.toUtf8Bytes(providerLabel));
  const amountUSDC = ethers.parseUnits("10", 6); // 10 USDC -> 10,000,000
  const destChainBytes = ethers.toUtf8Bytes(destChainLabel);
  const destChainHex = ethers.hexlify(destChainBytes);

  // Optional extras (handy for verifying expectations)
  const amountUSDh = ethers.parseUnits("10", 18); // usdcToUSDh(10 USDC) = 10e18
  const recipientBytes32 = ethers.zeroPadValue(recipient, 32); // evmAddressToBytes32

  console.log("=== setCredits args ===");
  console.log("token        :", USDC);
  console.log("providerId   :", providerId);
  console.log("amount (6dp) :", amountUSDC.toString(), "(= 10 USDC)");

  console.log("\n=== setRoute args ===");
  console.log("token        :", USDC);
  console.log("providerId   :", providerId);
  console.log("assetId      :", assetId, "(USD.h)");
  console.log("destChain    :", destChainHex, `("${destChainLabel}" as bytes)`);
  console.log("recipient    :", recipient);

  console.log("\n=== useful extras (not passed to setRoute) ===");
  console.log("USDh amount (18dp, for teleport):", amountUSDh.toString());
  console.log("recipient as bytes32            :", recipientBytes32);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});