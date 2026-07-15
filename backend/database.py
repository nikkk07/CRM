import os
import psycopg
from contextlib import contextmanager
from dotenv import load_dotenv
from psycopg.conninfo import make_conninfo

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:root@localhost/crm_we_one")

# Parse and add connection pooling parameters for Supabase compatibility
conn_params = psycopg.conninfo.conninfo_to_dict(DATABASE_URL)
conn_params.update({
    'connect_timeout': '10',
    'keepalives': '1',
    'keepalives_idle': '30',
    'keepalives_interval': '10',
    'keepalives_count': '5'
})
DATABASE_URL_WITH_PARAMS = make_conninfo(**conn_params)

@contextmanager
def get_db():
    conn = psycopg.connect(DATABASE_URL_WITH_PARAMS)
    try:
        # Pool pre-ping equivalent: verify connection is alive
        conn.execute("SELECT 1")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def get_cursor(conn):
    return conn.cursor()
