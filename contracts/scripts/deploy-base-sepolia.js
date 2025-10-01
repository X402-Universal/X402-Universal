const hre = require("hardhat");

async function main() {
  console.log("Deploying PaymentRouter to Base Sepolia...");

  // Get the contract factory
  const PaymentRouter = await hre.ethers.getContractFactory("PaymentRouter");

  // Deploy the contract
  const paymentRouter = await PaymentRouter.deploy();

  // Wait for deployment to complete
  await paymentRouter.waitForDeployment();

  const address = await paymentRouter.getAddress();
  console.log("PaymentRouter deployed to:", address);
  console.log("Network: Base Sepolia (Chain ID: 84532)");

  // Wait for a few block confirmations before verifying
  console.log("Waiting for block confirmations...");
  await paymentRouter.deploymentTransaction().wait(5);

  // Verify the contract on Basescan if API key is available
  if (process.env.BASESCAN_API_KEY) {
    console.log("Verifying contract on Basescan...");
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [],
      });
      console.log("Contract verified on Basescan!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log("Network: Base Sepolia");
  console.log("Chain ID: 84532");
  console.log("Contract Address:", address);
  console.log("Block Explorer: https://sepolia.basescan.org/address/" + address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });