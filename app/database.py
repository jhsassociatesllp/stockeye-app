import os
from dotenv import load_dotenv
# import motor.motor_asyncio
from pymongo import MongoClient

load_dotenv()

MONGO_URI = os.getenv("MONGO_CONNECTION_STRING")
print(MONGO_URI)

client = MongoClient(MONGO_URI)

db = client["Audit_App"]  # Database name
users = db["Users"]
temp_audit_data_collection = db["Audit_Data"]
audit_data_collection = db["audit_data_collection"]