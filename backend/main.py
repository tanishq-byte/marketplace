import os
import json
import shutil
from datetime import datetime
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from web3 import Web3

# 1. SETUP & CONFIGURATION
load_dotenv()
app = FastAPI()

# 2. CORS MIDDLEWARE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)

# 3. BLOCKCHAIN INITIALIZATION
RPC_URL = "http://127.0.0.1:8545"
w3 = Web3(Web3.HTTPProvider(RPC_URL))
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")

try:
    with open("abi.json", "r") as f:
        contract_abi = json.load(f)
    contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=contract_abi)
except Exception as e:
    print(f"⚠️ Warning: Could not load ABI or Contract: {e}")

# 4. MONGODB INITIALIZATION
MONGO_DETAILS = os.getenv("MONGO_DETAILS", "mongodb+srv://tanishq:tanishqkhetwal1234@carboncred.3ifjahc.mongodb.net/")
client = AsyncIOMotorClient(MONGO_DETAILS)
db = client.carbon_cred_db
companies_col = db.get_collection("companies")

@app.on_event("startup")
async def startup_db_client():
    try:
        await client.admin.command('ping')
        print("✅ SUCCESS: Connected to MongoDB Atlas!")
    except Exception as e:
        print(f"❌ ERROR: Could not connect to MongoDB: {e}")

# 5. BLOCKCHAIN HELPERS
def mint_carbon_credits(company_wallet, amount_tons):
    try:
        if not PRIVATE_KEY: return None
        admin_account = w3.eth.account.from_key(PRIVATE_KEY)
        nonce = w3.eth.get_transaction_count(admin_account.address)
        
        txn = contract.functions.mintCredits(
            Web3.to_checksum_address(company_wallet), 
            int(amount_tons)
        ).build_transaction({
            'chainId': 31337,
            'gas': 200000,
            'gasPrice': w3.eth.gas_price,
            'nonce': nonce,
            'from': admin_account.address
        })

        signed_txn = w3.eth.account.sign_transaction(txn, private_key=PRIVATE_KEY)
        
        # FIXED: Flexible attribute check for web3 version compatibility
        raw_tx = getattr(signed_txn, 'raw_transaction', getattr(signed_txn, 'rawTransaction', None))
        
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt.transactionHash.hex()
    except Exception as e:
        print(f"Minting Error: {e}")
        return None

# 6. ROUTES
@app.post("/phase1-minting/{company_name}")
async def mint_initial_credits(company_name: str, wallet_address: str, file: UploadFile = File(...)):
    file_path = f"uploads/start_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    from ocr_engine import extract_carbon_value
    tons_detected = extract_carbon_value(file_path)

    await companies_col.update_one(
        {"name": company_name},
        {"$set": {
            "wallet_address": wallet_address,
            "initial_allowance": tons_detected,
            "last_verified_consumption": 0,
            "minted_at": datetime.utcnow(),
            "status": "active"
        }},
        upsert=True
    )

    tx_hash = mint_carbon_credits(wallet_address, tons_detected)
    return {"status": "SUCCESS", "company": company_name, "tons": tons_detected, "blockchain_tx": tx_hash}

# Add to your main.py backend
@app.get("/api/companies/{company_name}")
async def get_company(company_name: str):
    company_data = await companies_col.find_one({"name": company_name})
    if not company_data:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Remove MongoDB _id field
    company_data.pop('_id', None)
    return company_data

