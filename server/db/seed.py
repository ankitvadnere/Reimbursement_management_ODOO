"""
seed.py
Run once at server startup (or manually via `python -m db.seed`).
  1. Executes schema.sql  (CREATE TABLE IF NOT EXISTS, triggers)
  2. Inserts exchange rates and countries from JSON files
  3. Creates a default admin user if none exists
"""

import os
import json
import bcrypt
from pathlib import Path
from db.connection import get_conn, release_conn

BASE = Path(__file__).parent          # server/db/


def run_schema(cur):
    schema = (BASE / "schema.sql").read_text()
    cur.execute(schema)
    print("[seed] schema applied")


def seed_exchange_rates(cur):
    rates_file = BASE / "exchange_rates.json"
    if not rates_file.exists():
        print("[seed] exchange_rates.json not found — skipping")
        return

    rates = json.loads(rates_file.read_text())
    for currency, rate in rates.items():
        cur.execute("""
            INSERT INTO exchange_rates (currency, rate_to_inr)
            VALUES (%s, %s)
            ON CONFLICT (currency) DO UPDATE SET rate_to_inr = EXCLUDED.rate_to_inr
        """, (currency.upper(), rate))
    print(f"[seed] {len(rates)} exchange rates loaded")


def seed_countries(cur):
    countries_file = BASE / "countries.json"
    if not countries_file.exists():
        print("[seed] countries.json not found — skipping")
        return

    countries = json.loads(countries_file.read_text())
    for c in countries:
        cur.execute("""
            INSERT INTO countries (code, name, currency)
            VALUES (%s, %s, %s)
            ON CONFLICT (code) DO NOTHING
        """, (c["code"], c["name"], c["currency"]))
    print(f"[seed] {len(countries)} countries loaded")


def seed_default_users(cur):
    """Create one user of each role if the users table is empty."""
    cur.execute("SELECT COUNT(*) FROM users")
    count = cur.fetchone()[0]
    if count > 0:
        print("[seed] users already exist — skipping default users")
        return

    defaults = [
        ("Admin User",    "admin@company.com",    "admin123",    "admin"),
        ("Finance User",  "finance@company.com",  "finance123",  "finance"),
        ("Manager One",   "manager@company.com",  "manager123",  "manager"),
        ("Employee One",  "employee@company.com", "employee123", "employee"),
    ]

    created_ids = {}
    for name, email, password, role in defaults:
        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        cur.execute("""
            INSERT INTO users (name, email, password, role, country)
            VALUES (%s, %s, %s, %s::user_role, 'IN')
            RETURNING id
        """, (name, email, hashed, role))
        uid = cur.fetchone()[0]
        created_ids[role] = uid
        print(f"[seed] created {role}: {email} / {password}")

    # Link employee → manager
    if "employee" in created_ids and "manager" in created_ids:
        cur.execute("""
            UPDATE users SET manager_id = %s WHERE id = %s
        """, (created_ids["manager"], created_ids["employee"]))
        print("[seed] employee linked to manager")


def seed_approval_rules(cur):
    cur.execute("SELECT COUNT(*) FROM approval_rules")
    if cur.fetchone()[0] > 0:
        print("[seed] approval rules already exist — skipping")
        return

    cur.execute("""
        INSERT INTO approval_rules (name, min_amount_inr, max_amount_inr, required_roles) VALUES
        ('Standard',   0,      9999.99, ARRAY['manager']::user_role[]),
        ('High-value', 10000,  NULL,    ARRAY['manager', 'finance']::user_role[])
    """)
    print("[seed] default approval rules inserted")


def run():
    conn = get_conn()
    try:
        cur = conn.cursor()
        run_schema(cur)
        seed_exchange_rates(cur)
        seed_countries(cur)
        seed_approval_rules(cur)
        seed_default_users(cur)
        conn.commit()
        cur.close()
        print("[seed] all done ✓")
    except Exception as e:
        conn.rollback()
        print(f"[seed] FAILED: {e}")
        raise
    finally:
        release_conn(conn)


if __name__ == "__main__":
    run()