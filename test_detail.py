import asyncio
from app.main import admin_audit_detail
from app.database import audit_data_collection, admins_collection

async def main():
    # Find a sample audit record
    audit = audit_data_collection.find_one()
    if not audit:
        from app.database import temp_audit_data_collection
        audit = temp_audit_data_collection.find_one()
        
    if not audit:
        print("❌ No audit records found in database.")
        return
        
    user_id = audit.get("user_id")
    date = audit.get("date")
    print(f"🔍 Testing admin_audit_detail for user: {user_id}, date: {date}")
    
    # Find a sample admin
    admin = admins_collection.find_one()
    if not admin:
        print("⚠️ No admin found in Admins collection, using dummy admin email.")
        admin_email = "admin@example.com"
    else:
        admin_email = admin.get("email")
        print(f"👑 Using admin email: {admin_email}")
        
    try:
        response = await admin_audit_detail(user_id, date, emp_id=admin_email)
        print(f"✅ Response status: {response.status_code}")
        print(f"📄 Response body: {response.body.decode('utf-8', errors='ignore')}")
    except Exception as e:
        print(f"❌ Exception raised: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