@app.get("/leaderboard")
async def get_leaderboard():
    try:
        cursor = companies_col.find().sort("initial_allowance", -1)
        rankings = []
        async for doc in cursor:
            allowance = doc.get("initial_allowance", 0)
            consumed = doc.get("last_verified_consumption", 0)
            status = doc.get("status", "pending")
            
            has_penalty = consumed > allowance
            penalty_tons = (consumed - allowance) * 0.5 if has_penalty else 0
            total_retirement_needed = consumed + penalty_tons
            surplus = allowance - total_retirement_needed
            
            accuracy_rate = (consumed / allowance) if allowance > 0 else 0
            if surplus < 0:
                reputation = "B (Debtor - 1.5x Penalty Applied)"
            elif accuracy_rate <= 0.9 and status == "audited":
                reputation = "AAA (Excellent)"
            elif accuracy_rate <= 1.0:
                reputation = "AA (Good)"
            else:
                reputation = "B (At Risk)"
            
            rankings.append({
                "company": doc.get("name", "Unknown"),
                "wallet": doc.get("wallet_address", "N/A"),
                "total_allowance": allowance,
                "actual_used": consumed,
                "penalty_applied": has_penalty,
                "penalty_tons": penalty_tons,
                "net_surplus": surplus,
                "reputation_grade": reputation,
                "status": status,
                "is_compliant": surplus >= 0
            })
        
        rankings.sort(key=lambda x: x['net_surplus'], reverse=True)
        return {"timestamp": datetime.utcnow(), "total_companies": len(rankings), "leaderboard": rankings}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

@app.post("/phase2-settlement/{company_name}")
async def verify_and_settle(company_name: str, file: UploadFile = File(...)):
    company_data = await companies_col.find_one({"name": company_name})
    if not company_data:
        raise HTTPException(status_code=404, detail="Company not found.")

    file_path = f"uploads/audit_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    from ocr_engine import extract_carbon_value
    actual_consumption = extract_carbon_value(file_path)
    
    try:
        admin_account = w3.eth.account.from_key(PRIVATE_KEY)
        company_wallet = Web3.to_checksum_address(company_data["wallet_address"])
        allowance = company_data.get("initial_allowance", 0)

        # Penalty Logic (1.5x)
        penalty_applied = actual_consumption > allowance
        penalty_tons = (actual_consumption - allowance) * 0.5 if penalty_applied else 0
        total_retirement_needed = int(actual_consumption + penalty_tons)

        blockchain_tx = "AWAITING_FUNDS"
        blockchain_status = "SUCCESS"

        try:
            # Attempt Blockchain Burn
            txn = contract.functions.retireCredits(company_wallet, total_retirement_needed).build_transaction({
                'chainId': 31337, 'gas': 250000, 'gasPrice': w3.eth.gas_price,
                'nonce': w3.eth.get_transaction_count(admin_account.address), 'from': admin_account.address
            })
            signed = w3.eth.account.sign_transaction(txn, PRIVATE_KEY)
            
            # FIXED: Flexible attribute check added here to solve the 'rawTransaction' error
            raw_tx = getattr(signed, 'raw_transaction', getattr(signed, 'rawTransaction', None))
            
            tx_hash = w3.eth.send_raw_transaction(raw_tx)
            w3.eth.wait_for_transaction_receipt(tx_hash)
            blockchain_tx = tx_hash.hex()
        except Exception as b_err:
            if "ERC20InsufficientBalance" in str(b_err):
                blockchain_status = "DEFICIT_LOCKED"
                print(f"🚨 DEFICIT: {company_name} is short credits.")
            else: 
                raise b_err

        # Update MongoDB with the "Debt" status regardless of blockchain success
        surplus = allowance - total_retirement_needed
        await companies_col.update_one(
            {"name": company_name},
            {"$set": {
                "last_verified_consumption": actual_consumption,
                "net_surplus": surplus,
                "status": "audited" if blockchain_status == "SUCCESS" else "deficit",
                "compliance_result": "SUCCESS" if surplus >= 0 else "FAIL_DEBTOR",
                "settlement_tx": blockchain_tx
            }}
        )

        return {
            "status": "SETTLEMENT_PROCESSED",
            "company": company_name,
            "blockchain_status": blockchain_status,
            "net_surplus": surplus,
            "message": "Audit processed. Purchase credits to clear debt." if surplus < 0 else "Audit successful."
        }

    except Exception as e:
        print(f"Settlement Error: {e}")
        return {"status": "ERROR", "message": str(e)}
