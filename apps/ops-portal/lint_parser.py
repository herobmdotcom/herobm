import json
import sys

try:
    with open('lint_results_cmd.json', 'r', encoding='utf-8') as f:
        results = json.load(f)
except Exception as e:
    print(f"Error loading JSON: {e}")
    sys.exit(1)

for file_result in results:
    messages = [m for m in file_result.get('messages', []) if m.get('ruleId') == 'i18next/no-literal-string']
    if messages:
        print(f"\n{file_result['filePath']}:")
        for m in messages:
            print(f"  Line {m['line']}: {m['message']}")
