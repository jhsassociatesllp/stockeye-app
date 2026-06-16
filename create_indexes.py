"""
Script to create MongoDB indexes for performance optimization
Run this once to create indexes on frequently queried fields
"""

from app.database import (
    audit_data_collection,
    temp_audit_data_collection,
    item_master_collection,
    warehouse_master_collection,
    task_assignments_collection,
    upload_history_collection,
    users
)

def create_indexes():
    print("Creating indexes for performance optimization...")
    
    # Audit Data Collection Indexes
    print("Creating indexes on audit_data_collection...")
    audit_data_collection.create_index([("user_id", 1)])
    audit_data_collection.create_index([("date", -1)])
    audit_data_collection.create_index([("submitted_at", -1)])
    audit_data_collection.create_index([("sections.general_report.warehouse_name", 1)])
    audit_data_collection.create_index([("warehouse_name", 1)])
    
    # Temp Audit Data Collection Indexes
    print("Creating indexes on temp_audit_data_collection...")
    temp_audit_data_collection.create_index([("user_id", 1)])
    temp_audit_data_collection.create_index([("date", -1)])
    temp_audit_data_collection.create_index([("sections.general_report.warehouse_name", 1)])
    temp_audit_data_collection.create_index([("warehouse_name", 1)])
    
    # Item Master Collection Indexes
    print("Creating indexes on item_master_collection...")
    item_master_collection.create_index([("item_code", 1)])
    item_master_collection.create_index([("sheet_name", 1)])
    
    # Warehouse Master Collection Indexes
    print("Creating indexes on warehouse_master_collection...")
    warehouse_master_collection.create_index([("warehouse_name", 1)])
    
    # Task Assignments Collection Indexes
    print("Creating indexes on task_assignments_collection...")
    task_assignments_collection.create_index([("assigned_to", 1)])
    task_assignments_collection.create_index([("due_date", -1)])
    task_assignments_collection.create_index([("warehouse_name", 1)])
    task_assignments_collection.create_index([("status", 1)])
    
    # Upload History Collection Indexes
    print("Creating indexes on upload_history_collection...")
    upload_history_collection.create_index([("uploaded_at", -1)])
    upload_history_collection.create_index([("uploaded_by", 1)])
    
    # Users Collection Indexes
    print("Creating indexes on users collection...")
    users.create_index([("email", 1)], unique=True)
    
    print("✅ All indexes created successfully!")
    print("\nCreated indexes:")
    print("- audit_data_collection: user_id, date, submitted_at, warehouse_name")
    print("- temp_audit_data_collection: user_id, date, warehouse_name")
    print("- item_master_collection: item_code, sheet_name")
    print("- warehouse_master_collection: warehouse_name")
    print("- task_assignments_collection: assigned_to, due_date, warehouse_name, status")
    print("- upload_history_collection: uploaded_at, uploaded_by")
    print("- users: email (unique)")

if __name__ == "__main__":
    try:
        create_indexes()
    except Exception as e:
        print(f"❌ Error creating indexes: {e}")
