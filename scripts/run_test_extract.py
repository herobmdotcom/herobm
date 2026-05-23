import os
from dotenv import load_dotenv

# Load .env.volzau directly, bypassing Make's '#' parsing bug
load_dotenv(".env.volzau")

print("Running extraction for LEDGER...")
# Run extraction
ret = os.system("python pipelines/abm_extract/pipeline.py --table LEDGER")
if ret != 0:
    print("Extraction failed!")
    exit(1)

print("Extraction complete.")
