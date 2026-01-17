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

# 2. CORS MIDDLEWARE (Crucial for Dashboard communication)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)

# 3. BLOCKCHAIN & ENV INITIALIZATION
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
        if not PRIVATE_KEY: 
            print("Blockchain Error: PRIVATE_KEY missing.")
            return None
        
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
        
        # Flexible attribute check for web3 version compatibility
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
    # Save registration file
    file_path = f"uploads/start_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Extract carbon value using OCR
    from ocr_engine import extract_carbon_value
    tons_detected = extract_carbon_value(file_path)

    # Update MongoDB
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

    # Trigger blockchain minting
    tx_hash = mint_carbon_credits(wallet_address, tons_detected)
    
    return {
        "status": "SUCCESS", 
        "company": company_name, 
        "tons": tons_detected, 
        "blockchain_tx": tx_hash
    }

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
            
            # 1.5x Penalty Logic for leaderboard display
            has_penalty = consumed > allowance
            penalty_tons = (consumed - allowance) * 0.5 if has_penalty else 0
            total_retirement_needed = consumed + penalty_tons
            surplus = allowance - total_retirement_needed
            
            # Dynamic Reputation Grade Calculation
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
        
        # Sort by surplus (most efficient companies at top)
        rankings.sort(key=lambda x: x['net_surplus'], reverse=True)
        
        return {
            "timestamp": datetime.utcnow(), 
            "total_companies": len(rankings), 
            "leaderboard": rankings
        }
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

@app.post("/phase2-settlement/{company_name}")
async def verify_and_settle(company_name: str, file: UploadFile = File(...)):
    company_data = await companies_col.find_one({"name": company_name})
    if not company_data:
        raise HTTPException(status_code=404, detail="Company not found. Phase 1 required.")

    # Save audit file
    file_path = f"uploads/audit_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    from ocr_engine import extract_carbon_value
    actual_consumption = extract_carbon_value(file_path)
    
    try:
        if not PRIVATE_KEY:
            raise ValueError("PRIVATE_KEY is missing from environment.")

        admin_account = w3.eth.account.from_key(PRIVATE_KEY)
        company_wallet = Web3.to_checksum_address(company_data["wallet_address"])
        allowance = company_data.get("initial_allowance", 0)

        # 1.5x Penalty Calculation
        penalty_applied = actual_consumption > allowance
        penalty_tons = (actual_consumption - allowance) * 0.5 if penalty_applied else 0
        total_retirement_needed = int(actual_consumption + penalty_tons)

        blockchain_tx = "AWAITING_FUNDS"
        blockchain_status = "SUCCESS"

        try:
            # Build Retirement (Burn) Transaction
            txn = contract.functions.retireCredits(
                company_wallet, 
                total_retirement_needed
            ).build_transaction({
                'chainId': 31337, 
                'gas': 250000, 
                'gasPrice': w3.eth.gas_price,
                'nonce': w3.eth.get_transaction_count(admin_account.address), 
                'from': admin_account.address
            })
            
            signed = w3.eth.account.sign_transaction(txn, PRIVATE_KEY)
            
            # Flexible attribute check for web3 version compatibility
            raw_tx = getattr(signed, 'raw_transaction', getattr(signed, 'rawTransaction', None))
            
            tx_hash = w3.eth.send_raw_transaction(raw_tx)
            w3.eth.wait_for_transaction_receipt(tx_hash)
            blockchain_tx = tx_hash.hex()
            
        except Exception as b_err:
            # Catch deficit (insufficient balance) errors to update status correctly
            if "ERC20InsufficientBalance" in str(b_err) or "insufficient funds" in str(b_err).lower():
                blockchain_status = "DEFICIT_LOCKED"
                print(f"🚨 DEFICIT ALERT: {company_name} is short credits.")
            else: 
                raise b_err

        # Update MongoDB with Final Audit Results
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
            "penalty_applied": penalty_applied,
            "message": "Audit successful." if surplus >= 0 else "Audit complete with deficit. Buy credits to clear debt."
        }

    except Exception as e:
        print(f"Settlement Error: {e}")
        return {"status": "ERROR", "message": str(e)}
    # Define the request schema for listing credits
class ListRequest(BaseModel):
    company_name: str
    amount: int

