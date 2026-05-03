import os
import glob
import re

MIGRATIONS_DIR = os.path.join("apps", "api", "migrations")

def generate_descriptive_name(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Try to find what it does
    if "CREATE TABLE" in content:
        match = re.search(r'CREATE TABLE (?:IF NOT EXISTS )?"(?:modbm_core)"\."([^"]+)"', content)
        if match:
            return f"create_{match.group(1)}"
    
    if "ALTER TABLE" in content:
        match = re.search(r'ALTER TABLE "(?:modbm_core)"\."([^"]+)" ADD COLUMN (?:IF NOT EXISTS )?"([^"]+)"', content)
        if match:
            return f"add_{match.group(2)}_to_{match.group(1)}"
        
        match = re.search(r'ALTER TABLE "(?:modbm_core)"\."([^"]+)" RENAME COLUMN "(?:[^"]+)" TO "([^"]+)"', content)
        if match:
            return f"rename_to_{match.group(2)}_in_{match.group(1)}"
            
        match = re.search(r'ALTER TABLE "(?:modbm_core)"\."([^"]+)" ADD CONSTRAINT "(?:[^"]+)" FOREIGN KEY', content)
        if match:
            return f"add_fk_to_{match.group(1)}"

    return "unknown"

def main():
    pattern = os.path.join(MIGRATIONS_DIR, "*.sql")
    all_files = sorted(glob.glob(pattern))
    
    for filepath in all_files:
        basename = os.path.basename(filepath)
        # Skip already descriptive names (e.g. they don't have random adjective-noun format)
        # Simple heuristic: if it has more than two underscores, it's probably custom.
        # But Drizzle names are usually adjective_noun.
        if "_" in basename:
            parts = basename.split("_")
            if len(parts) == 3 and parts[1].isalpha() and parts[2].split(".")[0].isalpha():
                desc = generate_descriptive_name(filepath)
                new_name = f"{parts[0]}_{desc}.sql"
                print(f"{basename} -> {new_name}")

if __name__ == "__main__":
    main()
