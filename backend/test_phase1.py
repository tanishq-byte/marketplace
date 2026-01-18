import requests
import os

# Configuration
BASE_URL = "http://localhost:8000"
TEST_FILE = "test_registration.pdf"

def test_registration_and_minting():
    print("🚀 Starting Phase 1 Test: Company Registration & Minting...")
    
    # 1. Verify the test file exists
    if not os.path.exists(TEST_FILE):
        print(f"❌ ERROR: File '{TEST_FILE}' not found. Please create a dummy PDF.")
        return

    # 2. Define the payload
    company_name = "TWITCH"
    wallet_address = "0x7961aa79d0242b5eE83144B6a175261A719472a6"
    url = f"{BASE_URL}/phase1-minting/{company_name}"
    params = {"wallet_address": wallet_address}

    try:
        # 3. Send the POST request with the PDF file
        with open(TEST_FILE, "rb") as f:
            files = {"file": f}
            print(f"📡 Sending request to {url}...")
            response = requests.post(url, params=params, files=files, timeout=30)
        
        # 4. Handle the response
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"🏢 Company: {result.get('company')}")
            print(f"🌿 Credits Allocated: {result.get('tons_allocated')} CCT")
            print(f"🔗 Blockchain TX: {result.get('blockchain_tx')}")
        else:
            print(f"❌ FAILED: {response.text}")
            
    except Exception as e:
        print(f"💥 CONNECTION ERROR: Ensure uvicorn is running! \nDetails: {e}")

if __name__ == "__main__":
    test_registration_and_minting()