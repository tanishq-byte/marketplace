import os
import json
import shutil
from datetime import datetime
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from web3 import Web3
import os
from dotenv import load_dotenv
from web3 import Web3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 1. Initialize the app FIRST
app = FastAPI()

# 2. THEN add the middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load variables from .env
load_dotenv()

# Global variables
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")

# Quick debug print to verify key loading on startup
if not PRIVATE_KEY:
    print("❌ ERROR: PRIVATE_KEY not found in .env file!")
else:
    print("✅ PRIVATE_KEY loaded successfully.")
# 1. SETUP & CONFIGURATION
load_dotenv()

# Initialize FastAPI only ONCE


# Ensure upload directory exists
os.makedirs("uploads", exist_ok=True)

# 2. BLOCKCHAIN INITIALIZATION
RPC_URL = "http://127.0.0.1:8545"
w3 = Web3(Web3.HTTPProvider(RPC_URL))

CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")

# Load ABI
try:
    with open("abi.json", "r") as f:
        contract_abi = json.load(f)
    contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=contract_abi)
except Exception as e:
    print(f"⚠️ Warning: Could not load ABI or Contract: {e}")

# 3. MONGODB INITIALIZATION
MONGO_DETAILS = os.getenv("MONGO_DETAILS", "mongodb+srv://tanishq:tanishqkhetwal1234@carboncred.3ifjahc.mongodb.net/")
client = AsyncIOMotorClient(MONGO_DETAILS)
db = client.carbon_cred_db
companies_col = db.get_collection("companies")

@app.on_event("startup")
async def startup_db_client():
    print("Connecting to MongoDB Atlas...")
    try:
        await client.admin.command('ping')
        print("✅ SUCCESS: Connected to MongoDB Atlas!")
    except Exception as e:
        print(f"❌ ERROR: Could not connect to MongoDB: {e}")

# 4. BLOCKCHAIN HELPER
def mint_carbon_credits(company_wallet, amount_tons):
    """Internal function to mint credits on the blockchain."""
    try:
        # 1. Validate Private Key exists
        if not PRIVATE_KEY:
            print("Blockchain Error: PRIVATE_KEY is None. Check your .env file.")
            return None

        # 2. Setup Admin Account
        admin_account = w3.eth.account.from_key(PRIVATE_KEY)
        # Ensure we always get the latest nonce to avoid 'nonce too low' errors
        nonce = w3.eth.get_transaction_count(admin_account.address)
        
        # 3. Build Transaction
        txn = contract.functions.mintCredits(
            Web3.to_checksum_address(company_wallet), 
            int(amount_tons)
        ).build_transaction({
            'chainId': 31337,  # Default Hardhat chainId
            'gas': 200000,
            'gasPrice': w3.eth.gas_price,
            'nonce': nonce,
            'from': admin_account.address
        })

        # 4. Sign and Send
        signed_txn = w3.eth.account.sign_transaction(txn, private_key=PRIVATE_KEY)
        
        # FLEXIBLE ATTRIBUTE CHECK: Handles both raw_transaction and rawTransaction
        raw_tx = getattr(signed_txn, 'raw_transaction', getattr(signed_txn, 'rawTransaction', None))
        
        if raw_tx is None:
            raise AttributeError("Could not find 'raw_transaction' or 'rawTransaction' on the signed object.")

        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        
        # 5. Wait for Confirmation
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt.transactionHash.hex()

    except Exception as e:
        print(f"Blockchain Error: {e}")
        return None
# 5. ROUTES
@app.post("/phase1-minting/{company_name}")
async def mint_initial_credits(company_name: str, wallet_address: str, file: UploadFile = File(...)):
    # Save file
    file_path = f"uploads/start_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # OCR Logic (Make sure ocr_engine is in your path)
    from ocr_engine import extract_carbon_value
    tons_detected = extract_carbon_value(file_path)

    # A. Update MongoDB
    await companies_col.update_one(
        {"name": company_name},
        {"$set": {
            "wallet_address": wallet_address,
            "initial_allowance": tons_detected,
            "minted_at": datetime.utcnow(),
            "status": "active"
        }},
        upsert=True
    )

    # B. Trigger Blockchain Minting
    tx_hash = mint_carbon_credits(wallet_address, tons_detected)

    return {
        "status": "SUCCESS",
        "company": company_name,
        "tons": tons_detected,
        "blockchain_tx": tx_hash
    }

