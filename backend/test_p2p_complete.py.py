import requests
import os

# Configuration
BASE_URL = "http://localhost:8000"
TEST_FILE = "test_report.pdf"

def run_test():
    print("🚀 Starting Backend Integration Test...")
    
    # Check if test file exists
    if not os.path.exists(TEST_FILE):
        print(f"❌ ERROR: {TEST_FILE} not found. Create a dummy PDF first.")
        return

    # Phase 1: Registration
    print("\n[1/3] Testing Phase 1: Registration & Minting...")
    try:
        url = f"{BASE_URL}/phase1-minting/TWITCH"
        params = {"wallet_address": "0x71bE63f3384f5fb98995898A86B02Fb2426c5788"}
        with open(TEST_FILE, "rb") as f:
            files = {"file": f}
            response = requests.post(url, params=params, files=files, timeout=30)
        
        print(f"📡 Status Code: {response.status_code}")
        if response.status_code == 200:
            print(f"✅ SUCCESS: {response.json()}")
        else:
            print(f"❌ FAILED: {response.text}")
    except Exception as e:
        print(f"💥 CONNECTION ERROR: Is uvicorn running? {e}")

    # Phase 2: Settlement
    print("\n[2/3] Testing Phase 2: Audit & Settlement...")
    try:
        url = f"{BASE_URL}/phase2-settlement/TWITCH"
        with open(TEST_FILE, "rb") as f:
            files = {"file": f}
            response = requests.post(url, files=files, timeout=30)
        
        print(f"📡 Status Code: {response.status_code}")
        if response.status_code == 200:
            print(f"✅ SUCCESS: {response.json()}")
        else:
            print(f"❌ FAILED: {response.text}")
    except Exception as e:
        print(f"💥 CONNECTION ERROR: {e}")

if __name__ == "__main__":
    run_test()