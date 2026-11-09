"""Explicit operator connection selection; never borrow the plugin's identity."""
import os


def client_environment():
    if not os.environ.get('PGSERVICE'):
        raise ValueError('Select an owner-approved PGSERVICE before database access')
    return {**os.environ, 'PGCONNECT_TIMEOUT': '10', 'PGAPPNAME': 'stock-migration-tools'}


def secure_connection_sql():
    # Unix sockets are local; every TCP connection must negotiate PostgreSQL TLS.
    # verify-full hostname/CA is additionally required in the private PGSERVICE.
    return "SELECT 1 / (inet_client_addr() IS NULL OR coalesce((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false))::int;"
