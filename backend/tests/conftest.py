import os

# Tests never touch the real database or Supabase
os.environ["DATABASE_URL"] = ""
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
