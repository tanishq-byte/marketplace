import os
import json
import shutil
from datetime import datetime
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from web3 import Web3
from pydantic import BaseModel

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

# 3. BLOCKCHAIN & ENV INITIALIZATION
# Change to Sepolia RPC if not testing on local Hardhat Node
RPC_URL = os.getenv("RPC_URL", "http://127.0.0.1:8545") 
w3 = Web3(Web3.HTTPProvider(RPC_URL))
CONTRACT_ADDRESS = os.getenv("0x1f078877713ca78a96559566CCcd3f570dc2a9Ee")
PRIVATE_KEY = os.getenv("c21b0617d3c909dce9ade4fffae5744700796bb537c3fa8c75b2627201df0c28") # Admin/Owner Key

try:
    # Ensure this file is the NEWEST CarbonToken.json from your artifacts
    with open("abi.json", "r") as f:
        artifact = json.load(f)
        contract_abi = artifact["abi"] if "abi" in artifact else artifact
    contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=contract_abi)
except Exception as e:
    print(f"⚠️ Warning: Could not load ABI or Contract: {e}")

# 4. MONGODB INITIALIZATION
MONGO_DETAILS = os.getenv("MONGO_DETAILS", "mongodb+srv://tanishq:tanishqkhetwal1234@carboncred.3ifjahc.mongodb.net/")
client = AsyncIOMotorClient(MONGO_DETAILS)
db = client.carbon_cred_db
companies_col = db.get_collection("companies")
history_col = db.get_collection("transaction_history")

# 5. REQUEST SCHEMAS
class ListRequest(BaseModel):
    company_name: str
    amount: int
    price: int
    qr_url: str

# 6. ROUTES

@app.post("/phase2-settlement/{company_name}")
async def verify_and_settle(company_name: str, file: UploadFile = File(...)):
    """
    Phase 2: Verifies audit report and calls 'retireCredits' to burn tokens.
    """
    company_data = await companies_col.find_one({"name": company_name})
    if not company_data:
        raise HTTPException(status_code=404, detail="Company not found. Phase 1 required.")

    file_path = f"uploads/audit_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    from ocr_engine import extract_carbon_value
    actual_consumption = extract_carbon_value(file_path)
    
    try:
        # Fetch company's private key to retire tokens
        company_key = os.getenv(f"{company_name.upper()}_PRIVATE_KEY")
        if not company_key:
            raise ValueError(f"Private key for {company_name} not found in .env")
            
        company_account = w3.eth.account.from_key(company_key)
        allowance = company_data.get("initial_allowance", 0)

        # 1.5x Penalty Logic
        penalty_applied = actual_consumption > allowance
        penalty_tons = (actual_consumption - allowance) * 0.5 if penalty_applied else 0
        total_retirement_needed = int(actual_consumption + penalty_tons)

        blockchain_tx = "AWAITING_FUNDS"
        blockchain_status = "SUCCESS"

        try:
            # Build Retirement Transaction calling 'retireCredits'
            txn = contract.functions.retireCredits(
                total_retirement_needed
            ).build_transaction({
                'chainId': 31337, # Change to 11155111 for Sepolia
                'gas': 250000, 
                'gasPrice': w3.eth.gas_price,
                'nonce': w3.eth.get_transaction_count(company_account.address), 
                'from': company_account.address
            })
            
            signed = w3.eth.account.sign_transaction(txn, company_key)
            raw_tx = getattr(signed, 'raw_transaction', getattr(signed, 'rawTransaction', None))
            tx_hash = w3.eth.send_raw_transaction(raw_tx)
            w3.eth.wait_for_transaction_receipt(tx_hash)
            blockchain_tx = tx_hash.hex()
            
        except Exception as b_err:
            if "ERC20InsufficientBalance" in str(b_err) or "insufficient funds" in str(b_err).lower():
                blockchain_status = "DEFICIT_LOCKED"
            else: 
                raise b_err

        surplus = allowance - total_retirement_needed
        await companies_col.update_one(
            {"name": company_name},
            {"$set": {
                "last_verified_consumption": actual_consumption,
                "net_surplus": surplus,
                "status": "audited" if blockchain_status == "SUCCESS" else "deficit",
                "settlement_tx": blockchain_tx
            }}
        )

        return {
            "status": "SETTLEMENT_PROCESSED",
            "company": company_name,
            "blockchain_status": blockchain_status,
            "net_surplus": surplus,
            "settlement_tx": blockchain_tx
        }
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

@app.post("/marketplace/list")
async def list_credits(request: ListRequest):
    """
    Marketplace: Calls 'listWithPrice' to lock tokens in escrow.
    """
    try:
        company_key = os.getenv(f"{request.company_name.upper()}_PRIVATE_KEY")
        account = w3.eth.account.from_key(company_key)
        
        # CORRECT CALL: listWithPrice(uint256 _amount, uint256 _price, string _qrUrl)
        txn = contract.functions.listWithPrice(
            int(request.amount),
            int(request.price),
            request.qr_url
        ).build_transaction({
            'chainId': 31337,
            'gas': 400000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(account.address),
            'from': account.address
        })

        signed_txn = w3.eth.account.sign_transaction(txn, private_key=company_key)
        raw_tx = getattr(signed_txn, 'raw_transaction', getattr(signed_txn, 'rawTransaction', None))
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        w3.eth.wait_for_transaction_receipt(tx_hash)

        return {"status": "SUCCESS", "tx_hash": tx_hash.hex()}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

@app.get("/api/companies/{company_name}")
async def get_company(company_name: str):
    company_data = await companies_col.find_one({"name": company_name})
    if not company_data:
        raise HTTPException(status_code=404, detail="Company not found")
    company_data.pop('_id', None)
    return company_data

@app.get("/leaderboard")
async def get_leaderboard():
    cursor = companies_col.find().sort("net_surplus", -1)
    rankings = []
    async for doc in cursor:
        rankings.append({
            "company": doc.get("name", "Unknown"),
            "net_surplus": doc.get("net_surplus", 0),
            "status": doc.get("status", "pending"),
            "last_verified_consumption": doc.get("last_verified_consumption", 0),
            "initial_allowance": doc.get("initial_allowance", 0),
            "wallet_address": doc.get("wallet_address", "N/A"),
            "compliance_result": doc.get("compliance_result", "N/A"),
            "settlement_tx": doc.get("settlement_tx", "N/A"),
            
        })
    return {"leaderboard": rankings}