@app.post("/marketplace/list")
async def list_credits(request: ListRequest):
    company = await companies_col.find_one({"name": request.company_name})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        # DECENTRALIZED STEP: Use the Company's Private Key, NOT the Admin's
        # In a real app, this would be signed by the user's MetaMask
        company_private_key = os.getenv(f"{request.company_name.upper()}_PRIVATE_KEY")
        company_account = w3.eth.account.from_key(company_private_key)
        
        txn = contract.functions.listForSale(int(request.amount)).build_transaction({
            'chainId': 31337,
            'gas': 300000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(company_account.address),
            'from': company_account.address
        })

        signed_txn = w3.eth.account.sign_transaction(txn, private_key=company_private_key)
        raw_tx = getattr(signed_txn, 'raw_transaction', getattr(signed_txn, 'rawTransaction', None))
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        w3.eth.wait_for_transaction_receipt(tx_hash)

        return {"status": "SUCCESSFUL_DECENTRALIZED_LISTING", "tx_hash": tx_hash.hex()}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}
@app.post("/marketplace/approve")
async def approve_marketplace(company_name: str, amount: int):
    company = await companies_col.find_one({"name": company_name})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    try:
        # Fetch Tesla's private key from .env
        env_key = f"{company_name.upper()}_PRIVATE_KEY"
        company_key = os.getenv(env_key)
        account = w3.eth.account.from_key(company_key)
        
        # Call ERC20 'approve' to let the contract spend Tesla's credits
        txn = contract.functions.approve(CONTRACT_ADDRESS, int(amount)).build_transaction({
            'chainId': 31337,
            'gas': 100000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(account.address),
            'from': account.address
        })
        
        signed = w3.eth.account.sign_transaction(txn, company_key)
        raw_tx = getattr(signed, 'raw_transaction', getattr(signed, 'rawTransaction', None))
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        w3.eth.wait_for_transaction_receipt(tx_hash)
        
        return {"status": "SUCCESS: MARKETPLACE APPROVED", "tx_hash": tx_hash.hex()}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}
# Create a schema for the buy request
class BuyRequest(BaseModel):
    company_name: str
    amount: int

@app.post("/marketplace/buy-from-pool")
async def buy_from_pool(request: BuyRequest):
    """
    Clears debt by purchasing from the aggregate pool and updating the 
    local database to reflect the new on-chain balance.
    """
    try:
        # 1. Fetch the correct private key from .env
        buyer_env_key = f"{request.company_name.upper()}_PRIVATE_KEY"
        buyer_private_key = os.getenv(buyer_env_key)
        
        if not buyer_private_key:
            return {"status": "ERROR", "message": f"Missing {buyer_env_key} in .env"}

        # 2. Derive the account to get the correct 'from' address
        account = w3.eth.account.from_key(buyer_private_key)
        
        # 3. Build the transaction for 'buyFromMarket'
        txn = contract.functions.buyFromMarket(int(request.amount)).build_transaction({
            'chainId': 31337, 
            'gas': 600000, 
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(account.address), 
            'from': account.address
        })

        # 4. Sign the transaction
        signed = w3.eth.account.sign_transaction(txn, buyer_private_key)
        
        # 5. Handle naming conventions for different web3.py versions
        raw_tx = getattr(signed, 'raw_transaction', getattr(signed, 'rawTransaction', None))
        
        # 6. Send and wait for receipt
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        w3.eth.wait_for_transaction_receipt(tx_hash)

        # 7. UPDATE DATABASE: Increment the company's allowance so the dashboard 
        # calculation (Allowance - Consumption) returns 0.
        await companies_col.update_one(
            {"name": request.company_name},
            {"$inc": {"initial_allowance": request.amount}}
        )

        # 8. Log to MongoDB History for the Audit Trail
        await history_col.insert_one({
            "timestamp": datetime.utcnow(), 
            "type": "SETTLEMENT",
            "company": request.company_name, 
            "details": f"Purchased {request.amount}t from Pool to clear debt",
            "tx_hash": tx_hash.hex()
        })

        return {"status": "SUCCESS", "tx_hash": tx_hash.hex()}
        
    except Exception as e:
        print(f"Settle Error: {e}")
        return {"status": "ERROR", "message": str(e)}
# Create a new collection for logs
history_col = db.get_collection("transaction_history")

# Add a GET route to fetch the last 10 transactions
@app.get("/market-history")
async def get_history():
    cursor = history_col.find().sort("timestamp", -1).limit(10)
    logs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"]) # Convert MongoDB ID to string
        logs.append(doc)
    return logs