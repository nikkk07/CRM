import os
from contextlib import contextmanager
from dotenv import load_dotenv
import psycopg
from psycopg.conninfo import make_conninfo
from psycopg_pool import ConnectionPool

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:root@localhost/crm_we_one")

# Keepalives so pooled connections survive NAT / idle drops to a remote (Render) DB.
conn_params = psycopg.conninfo.conninfo_to_dict(DATABASE_URL)
conn_params.update({
    'connect_timeout': '10',
    'keepalives': '1',
    'keepalives_idle': '30',
    'keepalives_interval': '10',
    'keepalives_count': '5',
})
DATABASE_URL_WITH_PARAMS = make_conninfo(**conn_params)

# ── Connection pool ───────────────────────────────────────────────────────────
# Previously every get_db() opened a BRAND-NEW connection (full TCP+TLS+auth
# handshake to the remote DB) and ran a "SELECT 1" pre-ping — on every endpoint
# AND on the auth dependency, i.e. 2+ handshakes per request. That handshake was
# the dominant latency. A warm pool of reusable connections removes it entirely;
# the only per-request cost is now a cheap liveness check on an already-open
# connection.
POOL_MIN = int(os.getenv("DB_POOL_MIN", "2"))
POOL_MAX = int(os.getenv("DB_POOL_MAX", "10"))

pool = ConnectionPool(
    conninfo=DATABASE_URL_WITH_PARAMS,
    min_size=POOL_MIN,
    max_size=POOL_MAX,
    max_idle=300,                            # recycle idle connections after 5 min
    max_lifetime=1800,                       # hard-recycle any connection after 30 min
    timeout=10,                              # wait up to 10s for a free connection
    check=ConnectionPool.check_connection,   # cheap liveness check on checkout (auto-reconnect if dead)
    name="crm_pool",
    open=False,
)
# Open without blocking startup if the DB is briefly unreachable; the pool fills
# lazily and reconnects on its own.
pool.open(wait=False)


@contextmanager
def get_db():
    """Yield a pooled connection. Commits on clean exit, rolls back on error, and
    returns the connection to the pool (never closes the socket)."""
    with pool.connection() as conn:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def get_cursor(conn):
    return conn.cursor()
