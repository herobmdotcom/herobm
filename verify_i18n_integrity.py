import json
import sys
import os

def get_paths(obj, current_path=""):
    paths = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_path = f"{current_path}.{k}" if current_path else k
            paths.append(new_path)
            paths.extend(get_paths(v, new_path))
    return paths

def main():
    if len(sys.argv) < 2:
        print("Usage: python verify_i18n_integrity.py <command>")
        print("Commands: snapshot, verify")
        sys.exit(1)
        
    cmd = sys.argv[1]
    
    with open('apps/ops-portal/messages/en.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    current_paths = set(get_paths(data))
    
    schema_file = 'apps/ops-portal/messages/en.schema.json'
    
    if cmd == 'snapshot':
        with open(schema_file, 'w', encoding='utf-8') as f:
            json.dump(sorted(list(current_paths)), f, indent=2)
        print(f"Snapshot created at {schema_file} with {len(current_paths)} keys.")
        
    elif cmd == 'verify':
        if not os.path.exists(schema_file):
            print("No schema snapshot found. Please run 'snapshot' first.")
            sys.exit(1)
            
        with open(schema_file, 'r', encoding='utf-8') as f:
            baseline_paths = set(json.load(f))
            
        missing_paths = baseline_paths - current_paths
        
        if missing_paths:
            print(f"ERROR: {len(missing_paths)} keys have been lost from en.json!")
            for p in sorted(missing_paths):
                print(f"  - {p}")
            sys.exit(1)
        else:
            print("Integrity check passed: No keys lost.")
            
if __name__ == "__main__":
    main()
