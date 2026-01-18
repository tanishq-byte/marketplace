import requests
import time

# Configuration
BASE_URL = "http://localhost:8000"
COMPANY_NAME = "TWITCH"

def run_debt_clearance_test():
    print(f"🔍 Checking Debt Status for {COMPANY_NAME}...")

    # 1. First, check the current status from the Leaderboard/API
    res = requests.get(f"{BASE_URL}/api/companies/{COMPANY_NAME}")
    if res.status_code != 200:
        print("❌ Company not found!")
        return
    
    data = res.json()
    status = data.get("status")
    required_burn = data.get("required_burn", 0)
    current_balance = data.get("current_balance", 0)
    
    print(f"📊 Current Status: {status}")
    print(f"⚖️  Tokens Required: {required_burn}")
    print(f"💰 On-Chain Balance: {current_balance}")

    if "DEFICIT" not in data.get("burn_status", "") and status != "pending_settlement":
        print("✅ No debt detected. Company is already compliant.")
        return

    # 2. Trigger the Finalize Settlement
    # This mimics the "Clear Debt" button on your React Dashboard
    print(f"\n🚀 Triggering 'Finalize Settlement' for {COMPANY_NAME}...")
    
    # Using the same endpoint as Phase 2 but designed to re-check the balance
    # NOTE: If you created a specific /finalize-settlement route, use that URL here.
    # Otherwise, we re-submit the audit to trigger the burn logic now that balance is high.
    
    # For this test, we assume you are re-triggering the settlement check
    url = f"{BASE_URL}/phase2-settlement/{COMPANY_NAME}"
    
    # We re-upload the audit to "Re-try" the burn
    try:
        with open("twitch_audit.pdf", "rb") as f:
            files = {"file": f}
            response = requests.post(url, files=files)
        
        result = response.json()
        
        if result.get("burn_status") == "BURNED":
            print("\n🎊 SUCCESS! tokens burned successfully.")
            print(f"🔗 TX Hash: {result.get('blockchain_tx')}")
            print("📈 TWITCH status updated to 'audited' in MongoDB.")
        elif "DEFICIT" in result.get("burn_status", ""):
            print(f"\n🛑 STILL IN DEFICIT: Need {result.get('required_burn') - result.get('current_balance')} more CCT.")
        else:
            print(f"\n⚠️ Status: {result.get('burn_status')}")
            print(f"Message: {result.get('message')}")

    except Exception as e:
        print(f"💥 Error: {e}")

if __name__ == "__main__":
    run_debt_clearance_test()