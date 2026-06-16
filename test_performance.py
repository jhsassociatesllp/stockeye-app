"""
Quick performance test script to diagnose slow API issues
"""

import time
from app.database import audit_data_collection, temp_audit_data_collection, users

def test_database_performance():
    print("=" * 60)
    print("📊 DATABASE PERFORMANCE TEST")
    print("=" * 60)
    
    # Test 1: Connection latency
    print("\n1️⃣  Testing MongoDB connection...")
    start = time.time()
    count = audit_data_collection.count_documents({})
    latency = (time.time() - start) * 1000
    print(f"   ✓ Connection latency: {latency:.2f}ms")
    print(f"   ✓ Total audit records: {count}")
    
    # Test 2: Query with index
    print("\n2️⃣  Testing indexed query (with date sort)...")
    start = time.time()
    results = list(audit_data_collection.find({}, {"_id": 0, "user_id": 1, "date": 1}).sort("submitted_at", -1).limit(100))
    query_time = (time.time() - start) * 1000
    print(f"   ✓ Query time: {query_time:.2f}ms")
    print(f"   ✓ Records fetched: {len(results)}")
    
    if query_time > 500:
        print("   ⚠️  WARNING: Query is slow (> 500ms)")
        print("   → Check if indexes are being used")
        print("   → Consider reducing limit or adding date range filter")
    else:
        print("   ✅ Query performance is GOOD")
    
    # Test 3: User name lookup
    print("\n3️⃣  Testing user name lookup...")
    start = time.time()
    user_emails = set([r.get("user_id") for r in results if r.get("user_id")])
    user_count = len(user_emails)
    
    user_results = list(users.find({"email": {"$in": list(user_emails)}}, {"_id": 0, "email": 1, "name": 1}))
    lookup_time = (time.time() - start) * 1000
    print(f"   ✓ Lookup time: {lookup_time:.2f}ms")
    print(f"   ✓ Unique users: {user_count}")
    print(f"   ✓ Names found: {len(user_results)}")
    
    if lookup_time > 100:
        print("   ⚠️  User lookup is slow")
        print("   → Consider caching user names")
    else:
        print("   ✅ User lookup performance is GOOD")
    
    # Test 4: Check indexes
    print("\n4️⃣  Checking indexes...")
    indexes = audit_data_collection.index_information()
    print(f"   ✓ Indexes on audit_data_collection: {len(indexes)}")
    for idx_name, idx_info in indexes.items():
        if idx_name != '_id_':
            print(f"      - {idx_name}: {idx_info['key']}")
    
    # Test 5: Stock count data query
    print("\n5️⃣  Testing stock count query...")
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    
    start = time.time()
    temp_audits = list(temp_audit_data_collection.find({"date": today}))
    submitted_audits = list(audit_data_collection.find({"date": today}))
    all_audits = temp_audits + submitted_audits
    
    stock_count_items = 0
    for audit in all_audits:
        stock_count_data = audit.get("stock_count_data", [])
        stock_count_items += len(stock_count_data)
    
    sc_query_time = (time.time() - start) * 1000
    print(f"   ✓ Query time: {sc_query_time:.2f}ms")
    print(f"   ✓ Audits found: {len(all_audits)}")
    print(f"   ✓ Stock count items: {stock_count_items}")
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 SUMMARY")
    print("=" * 60)
    
    total_time = latency + query_time + lookup_time + sc_query_time
    print(f"\nTotal test time: {total_time:.2f}ms")
    
    if total_time < 1000:
        print("✅ Database performance is EXCELLENT")
    elif total_time < 2000:
        print("✅ Database performance is GOOD")
    elif total_time < 3000:
        print("⚠️  Database performance is ACCEPTABLE")
    else:
        print("❌ Database performance needs improvement")
    
    print("\n📊 Performance Breakdown:")
    print(f"   - Connection: {latency:.2f}ms ({latency/total_time*100:.1f}%)")
    print(f"   - Audit query: {query_time:.2f}ms ({query_time/total_time*100:.1f}%)")
    print(f"   - User lookup: {lookup_time:.2f}ms ({lookup_time/total_time*100:.1f}%)")
    print(f"   - Stock count: {sc_query_time:.2f}ms ({sc_query_time/total_time*100:.1f}%)")
    
    print("\n" + "=" * 60)
    
    return total_time < 2000

if __name__ == "__main__":
    try:
        success = test_database_performance()
        if not success:
            print("\n💡 RECOMMENDATIONS:")
            print("   1. Check MongoDB server load")
            print("   2. Verify network latency: ping 45.198.225.149")
            print("   3. Consider adding date range filter to queries")
            print("   4. Restart FastAPI server")
    except Exception as e:
        print(f"\n❌ Error running performance test: {e}")
        print(f"   Make sure the server is running and database is accessible")
