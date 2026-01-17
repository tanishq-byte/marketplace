const hre = require("hardhat");
async function main() {
  const contractAddr = "0x8b38F7d3da2c4A3eDA5c7d5873B4236ca916d0b0";
  const [owner] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt("CarbonToken", contractAddr);

  console.log("Minting 500 CCT to your wallet...");
  const tx = await contract.mintCredits(owner.address, 500);
  await tx.wait();
  console.log("Success! Your balance is now 500 CCT.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });