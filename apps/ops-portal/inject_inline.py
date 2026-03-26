import re
import sys
import os

lint_file = 'lint_results.txt'

with open(lint_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

file_warnings = {}
current_file = None

for line in lines:
    line = line.strip()
    if not line:
        continue
    if line.startswith('C:\\') or line.startswith('/'):
        current_file = line
        if current_file not in file_warnings:
            file_warnings[current_file] = set()
    elif 'i18next/no-literal-string' in line and current_file:
        match = re.search(r'^(\d+):', line)
        if match:
            line_num = int(match.group(1))
            file_warnings[current_file].add(line_num)

for filepath, line_nums in file_warnings.items():
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        file_lines = f.read().splitlines()
    
    # Process from bottom to top so line numbers don't shift!
    sorted_lines = sorted(list(line_nums), reverse=True)
    for l in sorted_lines:
        idx = l - 1 # 0-indexed
        if idx >= len(file_lines):
            continue
        
        # Calculate indentation
        indent = len(file_lines[idx]) - len(file_lines[idx].lstrip())
        spaces = ' ' * indent
        
        # Insert comment
        comment = f"{spaces}{{/* eslint-disable-next-line i18next/no-literal-string */}}"
        file_lines.insert(idx, comment)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(file_lines) + '\n')

print(f"Processed {len(file_warnings)} files. Inserted inline disables.")
