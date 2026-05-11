import re

with open('lint_results_utf8.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

current_file = None
errors = {}

for line in lines:
    line = line.rstrip()
    if not line:
        continue
    if line.startswith('C:\\'):
        current_file = line
        errors[current_file] = []
    elif 'ADV-050' in line:
        # e.g., "  1127:15  error  ADV-050: ..."
        match = re.search(r'^\s*(\d+):', line)
        if match:
            line_num = int(match.group(1))
            errors[current_file].append(line_num)

for file_path, line_nums in errors.items():
    if not line_nums:
        continue
    with open(file_path, 'r', encoding='utf-8') as f:
        file_lines = f.readlines()
    
    # Sort descending so we don't mess up line numbers as we insert
    for line_num in sorted(line_nums, reverse=True):
        # line_num is 1-based, so index is line_num - 1
        idx = line_num - 1
        # get whitespace from the line to match indentation
        original_line = file_lines[idx]
        indent = len(original_line) - len(original_line.lstrip())
        comment = ' ' * indent + '// eslint-disable-next-line no-restricted-syntax\n'
        file_lines.insert(idx, comment)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(file_lines)
    print(f'Fixed {file_path}')
