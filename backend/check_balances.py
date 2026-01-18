import os
import json
from web3 import Web3
from dotenv import load_dotenv

# 1. Setup & Environment
load_dotenv()
w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))

CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")

# 2. LOAD ABI FROM FILE (Fixes the NameError)
try:
    with open("abi.json", "r") as f:
        artifact = json.load(f)
        # Handles both raw ABI arrays and Hardhat artifact formats
        contract_abi = artifact["abi"] if isinstance(artifact, dict) and "abi" in artifact else artifact
except Exception as e:
    print(f"❌ Error loading ABI: {e}")
    exit()

# 3. Initialize Contract
contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=contract_abi)

# 4. PASTE YOUR HARDHAT WALLET ADDRESSES HERE
TESLA_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"  # Replace with Tesla wallet
TWITCH_WALLET = "0x71bE63f3384f5fb98995898A86B02Fb2426c5788" # Replace with Twitch wallet

def check():
    print("🔍 Fetching On-Chain Balances...\n")
    try:
        tesla_bal = contract.functions.balanceOf(TESLA_WALLET).call()
        twitch_bal = contract.functions.balanceOf(TWITCH_WALLET).call()
        
        # Check if contract itself holds tokens (Escrow)
        escrow_bal = contract.functions.balanceOf(CONTRACT_ADDRESS).call()

        print(f"🏎️ Tesla:  {tesla_bal} CCT")
        print(f"🎮 Twitch: {twitch_bal} CCT")
        print(f"🏦 Escrow: {escrow_bal} CCT")
        
        print("\n✅ Audit Complete.")
    except Exception as e:
        print(f"❌ Error during audit: {e}")

if __name__ == "__main__":
    check()