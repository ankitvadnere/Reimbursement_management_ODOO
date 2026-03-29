import os
import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

_pool = None

def get_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=os.getenv("DATABASE_URL"),
        )
    return _pool

def get_conn():
    return get_pool().getconn()

def release_conn(conn):
    get_pool().putconn(conn)

class db:
    """Context manager — auto-commits and releases connection."""
    def __enter__(self):
        self.conn = get_conn()
        self.cur  = self.conn.cursor()
        return self.cur

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.conn.rollback()
        else:
            self.conn.commit()
        self.cur.close()
        release_conn(self.conn)
        return False   # re-raise exceptions