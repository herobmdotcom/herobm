import os
import re

file_path = r'c:\Users\Marcel\volz\modbm\modbm\apps\api\src\payments\payments.service.spec.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

in_gl_accounts = False

for i, line in enumerate(lines):
    if 'pg.db.insert(glAccounts)' in line:
        in_gl_accounts = True
    
    if in_gl_accounts:
        if 'currencyCode: ' in line and 'isSystem' not in lines[i+1] and 'isBankAccount' not in lines[i+1]:
            # Some lines might have ' as any' on the next line or on the same line, let's just append right after currencyCode
            match = re.search(r'(currencyCode:\s*\'[A-Z]+\',)', line)
            if match:
                indent = re.match(r'^(\s*)', line).group(1)
                replacement = match.group(1) + f'\n{indent}isSystem: false,\n{indent}isBankAccount: false,'
                lines[i] = line.replace(match.group(1), replacement)
        
        # Determine when we exit the insert statement. Usually ends with ]); or });
        if line.strip() in (']);', '});', '] as any);', '} as any);'):
            in_gl_accounts = False

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
