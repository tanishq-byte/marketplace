require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Debugging check: Run 'npx hardhat compile' to see if these load
if (!process.env.ALCHEMY_API_URL) console.warn("Warning: ALCHEMY_API_URL not found in .env");
if (!process.env.PRIVATE_KEY) console.warn("Warning: PRIVATE_KEY not found in .env");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1, 
      },
      evmVersion: "paris", // Forces compatibility with Sepolia
    },
  },
  networks: {
    sepolia: {
      url: process.env.ALCHEMY_API_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    }
  }
};