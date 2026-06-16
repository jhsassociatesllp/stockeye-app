# Performance Optimization Guide

## ✅ Completed Optimizations

### 1. Database Indexes Created
All indexes have been successfully created:
- `audit_data_collection`: user_id, date, submitted_at, warehouse_name
- `temp_audit_data_collection`: user_id, date, warehouse_name  
- `item_master_collection`: item_code, sheet_name
- `warehouse_master_collection`: warehouse_name
- `task_assignments_collection`: assigned_to, due_date, warehouse_name, status
- `upload_history_collection`: uploaded_at, uploaded_by
- `users`: email (unique)

**Expected Impact:** 5-10x faster queries

### 2. Query Optimizations Applied
- Added projections to fetch only needed fields
- Limited results to 100 most recent records
- Sorted on database side instead of in memory

---

## 🔍 Additional Optimizations Needed

### Check 1: Verify Indexes Are Being Used

Run this in MongoDB shell or compass to check if indexes are active:

```javascript
// Check audit_data_collection indexes
db.audit_data_collection.getIndexes()

// Explain a query to see if index is used
db.audit_data_collection.find({}).sort({submitted_at: -1}).limit(100).explain("executionStats")
```

**Look for:** `"executionStats.totalDocsExamined"` should be close to `"executionStats.nReturned"`

---

### Check 2: MongoDB Connection Performance

Your MongoDB is on remote server: `mongodb://45.198.225.149:27017/`

**Test connection latency:**
```bash
ping 45.198.225.149
```

**If ping is > 100ms:**
- Consider using MongoDB connection pooling (already enabled)
- Check if server is under load
- Consider hosting MongoDB closer to application server

---

### Check 3: Review Recent User Name Lookups

We added user name lookups which add one extra query per API call.

**Current implementation (OPTIMIZED):**
```python
# Single query for all users
user_name_map = {}
for user in users.find({"email": {"$in": list(user_ids)}}):
    user_name_map[user["email"]] = user.get("name", user["email"])
```

This is already optimal - uses `$in` operator to fetch all users in one query.

---

## 🚀 Quick Performance Tests

### Test 1: Check API Response Times

Open browser DevTools (F12) → Network tab:

**Before optimization:** 2-5 seconds
**Target after optimization:** 200-500ms

### Test 2: Check Database Query Time

Check server logs for query execution time:
```
INFO: Audit dashboard fetched in 234ms
```

---

## ⚡ Quick Fixes If Still Slow

### Fix 1: Reduce Limit on Large Collections

If you have thousands of audits, reduce the limit:

```python
# Current: limit(100)
# Change to: limit(50) or limit(25)
submitted = list(audit_data_collection.find({}, projection).sort("submitted_at", -1).limit(50))
```

**File:** `app/main.py` - line ~1545

---

### Fix 2: Add Date Range Filter

Instead of fetching all audits, fetch only recent ones:

```python
from datetime import datetime, timedelta

# Get audits from last 30 days only
date_limit = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
query = {"date": {"$gte": date_limit}}

submitted = list(audit_data_collection.find(query, projection).sort("submitted_at", -1).limit(100))
in_progress = list(temp_audit_data_collection.find(query, projection).sort("date", -1).limit(100))
```

---

### Fix 3: Cache User Names

If user list doesn't change often, cache user names in memory:

```python
# At top of file
USER_NAME_CACHE = {}
CACHE_TIMESTAMP = None

def get_user_names(user_emails):
    global USER_NAME_CACHE, CACHE_TIMESTAMP
    from datetime import datetime, timedelta
    
    # Refresh cache every 10 minutes
    if not CACHE_TIMESTAMP or datetime.now() - CACHE_TIMESTAMP > timedelta(minutes=10):
        all_users = list(users.find({}, {"_id": 0, "email": 1, "name": 1}))
        USER_NAME_CACHE = {u["email"]: u.get("name", u["email"]) for u in all_users}
        CACHE_TIMESTAMP = datetime.now()
    
    return {email: USER_NAME_CACHE.get(email, email) for email in user_emails}
```

---

## 📊 Monitor Performance

### Check Server Logs

Look for these patterns:

**Good:**
```
INFO: 127.0.0.1:50452 - "GET /api/admin/audit-dashboard HTTP/1.1" 200 OK (0.234s)
```

**Bad:**
```
INFO: 127.0.0.1:50452 - "GET /api/admin/audit-dashboard HTTP/1.1" 200 OK (3.456s)
```

---

### Check Browser Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Reload admin page
4. Look at API call times

**Slow APIs to watch:**
- `/api/admin/audit-dashboard` - Should be < 500ms
- `/api/admin/stock-reconciliation` - Should be < 500ms
- `/api/admin/warehouse-status` - Should be < 300ms

---

## 🎯 Expected Performance After All Fixes

| Endpoint | Before | Target | Status |
|----------|--------|--------|--------|
| Audit Dashboard | 2-3s | 300-500ms | ✅ Indexed |
| Stock Reconciliation | 1-2s | 200-400ms | ✅ Indexed |
| Warehouse Status | 1-2s | 200-300ms | ✅ Indexed |
| Upload History | Error | 100-200ms | ✅ Fixed |
| Analytics | 2-3s | 400-600ms | ✅ Indexed |

---

## 🔧 If Still Slow After Indexes

### 1. Check MongoDB Server Load
```bash
# SSH to MongoDB server
ssh user@45.198.225.149

# Check CPU/Memory
top

# Check MongoDB stats
mongo
> db.serverStatus()
```

### 2. Check Network Latency
```bash
# From application server
ping 45.198.225.149
# Should be < 50ms for good performance
```

### 3. Restart FastAPI Server
```bash
# Stop current server (Ctrl+C)
# Restart:
uvicorn app.main:app --reload
```

### 4. Clear MongoDB Collection Stats
```javascript
// In MongoDB shell
db.audit_data_collection.stats()
db.temp_audit_data_collection.stats()

// If collection is fragmented, compact it
db.runCommand({compact: 'audit_data_collection'})
```

---

## 📝 Performance Checklist

After running indexes, verify:

- [ ] Restart FastAPI server
- [ ] Clear browser cache (Ctrl+F5)
- [ ] Test Audit Dashboard - should load < 500ms
- [ ] Test Stock Reconciliation - should load < 500ms
- [ ] Test Warehouse Status - should load < 300ms
- [ ] Check browser Network tab for actual timings
- [ ] Check server logs for any ERROR messages
- [ ] Ping MongoDB server < 100ms latency

---

**Status:** ✅ Indexes Created  
**Next Step:** Restart server and test performance  
**Date:** June 11, 2026
