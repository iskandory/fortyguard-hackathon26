import os
from functools import lru_cache
from supabase import create_client, Client


@lru_cache
def get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, service_key)
