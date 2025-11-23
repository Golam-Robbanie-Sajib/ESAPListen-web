#!/usr/bin/env python3
"""
Migration script to add github_id column to users table if it doesn't exist.
Run this script if you encounter "no such column: users.github_id" error.

Usage: python migrate_add_github_id.py
"""

import sqlite3
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_add_github_id():
    """Add github_id column to users table if it doesn't exist"""

    # Check if we're using SQLite (local development)
    if os.getenv("DATABASE_URL"):
        logger.error("This migration script is only for local SQLite databases.")
        logger.error("For PostgreSQL, please use proper migration tools like Alembic.")
        return

    db_file = "meetings.db"

    if not os.path.exists(db_file):
        logger.info(f"✓ Database file {db_file} doesn't exist yet. No migration needed.")
        logger.info("  The database will be created with all columns when the backend starts.")
        return

    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    try:
        # Check if github_id column exists
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]

        if 'github_id' in columns:
            logger.info("✓ Column 'github_id' already exists in users table. No migration needed.")
        else:
            logger.info("Adding 'github_id' column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN github_id VARCHAR UNIQUE")

            # Create index for github_id
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_users_github_id ON users (github_id)")

            conn.commit()
            logger.info("✓ Successfully added 'github_id' column and index to users table.")

    except sqlite3.Error as e:
        logger.error(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_add_github_id()
