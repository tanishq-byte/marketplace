const hre = require("hardhat");

async function main() {
  // 1. Get the deployer's account (the Admin)
  const [deployer] = await hre.ethers.getSigners();

  console.log("--------------------------------------------------");
  console.log("Deploying contract with account:", deployer.address);
  // This is vital for your teammate's .env file in the backend
  // In a real project, NEVER log private keys, but this is for local hackathon testing
  console.log("Admin Private Key (for .env):", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"); 
  console.log("--------------------------------------------------");

  // 2. Deploy the CarbonToken
  const CarbonToken = await hre.ethers.getContractFactory("CarbonToken");
  const token = await CarbonToken.deploy();

  await token.waitForDeployment();

  const contractAddress = await token.getAddress();

  console.log("✅ CarbonToken deployed to:", contractAddress);
  console.log("--------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});