import requests
import os

# Configuration
BASE_URL = "http://localhost:8000"

# 1. PASTE YOUR HARDHAT WALLET ADDRESSES HERE
TESLA_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"  # Replace with Hardhat Account #1
TWITCH_WALLET = "0x71bE63f3384f5fb98995898A86B02Fb2426c5788" # Replace with Hardhat Account #2

# 2. DEFINE THE PROJECT DATA
companies_to_mint = [
    {
        "name": "TESLA",
        "wallet": TESLA_WALLET,
        "file": "test_report.pdf", # Ensure this file exists in your folder
        "description": "Primary seller of carbon credits"
    },
    {
        "name": "TWITCH",
        "wallet": TWITCH_WALLET,
        "file": "test2.pdf",       # Ensure this file exists in your folder
        "description": "Company requiring credits for compliance"
    }
]

def run_mass_minting():
    print("🚀 Initializing Multi-Company Minting & DB Registration...")
    
    for data in companies_to_mint:
        print(f"\n--- Processing {data['name']} ---")
        
        # Check if file exists to prevent local errors
        if not os.path.exists(data['file']):
            print(f"❌ Error: File {data['file']} not found. Skipping...")
            continue

        try:
            # We call your Phase 1 endpoint which triggers your mint_carbon_credits function
            with open(data['file'], "rb") as f:
                files = {"file": f}
                # Passing the wallet address as a query parameter
                response = requests.post(
                    f"{BASE_URL}/phase1-minting/{data['name']}?wallet_address={data['wallet']}", 
                    files=files
                )
            
            result = response.json()
            
            if result.get("status") == "SUCCESS":
                print(f"✅ Success for {data['name']}!")
                print(f"💰 Tons Allocated: {result.get('tons_allocated')}")
                print(f"🔗 TX Hash: {result.get('blockchain_tx')}")
                print(f"📂 MongoDB: Wallet {data['wallet']} saved.")
            else:
                print(f"⚠️ API Error: {result.get('message')}")
                
        except Exception as e:
            print(f"💥 Connection Error: {e}")

if __name__ == "__main__":
    run_mass_minting()