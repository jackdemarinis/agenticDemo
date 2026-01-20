"""Migration script to add sign_off column to runs table."""
import sqlite3
import os

# Get database path
db_path = os.getenv("DATABASE_URL", "sqlite:///./draftsmith.db").replace("sqlite:///", "")

print(f"Migrating database: {db_path}")

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if column already exists
    cursor.execute("PRAGMA table_info(runs)")
    columns = [col[1] for col in cursor.fetchall()]

    if 'sign_off' not in columns:
        print("Adding sign_off column to runs table...")
        cursor.execute("ALTER TABLE runs ADD COLUMN sign_off TEXT")
        conn.commit()
        print("✓ Migration completed successfully!")
    else:
        print("✓ sign_off column already exists, no migration needed.")

except Exception as e:
    print(f"✗ Migration failed: {e}")
    conn.rollback()
finally:
    conn.close()
