import requests
import os

# Configuration
BASE_URL = "http://localhost:8000"
AUDIT_FILE = "twitch_audit.pdf"
COMPANY_NAME = "TWITCH"

def run_phase2_test():
    print(f"🚀 Starting Phase 2 Test: Audit & Settlement for {COMPANY_NAME}...")
    
    # 1. Check if the dummy PDF exists
    if not os.path.exists(AUDIT_FILE):
        print(f"❌ ERROR: {AUDIT_FILE} not found! Ensure the file exists in the backend folder.")
        return

    # 2. Prepare the endpoint URL
    url = f"{BASE_URL}/phase2-settlement/{COMPANY_NAME}"

    try:
        # 3. Send the Audit PDF
        print(f"📡 Uploading {AUDIT_FILE} to backend...")
        with open(AUDIT_FILE, "rb") as f:
            files = {"file": f}
            response = requests.post(url, files=files, timeout=30)
        
        # 4. Parse JSON Response
        result = response.json()
        
        if response.status_code == 200:
            # Handle the case where the backend caught a Blockchain Revert (Insufficient Funds)
            if result.get("status") == "ERROR":
                print(f"\n🛑 SETTLEMENT BLOCKED BY BLOCKCHAIN")
                print(f"❌ Reason: {result.get('message')}")
                
                if "Insufficient credits" in str(result.get('message')):
                    print(f"\n💡 ANALYSIS:")
                    print(f"   TWITCH tried to burn tokens including the 1.5x penalty,")
                    print(f"   but their wallet balance is too low.")
                    print(f"   NEXT STEP: Use the Marketplace to buy credits.")
                return

            # Handle Successful Settlement
            print("\n✅ SETTLEMENT PROCESS COMPLETE")
            print(f"🏢 Company: {COMPANY_NAME}")
            
            surplus = result.get('net_surplus')
            
            # Safety check to ensure surplus is a number before comparing
            if surplus is not None:
                if surplus < 0:
                    print(f"⚠️  PENALTY APPLIED: Deficit of {abs(surplus)} tons.")
                else:
                    print(f"🌿 COMPLIANT: Surplus of {surplus} tons.")

            print(f"🔗 Settlement TX: {result.get('blockchain_tx')}")
            
        else:
            print(f"❌ SERVER ERROR: {response.status_code} - {response.text}")

    except Exception as e:
        print(f"💥 Test Script Error: {e}")

if __name__ == "__main__":
    run_phase2_test()