@app.get("/leaderboard")
async def get_leaderboard():
    """
    Ranks companies based on their remaining carbon allowance and calculates reputation.
    """
    try:
        # Fetch all companies from the collection, sorted by allowance
        cursor = companies_col.find().sort("initial_allowance", -1)
        
        rankings = []
        async for doc in cursor:
            # 1. Basic Data Extraction
            allowance = doc.get("initial_allowance", 0)
            consumed = doc.get("last_verified_consumption", 0)
            surplus = allowance - consumed
            
            # 2. Reputation Calculation Logic
            # Accuracy rate: How much of their allowance did they actually use?
            accuracy_rate = (consumed / allowance) if allowance > 0 else 0

            # Assign Grades based on behavioral efficiency
            if accuracy_rate <= 0.9 and doc.get("status") == "audited":
                reputation = "AAA (Excellent)" # High efficiency, audit completed
            elif accuracy_rate <= 1.0:
                reputation = "AA (Good)"      # Within limits
            else:
                reputation = "B (At Risk)"    # Exceeded allowance
            
            # 3. Build the response object
            rankings.append({
                "company": doc.get("name", "Unknown"),
                "wallet": doc.get("wallet_address", "N/A"),
                "total_allowance": allowance,
                "actual_used": consumed,
                "net_surplus": surplus,
                "reputation_grade": reputation, # New field for your dashboard
                "status": doc.get("status", "pending"),
                "is_compliant": surplus >= 0
            })
        
        # Sort the list so the best surplus is at the top
        rankings.sort(key=lambda x: x['net_surplus'], reverse=True)
        
        from datetime import datetime
        return {
            "timestamp": datetime.utcnow(),
            "total_companies": len(rankings),
            "leaderboard": rankings
        }
    except Exception as e:
        print(f"Leaderboard Error: {e}")
        return {"status": "ERROR", "message": str(e)}

@app.post("/phase2-settlement/{company_name}")
async def verify_and_settle(company_name: str, file: UploadFile = File(...)):
    # 1. FETCH COMPANY DATA FROM MONGODB
    company_data = await companies_col.find_one({"name": company_name})
    if not company_data:
        raise HTTPException(status_code=404, detail="Company not found. Phase 1 must be completed first.")

    # 2. SAVE AUDIT REPORT & RUN OCR
    file_path = f"uploads/audit_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Import inside the route to ensure it's loaded properly
    from ocr_engine import extract_carbon_value
    actual_consumption = extract_carbon_value(file_path)
    
    # 3. BLOCKCHAIN RETIREMENT (BURN)
    try:
        if not PRIVATE_KEY:
            raise ValueError("PRIVATE_KEY is missing from environment variables.")

        admin_account = w3.eth.account.from_key(PRIVATE_KEY)
        # Ensure the wallet address is in Checksum format
        company_wallet = Web3.to_checksum_address(company_data["wallet_address"])
        
        # Build the retirement (burn) transaction
        txn = contract.functions.retireCredits(
            company_wallet, 
            int(actual_consumption)
        ).build_transaction({
            'chainId': 31337,
            'gas': 200000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(admin_account.address),
            'from': admin_account.address
        })
        
        # Sign the transaction
        signed = w3.eth.account.sign_transaction(txn, PRIVATE_KEY)
        
        # FLEXIBLE ATTRIBUTE CHECK: Fixes 'rawTransaction' vs 'raw_transaction' error
        raw_tx = getattr(signed, 'raw_transaction', getattr(signed, 'rawTransaction', None))
        
        if raw_tx is None:
            raise AttributeError("Could not find 'raw_transaction' or 'rawTransaction' on the signed object.")

        # Send the raw transaction
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        
        # Wait for block confirmation on your local Hardhat node
        w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # 4. UPDATE DATABASE STATUS
        allowance = company_data.get("initial_allowance", 0)
        surplus = allowance - actual_consumption
        
        await companies_col.update_one(
            {"name": company_name},
            {"$set": {
                "last_verified_consumption": actual_consumption,
                "status": "audited",
                "compliance_result": "SUCCESS" if surplus >= 0 else "FAIL",
                "settlement_tx": tx_hash.hex()
            }}
        )

        return {
            "status": "SETTLEMENT_COMPLETE",
            "company": company_name,
            "retired_tons": actual_consumption,
            "remaining_balance": surplus,
            "blockchain_tx": tx_hash.hex()
        }

    except Exception as e:
        print(f"Phase 2 Blockchain Error: {e}")
        return {"status": "ERROR", "message": str(e)}