import os
import re
import sys

# Patterns to look for: 'EUR', 'USD', 'GBP', etc. in single or double quotes
# excluding the shared package and migrations
CURRENCY_PATTERN = re.compile(r"(['\"])(EUR|USD|GBP|AUD|CAD|JPY|ZAR|SGD|NZD)\1")
EXCLUDED_DIRS = {
    'node_modules',
    '.next',
    'dist',
    'migrations',
    'packages/shared/src', # Source of truth
    'brain'
}

def check_files():
    errors = []
    root_dir = os.getcwd()
    
    for root, dirs, files in os.walk(root_dir):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if os.path.join(os.path.relpath(root, root_dir), d).replace('\\', '/') not in EXCLUDED_DIRS]
        
        for file in files:
            if not file.endswith(('.ts', '.tsx', '.py', '.sql')):
                continue
            
            # Skip the guard script itself
            if file == 'currency-guard.py':
                continue
            if file == 'seed.py': # Seed script is allowed to have them for defaults/prompts
                continue

            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, root_dir)
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        # Simple heuristic: ignore comments and imports
                        if line.strip().startswith(('import ', '//', '*', '/*')):
                            continue
                        
                        match = CURRENCY_PATTERN.search(line)
                        if match:
                            # Additional check: ignore if it looks like a type or a legitimate reference
                            # e.g. currency_code: 'EUR' (bad) vs CurrencyCode = 'EUR' (maybe okay but let's be strict)
                            # We allow it in tests for now if needed, but let's start strict.
                            errors.append(f"{rel_path}:{line_num}: Found hardcoded currency {match.group(0)}")
            except Exception as e:
                # print(f"Could not read {file_path}: {e}")
                pass
                
    return errors

if __name__ == "__main__":
    print("Running Currency Structural Guard...")
    violations = check_files()
    if violations:
        print(f"FAILED: Found {len(violations)} currency violations:")
        for v in violations:
            print(f"  {v}")
        sys.exit(1)
    else:
        print("PASSED: No hardcoded currency fallbacks found.")
        sys.exit(0)
