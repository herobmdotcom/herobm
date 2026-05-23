import os
from sqlalchemy import create_engine
from sqlalchemy.engine import URL

host = "13.236.59.199"
database = "vau2010"
user = "mpg"
password = "@ThisIsForTesting26##"
port = "1433"

url = URL.create(
    drivername="mssql+pymssql",
    username=user,
    password=password,
    host=host,
    port=port,
    database=database,
    query={"login_timeout": "30", "timeout": "300"}
)

print("URL is:", url.render_as_string(hide_password=False))

try:
    engine = create_engine(url)
    with engine.connect() as conn:
        print("SQLAlchemy connected successfully!")
except Exception as e:
    print("SQLAlchemy connection failed:", e)

# Test raw string without query params
url2 = f"mssql+pymssql://mpg:%40ThisIsForTesting26%23%23@13.236.59.199:1433/vau2010"
try:
    engine2 = create_engine(url2)
    with engine2.connect() as conn:
        print("SQLAlchemy raw string connected successfully!")
except Exception as e:
    print("SQLAlchemy raw connection failed:", e)

