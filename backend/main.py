import os
import json
import shutil
from datetime import datetime
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
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
    """Phase 2: Merged Audit Logic - Updates DB immediately and attempts burn"""
    
    # 1. AUTHENTICATION & FILE HANDLING
    company_data = await companies_col.find_one({"name": company_name})
    if not company_data:
        raise HTTPException(status_code=404, detail="Company not found. Phase 1 required.")

    file_path = f"uploads/audit_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    from ocr_engine import extract_carbon_value
    actual_consumption = extract_carbon_value(file_path)
    
    # 2. CALCULATION LOGIC (Teammate's contribution)
    allowance = company_data.get("initial_allowance", 0)
    company_wallet = company_data.get("wallet_address")
    
    # Calculate 1.5x penalty on overage
    penalty = (actual_consumption - allowance) * 0.5 if actual_consumption > allowance else 0
    required_burn = int(actual_consumption + penalty)
    
    # Check current on-chain balance
    current_balance = contract.functions.balanceOf(company_wallet).call()
    deficit = max(0, required_burn - current_balance)
    surplus = allowance - required_burn

    # 3. DATABASE UPDATE (Ensures Leaderboard Accuracy)
    # We update MongoDB first so the reputation score changes immediately
    await companies_col.update_one(
        {"name": company_name},
        {"$set": {
            "last_verified_consumption": actual_consumption,
            "net_surplus": surplus,
            "required_burn": required_burn,
            "deficit": deficit,
            "status": "deficit" if deficit > 0 else "ready_to_burn",
            "audit_completed_at": datetime.utcnow()
        }}
    )

    # 4. BLOCKCHAIN ATTEMPT (Your logic)
    if deficit > 0:
        return {
            "status": "DEFICIT",
            "message": f"Audit recorded. You need {deficit} more tokens to settle.",
            "net_surplus": surplus,
            "required_burn": required_burn,
            "action_required": "Buy tokens from marketplace to clear your B-Grade status"
        }

    try:
        # If no deficit, proceed to burn
        company_key = os.getenv(f"{company_name.upper()}_PRIVATE_KEY")
        company_account = w3.eth.account.from_key(company_key)

        txn = contract.functions.retireCredits(required_burn).build_transaction({
            'chainId': 31337,
            'gas': 250000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(company_account.address),
            'from': company_account.address
        })

        signed = w3.eth.account.sign_transaction(txn, company_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        w3.eth.wait_for_transaction_receipt(tx_hash)

        # Final Update on Success
        await companies_col.update_one(
            {"name": company_name},
            {"$set": {"status": "audited", "settlement_tx": tx_hash.hex()}}
        )

        return {
            "status": "SETTLEMENT_SUCCESS",
            "company": company_name,
            "blockchain_tx": tx_hash.hex(),
            "net_surplus": surplus
        }

    except Exception as e:
        return {
            "status": "BLOCKCHAIN_DELAY",
            "message": "Audit saved, but blockchain call failed.",
            "details": str(e)
        }


@app.post("/finalize-settlement/{company_name}")
async def finalize_settlement(company_name: str):
    """Re-attempts the burn using data already saved in MongoDB"""
    
    company_data = await companies_col.find_one({"name": company_name})
    if not company_data or company_data.get("status") != "deficit":
        return {"status": "ERROR", "message": "No active debt found for this company."}

    required_burn = company_data.get("required_burn")
    company_wallet = company_data.get("wallet_address")

    try:
        # 1. Check if they actually bought the tokens yet
        current_balance = contract.functions.balanceOf(company_wallet).call()
        if current_balance < required_burn:
            return {
                "status": "STILL_IN_DEBT",
                "message": f"You still need {required_burn - current_balance} more tokens."
            }

        # 2. Execute the Burn (now that they have enough)
        company_key = os.getenv(f"{company_name.upper()}_PRIVATE_KEY")
        company_account = w3.eth.account.from_key(company_key)

        txn = contract.functions.retireCredits(required_burn).build_transaction({
            'chainId': 31337,
            'gas': 250000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(company_account.address),
            'from': company_account.address
        })

        signed = w3.eth.account.sign_transaction(txn, company_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        w3.eth.wait_for_transaction_receipt(tx_hash)

        # 3. Update status to Success
        await companies_col.update_one(
            {"name": company_name},
            {"$set": {"status": "audited", "settlement_tx": tx_hash.hex(), "deficit": 0}}
        )

        return {"status": "SUCCESS", "message": "Debt cleared. Tokens burned successfully!"}

    except Exception as e:
        return {"status": "ERROR", "message": str(e)}
    
# ============================================
# CORRECTED MARKETPLACE ENDPOINTS
# ============================================

@app.get("/marketplace/listings")
async def get_active_listings():
    """Get all active marketplace listings"""
    try:
        next_id = contract.functions.nextListingId().call()
        listings = []
        
        for i in range(next_id):
            listing = contract.functions.marketListings(i).call()
            if listing[6]:  # active flag at index 6
                # Find company name for seller
                seller_company = await companies_col.find_one(
                    {"wallet_address": listing[1].lower()}  # seller address at index 1
                )
                company_name = seller_company["name"] if seller_company else "Unknown"
                
                listings.append({
                    "listing_id": i,
                    "seller_company": company_name,
                    "seller_wallet": listing[1],
                    "amount": listing[2],
                    "price_per_token": listing[3],
                    "qr_url": listing[4],
                    "is_paid": listing[5],
                    "active": listing[6]
                })
        
        return {"status": "SUCCESS", "listings": listings}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

@app.post("/marketplace/list-with-price")
async def list_with_price(
    company_name: str = Query(...),
    amount: int = Query(...),
    price: int = Query(...),
    qr_url: str = Query(...)
):
    """List tokens for sale with price and QR code URL"""
    try:
        # Get company private key
        env_key = f"{company_name.upper().replace(' ', '_')}_PRIVATE_KEY"
        company_key = os.getenv(env_key)
        
        if not company_key:
            return {
                "status": "NO_KEY",
                "message": f"Private key for {company_name} not found. Add {env_key} to .env"
            }
        
        company_account = w3.eth.account.from_key(company_key)
        
        # ✅ CORRECT: Call listWithPrice(amount, price, qrUrl)
        txn = contract.functions.listWithPrice(
            amount,
            price,
            qr_url
        ).build_transaction({
            'chainId': 31337,
            'gas': 300000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(company_account.address),
            'from': company_account.address
        })

        signed = w3.eth.account.sign_transaction(txn, company_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Get the new listing ID
        listing_id = contract.functions.nextListingId().call() - 1
        
        # Log to history
        await history_col.insert_one({
            "timestamp": datetime.utcnow(),
            "type": "MARKETPLACE_LIST",
            "company": company_name,
            "amount": amount,
            "price": price,
            "listing_id": listing_id,
            "tx_hash": tx_hash.hex(),
            "status": "listed"
        })
        
        return {
            "status": "LISTED",
            "tx_hash": tx_hash.hex(),
            "listing_id": listing_id,
            "message": f"Successfully listed {amount} tokens at price {price} each"
        }
        
    except Exception as e:
        error_msg = str(e)
        print(f"Marketplace list error: {error_msg}")
        return {"status": "ERROR", "message": error_msg}

@app.post("/marketplace/mark-paid/{listing_id}")
async def mark_as_paid(
    listing_id: int,
    buyer_company: str = Query(...)
):
    """Buyer marks listing as paid after scanning QR code"""
    try:
        # Get buyer's private key
        buyer_key = os.getenv(f"{buyer_company.upper().replace(' ', '_')}_PRIVATE_KEY")
        if not buyer_key:
            return {
                "status": "NO_KEY",
                "message": f"Private key for buyer {buyer_company} not found"
            }
        
        buyer_account = w3.eth.account.from_key(buyer_key)
        
        # ✅ CORRECT: Call markAsPaid(listingId)
        txn = contract.functions.markAsPaid(listing_id).build_transaction({
            'chainId': 31337,
            'gas': 200000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(buyer_account.address),
            'from': buyer_account.address
        })
        
        signed = w3.eth.account.sign_transaction(txn, buyer_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Log to history
        await history_col.insert_one({
            "timestamp": datetime.utcnow(),
            "type": "MARKETPLACE_MARK_PAID",
            "buyer_company": buyer_company,
            "listing_id": listing_id,
            "tx_hash": tx_hash.hex(),
            "status": "marked_paid"
        })
        
        return {
            "status": "MARKED_PAID",
            "tx_hash": tx_hash.hex(),
            "message": f"Successfully marked listing #{listing_id} as paid"
        }
        
    except Exception as e:
        error_msg = str(e)
        print(f"Mark paid error: {error_msg}")
        return {"status": "ERROR", "message": error_msg}

@app.post("/marketplace/release/{listing_id}")
async def release_tokens(
    listing_id: int,
    buyer_wallet: str = Query(...)
):
    """Seller releases tokens to buyer after payment verification"""
    try:
        # Get listing info to find seller
        listing = contract.functions.marketListings(listing_id).call()
        seller_wallet = listing[1]  # seller address at index 1
        amount = listing[2]  # amount at index 2
        
        # Check if listing is active and paid
        if not listing[6]:  # active flag at index 6
            return {"status": "ERROR", "message": "Listing is not active"}
        if not listing[5]:  # is_paid flag at index 5
            return {"status": "ERROR", "message": "Buyer hasn't marked as paid yet"}
        
        # Find seller company
       # ✅ Corrected logic (Handles both casing styles)
        seller_company = await companies_col.find_one(
        {"wallet_address": {"$regex": f"^{seller_wallet}$", "$options": "i"}}
)
        if not seller_company:
            return {"status": "ERROR", "message": "Seller company not found in database"}
        
        company_name = seller_company["name"]
        seller_key = os.getenv(f"{company_name.upper().replace(' ', '_')}_PRIVATE_KEY")
        if not seller_key:
            return {"status": "NO_KEY", "message": f"Private key for seller {company_name} not found"}
        
        seller_account = w3.eth.account.from_key(seller_key)
        
        # ✅ CORRECT: Call releaseTokens(listingId, buyerAddress)
        txn = contract.functions.releaseTokens(
            listing_id,
            Web3.to_checksum_address(buyer_wallet)
        ).build_transaction({
            'chainId': 31337,
            'gas': 300000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(seller_account.address),
            'from': seller_account.address
        })
        
        signed = w3.eth.account.sign_transaction(txn, seller_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Find buyer company and update their allowance
        buyer_company = await companies_col.find_one(
            {"wallet_address": buyer_wallet.lower()}
        )
        if buyer_company:
            await companies_col.update_one(
                {"name": buyer_company["name"]},
                {"$inc": {"initial_allowance": amount}}
            )
        
        # Log to history
        await history_col.insert_one({
            "timestamp": datetime.utcnow(),
            "type": "MARKETPLACE_RELEASE",
            "seller_company": company_name,
            "buyer_wallet": buyer_wallet,
            "listing_id": listing_id,
            "amount": amount,
            "tx_hash": tx_hash.hex(),
            "status": "released"
        })
        
        return {
            "status": "RELEASED",
            "tx_hash": tx_hash.hex(),
            "message": f"Successfully released {amount} tokens to {buyer_wallet}"
        }
        
    except Exception as e:
        error_msg = str(e)
        print(f"Release tokens error: {error_msg}")
        return {"status": "ERROR", "message": error_msg}

# ============================================
# KEEPING OLD ENDPOINTS FOR COMPATIBILITY (but they won't work)
# ============================================

@app.post("/marketplace/approve")
async def approve_marketplace(company_name: str, amount: int):
    """⚠️ DEPRECATED: Your contract doesn't need approval for marketplace"""
    return {
        "status": "DEPRECATED",
        "message": "This endpoint is deprecated. Marketplace uses transfer() not approve()",
        "suggestion": "Use /marketplace/list-with-price instead"
    }

@app.post("/marketplace/list")
async def list_on_market(request: ListRequest):
    """⚠️ DEPRECATED: Wrong function name"""
    return {
        "status": "DEPRECATED",
        "message": "This endpoint is deprecated. Function listForSale doesn't exist",
        "suggestion": "Use /marketplace/list-with-price with amount, price, and qr_url parameters"
    }

@app.post("/marketplace/buy-from-pool")
async def buy_credits(request: BuyRequest):
    """⚠️ DEPRECATED: Wrong function name"""
    return {
        "status": "DEPRECATED",
        "message": "This endpoint is deprecated. Function buyFromMarket doesn't exist",
        "suggestion": "Use marketplace workflow: 1. /marketplace/list-with-price, 2. /marketplace/mark-paid, 3. /marketplace/release"
    }

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