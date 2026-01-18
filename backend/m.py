import requests
import time

# 1. SETUP
BASE_URL = "http://localhost:8000"
LISTING_ID = 1  # Change to your active listing ID
BUYER_COMPANY = "TWITCH"
BUYER_WALLET = "0x71bE63f3384f5fb98995898A86B02Fb2426c5788" # Paste Twitch's actual wallet address here

def mark_and_release():
    print(f"🔄 Starting combined Mark & Release for Listing #{LISTING_ID}...")

    # STEP A: Mark as Paid
    # This signals the contract that the off-chain transfer is done
    print(f"📡 Step 1: {BUYER_COMPANY} marking as PAID...")
    res_paid = requests.post(
        f"{BASE_URL}/marketplace/mark-paid/{LISTING_ID}", 
        params={"buyer_company": BUYER_COMPANY}
    )
    
    if res_paid.json().get("status") != "MARKED_PAID":
        print(f"❌ Mark Paid failed: {res_paid.json()}")
        return

    print("✅ Payment signaled. Waiting 2 seconds for block confirmation...")
    time.sleep(2)

    # STEP B: Release Tokens
    # This triggers the on-chain transfer AND the MongoDB update
    print(f"📡 Step 2: Seller releasing tokens to {BUYER_WALLET}...")
    res_release = requests.post(
        f"{BASE_URL}/marketplace/release/{LISTING_ID}", 
        params={"buyer_wallet": BUYER_WALLET}
    )
    
    data = res_release.json()
    if data.get("status") == "RELEASED":
        print("\n✨ SUCCESS: Tokens released and Database updated!")
        print(f"🔗 TX Hash: {data.get('tx_hash')}")
        print(f"📊 New Twitch Allowance in DB: {data.get('new_allowance', 'Check MongoDB')}")
    else:
        print(f"❌ Release failed: {data.get('message')}")

if __name__ == "__main__":
    mark_and_release()