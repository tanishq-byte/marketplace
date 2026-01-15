from fastapi import FastAPI, UploadFile, File, HTTPException
import shutil
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from ocr_engine import extract_carbon_value

app = FastAPI()


# 1. MongoDB Configuration
MONGO_DETAILS = "mongodb+srv://carbon:<vvlOOrIv5dgmKRPX>@carboncred.3ifjahc.mongodb.net/?appName=carboncred" # Replace with your Atlas URI if needed
client = AsyncIOMotorClient(MONGO_DETAILS)
db = client.carbon_cred_db
companies_col = db.get_collection("companies")

@app.on_event("startup")
async def startup_db_client():
    print("Connecting to MongoDB Atlas...")
    try:
        # The 'ping' command is the standard way to check a connection
        await client.admin.command('ping')
        print("✅ SUCCESS: Connected to MongoDB Atlas!")
    except Exception as e:
        print("❌ ERROR: Could not connect to MongoDB!")
        print(f"Details: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close() #

@app.post("/phase1-minting/{company_name}")
async def mint_initial_credits(company_name: str, file: UploadFile = File(...)):
    file_path = f"uploads/start_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Run your OCR Engine
    prev_performance = extract_carbon_value(file_path)

    # 2. SAVE TO MONGODB (Upsert = Update or Insert)
    await companies_col.update_one(
        {"name": company_name},
        {"$set": {
            "initial_allowance": prev_performance,
            "minted_at": datetime.utcnow(),
            "status": "active"
        }},
        upsert=True
    )

    return {
        "status": "DATABASE_UPDATED",
        "company": company_name,
        "initial_allowance": prev_performance
    }

@app.post("/phase2-settlement/{company_name}")
async def verify_and_settle(company_name: str, file: UploadFile = File(...)):
    # 3. FETCH FROM MONGODB
    company_data = await companies_col.find_one({"name": company_name})
    if not company_data:
        raise HTTPException(status_code=404, detail="Company not found. Mint credits first.")

    file_path = f"uploads/end_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    current_consumption = extract_carbon_value(file_path)
    initial_allowance = company_data["initial_allowance"]
    
    diff = initial_allowance - current_consumption
    result_status = "SUCCESS" if diff >= 0 else "FAIL"

    # Update settlement record in MongoDB
    await companies_col.update_one(
        {"name": company_name},
        {"$set": {
            "last_verified_consumption": current_consumption,
            "compliance_result": result_status,
            "last_audit_date": datetime.utcnow()
        }}
    )

    return {
        "verified_consumption": current_consumption,
        "initial_allowance": initial_allowance,
        "net_balance": diff,
        "status": result_status
    }
@app.get("/leaderboard")
async def get_leaderboard():
    """
    Ranks companies based on their remaining carbon allowance.
    """
    # Fetch top 10 companies sorted by their allowance
    cursor = companies_col.find().sort("initial_allowance", -1).limit(10)
    
    rankings = []
    async for doc in cursor:
        allowance = doc.get("initial_allowance", 0)
        consumed = doc.get("last_verified_consumption", 0)
        surplus = allowance - consumed
        
        rankings.append({
            "company": doc["name"],
            "allowance": allowance,
            "used": consumed,
            "balance": surplus,
            "compliance": "GREEN" if surplus >= 0 else "RED (Penalty)"
        })
        
    return {"leaderboard": rankings}