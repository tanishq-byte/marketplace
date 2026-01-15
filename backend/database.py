from motor.motor_asyncio import AsyncIOMotorClient

# Connect to a local MongoDB instance
# If using MongoDB Atlas, replace with your connection string
MONGO_URL = "mongodb+srv://carbon:<vvlOOrIv5dgmKRPX>@carboncred.3ifjahc.mongodb.net/?appName=carboncred"
client = AsyncIOMotorClient(MONGO_URL)
db = client.carbon_cred_db

# Collections (like 'Tables' in SQL)
companies_col = db.get_collection("companies")
reports_col = db.get_collection("reports")