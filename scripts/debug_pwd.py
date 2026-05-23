import os
import urllib.parse
from dotenv import load_dotenv

load_dotenv(".env.volzau")

password_raw = os.environ.get("ABM_MSSQL_PASSWORD")
print("Raw env var:", repr(password_raw))

stripped = password_raw.strip("\"'")
print("Stripped:", repr(stripped))

quoted = urllib.parse.quote_plus(stripped)
print("Quoted:", repr(quoted))

url_quoted = urllib.parse.quote(stripped)
print("URL Quoted:", repr(url_quoted))
