import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.read().splitlines()

    new_lines = []
    modified = False
    
    for i, line in enumerate(lines):
        if "material-symbols-outlined" in line:
            # Check if we already added a disregard
            if not new_lines or "eslint-disable-next-line i18next/no-literal-string" not in new_lines[-1]:
                indent = len(line) - len(line.lstrip())
                spaces = ' ' * indent
                
                # If the previous line ends with an opening parenthesis, or we are inside a map/ternary, it's vanilla JS evaluation.
                # A safe heuristic: If previous non-empty line ends with `(` or `{` or `:` or `=`.
                prev_line = ""
                for prev in reversed(new_lines):
                    if prev.strip() and "eslint-disable" not in prev:
                        prev_line = prev.strip()
                        break
                
                if prev_line.endswith('(') or prev_line.endswith(':') or prev_line.endswith('=>') or prev_line.endswith('&&'):
                     comment = f"{spaces}// eslint-disable-next-line i18next/no-literal-string"
                else:
                     comment = f"{spaces}{{/* eslint-disable-next-line i18next/no-literal-string */}}"
                     
                new_lines.append(comment)
                modified = True
                
        new_lines.append(line)
        
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines) + '\n')
        print(f"Modified {filepath}")

for root, dirs, files in os.walk('apps/ops-portal'):
    if 'node_modules' in root or '.next' in root:
        continue
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
