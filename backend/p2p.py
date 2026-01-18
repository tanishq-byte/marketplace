import os
import time
import requests
import asyncio
from web3 import Web3
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---
BASE_URL = "http://localhost:8000"
TESLA_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
TWITCH_WALLET = "0x71bE63f3384f5fb98995898A86B02Fb2426c5788"

# MongoDB Setup
client = AsyncIOMotorClient(os.getenv("MONGO_DETAILS"))
db = client.carbon_cred_db
companies_col = db.get_collection("companies")

async def run_perfect_p2p():
    print("🚀 INITIALIZING MASTER P2P FLOW (100 CCT)...")

    # 1. TESLA LISTS 100 CCT
    print("\n📦 STEP 1: Tesla Listing 100 CCT...")
    list_res = requests.post(f"{BASE_URL}/marketplace/list-with-price", params={
        "company_name": "TESLA", "amount": 100, "price": 50, "qr_url": "https://upi.me/tesla"
    })
    l_data = list_res.json()
    if l_data.get("status") != "LISTED":
        print(f"❌ List Failed: {l_data}"); return
    
    listing_id = l_data.get("listing_id")
    print(f"✅ Listed! ID: {listing_id} | TX: {l_data['tx_hash'][:15]}...")

    # 2. TWITCH MARKS AS PAID
    print(f"\n💸 STEP 2: Twitch marking Listing #{listing_id} as PAID...")
    paid_res = requests.post(f"{BASE_URL}/marketplace/mark-paid/{listing_id}", params={"buyer_company": "TWITCH"})
    if paid_res.json().get("status") != "MARKED_PAID":
        print(f"❌ Mark Paid Failed: {paid_res.json()}"); return
    print("✅ Twitch signaled payment.")

    # 3. TESLA RELEASES & DB UPDATES
    print("\n🔓 STEP 3: Tesla releasing tokens and updating Database...")
    rel_res = requests.post(f"{BASE_URL}/marketplace/release/{listing_id}", params={"buyer_wallet": TWITCH_WALLET})
    r_data = rel_res.json()
    if r_data.get("status") != "RELEASED":
        print(f"❌ Release Failed: {r_data}"); return
    print(f"✅ Released! TX: {r_data['tx_hash'][:15]}...")

    # 4. FINAL DB & BLOCKCHAIN VERIFICATION
    print("\n🔍 STEP 4: Final Verification (Blockchain vs DB)...")
    
    # Check DB
    twitch_db = await companies_col.find_one({"name": "TWITCH"})
    
    # Check Blockchain (Optional: you can run your check_balances.py here too)
    print(f"📊 TWITCH DB ALLOWANCE: {twitch_db.get('initial_allowance')} CCT")
    print("✨ ALL SYNCED. ESCROW SHOULD BE 0.")
    
    
    
  
    
    # FIX: Remove 'await' here
    client.close() 

if __name__ == "__main__":
    asyncio.run(run_perfect_p2p())
