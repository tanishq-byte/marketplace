import os
import json
import shutil
from datetime import datetime
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from web3 import Web3
from pydantic import BaseModel

# 1. SETUP & CONFIGURATION
load_dotenv()

# 2. BLOCKCHAIN & ENV INITIALIZATION
RPC_URL = os.getenv("RPC_URL", "http://127.0.0.1:8545")
w3 = Web3(Web3.HTTPProvider(RPC_URL))

# Fetches from .env names, not raw values
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")

try:
    with open("abi.json", "r") as f:
        artifact = json.load(f)
        # Handles both raw ABI arrays and Hardhat artifact formats
        contract_abi = artifact["abi"] if isinstance(artifact, dict) and "abi" in artifact else artifact
    contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=contract_abi)
except Exception as e:
    print(f"⚠️ Warning: Could not load ABI or Contract: {e}")

# 3. MONGODB INITIALIZATION
MONGO_DETAILS = os.getenv("MONGO_DETAILS")
client = AsyncIOMotorClient(MONGO_DETAILS)
db = client.carbon_cred_db
companies_col = db.get_collection("companies")
history_col = db.get_collection("transaction_history")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Connecting to MongoDB Atlas...")
    try:
        await client.admin.command('ping')
        print("✅ SUCCESS: Connected to MongoDB Atlas!")
    except Exception as e:
        print(f"❌ ERROR: Could not connect to MongoDB: {e}")
    yield
    client.close()

app = FastAPI(lifespan=lifespan)

# 4. CORS MIDDLEWARE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)

# 5. REQUEST SCHEMAS
class ListRequest(BaseModel):
    company_name: str
    amount: int

class BuyRequest(BaseModel):
    company_name: str
    amount: int

# 6. BLOCKCHAIN HELPERS
def mint_carbon_credits(company_wallet, amount_tons):
    try:
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

        signed = w3.eth.account.sign_transaction(txn, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt.transactionHash.hex()
    except Exception as e:
        print(f"❌ Minting Error: {e}")
        return None

# 7. ROUTES

@app.post("/phase1-minting/{company_name}")
async def register_and_mint(company_name: str, wallet_address: str, file: UploadFile = File(...)):
    """Phase 1: OCR Registration and Initial Minting"""
    file_path = f"uploads/reg_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    from ocr_engine import extract_carbon_value
    tons_detected = extract_carbon_value(file_path)

    tx_hash = mint_carbon_credits(wallet_address, tons_detected)

    await companies_col.update_one(
        {"name": company_name},
        {"$set": {
            "wallet_address": wallet_address,
            "initial_allowance": tons_detected,
            "last_verified_consumption": 0,
            "status": "active",
            "minted_at": datetime.utcnow()
        }},
        upsert=True
    )

    return {
        "status": "SUCCESS", 
        "company": company_name, 
        "tons_allocated": tons_detected, 
        "blockchain_tx": tx_hash
    }

@app.post("/phase2-settlement/{company_name}")
async def verify_and_settle(company_name: str, file: UploadFile = File(...)):
    """Phase 2: Audit and 1.5x Penalty Burn Logic"""
    company_data = await companies_col.find_one({"name": company_name})
    if not company_data:
        raise HTTPException(status_code=404, detail="Company not found. Phase 1 required.")

    file_path = f"uploads/audit_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    from ocr_engine import extract_carbon_value
    actual_consumption = extract_carbon_value(file_path)
    
    try:
        # Use Admin Key to authorize the retirement/burn
        admin_account = w3.eth.account.from_key(PRIVATE_KEY)
        company_wallet = Web3.to_checksum_address(company_data["wallet_address"])
        allowance = company_data.get("initial_allowance", 0)

        penalty_applied = actual_consumption > allowance
        penalty_tons = (actual_consumption - allowance) * 0.5 if penalty_applied else 0
        total_burn = int(actual_consumption + penalty_tons)

        # Build 'retireCredits' transaction
        txn = contract.functions.retireCredits(
            company_wallet, 
            total_burn
        ).build_transaction({
            'chainId': 31337,
            'gas': 250000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(admin_account.address),
            'from': admin_account.address
        })

        signed = w3.eth.account.sign_transaction(txn, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        w3.eth.wait_for_transaction_receipt(tx_hash)

        surplus = allowance - total_burn
        await companies_col.update_one(
            {"name": company_name},
            {"$set": {
                "last_verified_consumption": actual_consumption,
                "net_surplus": surplus,
                "status": "audited" if surplus >= 0 else "deficit",
                "settlement_tx": tx_hash.hex()
            }}
        )

        return {
            "status": "SETTLEMENT_PROCESSED",
            "net_surplus": surplus,
            "blockchain_tx": tx_hash.hex()
        }
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

@app.post("/marketplace/approve")
async def approve_marketplace(company_name: str, amount: int):
    """Allows the marketplace contract to handle company tokens"""
    try:
        env_key = f"{company_name.upper()}_PRIVATE_KEY"
        company_key = os.getenv(env_key)
        account = w3.eth.account.from_key(company_key)
        
        txn = contract.functions.approve(CONTRACT_ADDRESS, int(amount)).build_transaction({
            'chainId': 31337, 'gas': 100000, 'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(account.address), 'from': account.address
        })
        
        signed = w3.eth.account.sign_transaction(txn, company_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        return {"status": "APPROVED", "tx_hash": tx_hash.hex()}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

@app.post("/marketplace/list")
async def list_on_market(request: ListRequest):
    """Lists credits for sale using company's private key"""
    try:
        company_key = os.getenv(f"{request.company_name.upper()}_PRIVATE_KEY")
        account = w3.eth.account.from_key(company_key)
        
        txn = contract.functions.listForSale(int(request.amount)).build_transaction({
            'chainId': 31337, 'gas': 300000, 'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(account.address), 'from': account.address
        })

        signed = w3.eth.account.sign_transaction(txn, company_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        return {"status": "LISTED", "tx_hash": tx_hash.hex()}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

@app.post("/marketplace/buy-from-pool")
async def buy_credits(request: BuyRequest):
    """Buy credits from the marketplace pool to clear debt"""
    try:
        buyer_key = os.getenv(f"{request.company_name.upper()}_PRIVATE_KEY")
        account = w3.eth.account.from_key(buyer_key)
        
        txn = contract.functions.buyFromMarket(int(request.amount)).build_transaction({
            'chainId': 31337, 'gas': 500000, 'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(account.address), 'from': account.address
        })

        signed = w3.eth.account.sign_transaction(txn, buyer_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        w3.eth.wait_for_transaction_receipt(tx_hash)

        await companies_col.update_one({"name": request.company_name}, {"$inc": {"initial_allowance": request.amount}})
        return {"status": "PURCHASE_SUCCESS", "tx_hash": tx_hash.hex()}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

@app.get("/leaderboard")
async def get_rankings():
    """Returns leaderboard with Reputation Grades"""
    cursor = companies_col.find().sort("initial_allowance", -1)
    rankings = []
    async for doc in cursor:
        allowance = doc.get("initial_allowance", 0)
        consumed = doc.get("last_verified_consumption", 0)
        surplus = doc.get("net_surplus", allowance - consumed)
        
        # Reputation Logic
        if surplus < 0: grade = "B (Debtor)"
        elif consumed / allowance <= 0.9 if allowance > 0 else 0: grade = "AAA"
        else: grade = "AA"

        rankings.append({
            "company": doc.get("name"),
            "net_surplus": surplus,
            "grade": grade,
            "status": doc.get("status")
        })
    return {"leaderboard": rankings}