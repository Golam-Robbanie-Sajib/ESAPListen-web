"""
Migration script to add audio_duration and processing_time columns to existing database.
Run this once to update your database schema.
"""
import sqlite3
import os

# Get database path
db_path = os.path.join(os.path.dirname(__file__), "meetings.db")

print(f"Migrating database: {db_path}")

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if columns exist
    cursor.execute("PRAGMA table_info(meetings)")
    columns = [column[1] for column in cursor.fetchall()]
    
    print(f"Existing columns: {columns}")
    
    # Add audio_duration column if it doesn't exist
    if 'audio_duration' not in columns:
        print("Adding audio_duration column...")
        cursor.execute("ALTER TABLE meetings ADD COLUMN audio_duration INTEGER")
        print("✓ Added audio_duration column")
    else:
        print("✓ audio_duration column already exists")
    
    # Add processing_time column if it doesn't exist
    if 'processing_time' not in columns:
        print("Adding processing_time column...")
        cursor.execute("ALTER TABLE meetings ADD COLUMN processing_time INTEGER")
        print("✓ Added processing_time column")
    else:
        print("✓ processing_time column already exists")
    
    # Commit changes
    conn.commit()
    print("\n✅ Migration completed successfully!")
    
    # Show sample data
    print("\nSample meeting data:")
    cursor.execute("SELECT job_id, audio_duration, processing_time FROM meetings LIMIT 5")
    for row in cursor.fetchall():
        print(f"  {row[0]}: duration={row[1]}, processing_time={row[2]}")
    
except Exception as e:
    print(f"❌ Migration failed: {e}")
    conn.rollback()
finally:
    conn.close()

print("\nYou can now restart your backend server and process new meetings.")
print("New meetings will have duration data, old meetings will show NULL (which is normal).")
