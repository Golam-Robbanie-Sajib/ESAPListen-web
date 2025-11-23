#!/usr/bin/env python3
"""
Migration: Add analytics fields to meetings table
Adds audio_duration and processing_time columns for analytics tracking
"""

import os
import sys
from sqlalchemy import create_engine, text

# Add parent directory to path to import database module
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import DATABASE_URL, IS_PRODUCTION, DB_FILE

def run_migration():
    """Add analytics columns to meetings table"""

    if IS_PRODUCTION:
        print("Running migration on PostgreSQL...")
        engine = create_engine(DATABASE_URL)
    else:
        print(f"Running migration on SQLite ({DB_FILE})...")
        engine = create_engine(f"sqlite:///{DB_FILE}")

    with engine.connect() as conn:
        try:
            # Check if columns already exist
            if IS_PRODUCTION:
                check_sql = """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name='meetings'
                AND column_name IN ('audio_duration', 'processing_time')
                """
            else:
                check_sql = "PRAGMA table_info(meetings)"

            result = conn.execute(text(check_sql))
            existing_columns = [row[0 if not IS_PRODUCTION else 0] for row in result]

            if IS_PRODUCTION:
                needs_migration = len(existing_columns) == 0
            else:
                existing_col_names = [row[1] for row in conn.execute(text(check_sql))]
                needs_migration = 'audio_duration' not in existing_col_names

            if not needs_migration:
                print("✓ Columns already exist, skipping migration")
                return

            print("Adding audio_duration and processing_time columns...")

            # Add columns
            conn.execute(text("ALTER TABLE meetings ADD COLUMN audio_duration INTEGER"))
            conn.execute(text("ALTER TABLE meetings ADD COLUMN processing_time INTEGER"))
            conn.commit()

            print("✓ Migration completed successfully!")

        except Exception as e:
            print(f"✗ Migration failed: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    run_migration()
