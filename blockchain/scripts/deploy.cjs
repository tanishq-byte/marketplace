const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. Get the factory for the single combined contract
  // Your .sol file only defines 'contract CarbonToken'
  const CarbonToken = await hre.ethers.getContractFactory("CarbonToken");

  console.log("Deploying CarbonToken (Combined Token & Marketplace)...");
  
  // 2. Deploy the contract
  const token = await CarbonToken.deploy();
  await token.waitForDeployment();
  
  const contractAddress = await token.getAddress();

  console.log("\n--- DEPLOYMENT SUCCESS ---");
  console.log("Contract Address:", contractAddress);
  console.log("Network:", hre.network.name);
  console.log("\nNote: Use this SINGLE address for both Token and Marketplace functions in your frontend.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});