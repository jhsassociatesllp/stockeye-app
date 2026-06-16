"""
Quick verification script to check if all fixes are properly deployed
Run this after restarting the server to verify everything is working
"""

import sys
import os

def check_imports():
    """Check if all required imports are present in main.py"""
    print("\n1️⃣  Checking imports...")
    
    try:
        with open('app/main.py', 'r', encoding='utf-8') as f:
            content = f.read()
            
        required_imports = [
            'from email.mime.multipart import MIMEMultipart',
            'from email.mime.text import MIMEText',
            'def send_email_notification'
        ]
        
        missing = []
        for imp in required_imports:
            if imp not in content:
                missing.append(imp)
        
        if missing:
            print("   ❌ Missing imports:")
            for m in missing:
                print(f"      - {m}")
            return False
        else:
            print("   ✅ All required imports present")
            return True
            
    except Exception as e:
        print(f"   ❌ Error reading main.py: {e}")
        return False

def check_env_file():
    """Check if .env file has email credentials"""
    print("\n2️⃣  Checking email configuration...")
    
    try:
        with open('.env', 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'MAIL_USERNAME' in content and 'MAIL_PASSWORD' in content:
            print("   ✅ Email credentials configured")
            
            # Extract values
            for line in content.split('\n'):
                if line.startswith('MAIL_USERNAME'):
                    username = line.split('=')[1].strip().strip('"')
                    print(f"      📧 Username: {username}")
                if line.startswith('MAIL_PASSWORD'):
                    password = line.split('=')[1].strip().strip('"')
                    # Mask password except first/last 4 chars
                    if len(password) > 8:
                        masked = password[:4] + '*' * (len(password)-8) + password[-4:]
                    else:
                        masked = '*' * len(password)
                    print(f"      🔑 Password: {masked}")
            return True
        else:
            print("   ❌ Email credentials not configured in .env")
            return False
            
    except Exception as e:
        print(f"   ❌ Error reading .env: {e}")
        return False

def check_index_script():
    """Check if create_indexes.py exists"""
    print("\n3️⃣  Checking index creation script...")
    
    if os.path.exists('create_indexes.py'):
        print("   ✅ create_indexes.py found")
        print("   💡 Run: python create_indexes.py")
        return True
    else:
        print("   ❌ create_indexes.py not found")
        return False

def check_documentation():
    """Check if documentation files exist"""
    print("\n4️⃣  Checking documentation...")
    
    docs = [
        'ALL_BUGS_FIXED_SUMMARY.md',
        'EMAIL_NOTIFICATION_FIX.md',
        'DEPLOYMENT_STEPS.md',
        'READY_TO_DEPLOY.md'
    ]
    
    all_present = True
    for doc in docs:
        if os.path.exists(doc):
            print(f"   ✅ {doc}")
        else:
            print(f"   ❌ {doc} missing")
            all_present = False
    
    return all_present

def check_database_connection():
    """Check if database connection is working"""
    print("\n5️⃣  Checking database connection...")
    
    try:
        from app.database import audit_data_collection
        
        # Try to count documents
        count = audit_data_collection.count_documents({})
        print(f"   ✅ Database connected (found {count} audit records)")
        return True
        
    except Exception as e:
        print(f"   ❌ Database connection failed: {e}")
        return False

def main():
    print("=" * 60)
    print("🔍 STOCKEYE APP - DEPLOYMENT VERIFICATION")
    print("=" * 60)
    
    results = []
    
    # Run all checks
    results.append(("Imports", check_imports()))
    results.append(("Email Config", check_env_file()))
    results.append(("Index Script", check_index_script()))
    results.append(("Documentation", check_documentation()))
    results.append(("Database", check_database_connection()))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 VERIFICATION SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    print(f"\n{'✅' if passed == total else '⚠️'}  {passed}/{total} checks passed")
    
    if passed == total:
        print("\n🎉 All checks passed! Ready to deploy.")
        print("\n📝 Next steps:")
        print("   1. Restart server: uvicorn app.main:app --reload")
        print("   2. Create indexes: python create_indexes.py")
        print("   3. Test the application")
        print("   4. Check READY_TO_DEPLOY.md for testing checklist")
    else:
        print("\n⚠️  Some checks failed. Please review the errors above.")
        print("   Check the documentation files for troubleshooting.")
    
    print("\n" + "=" * 60)
    
    return passed == total

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Verification failed with error: {e}")
        sys.exit(1)
