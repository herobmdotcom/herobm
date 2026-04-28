import os
import glob
import re

search_path = r'c:\Users\Marcel\volz\modbm\modbm\apps\ops-portal\app'
files_to_process = glob.glob(search_path + '/**/*.tsx', recursive=True)

for file in files_to_process:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'HOME_CURRENCY' not in content:
        continue

    print(f"Processing {file}")

    # 1. Handle imports
    # Case A: import { HOME_CURRENCY } from '@/lib/currency';
    content = re.sub(r"import\s*\{\s*HOME_CURRENCY\s*\}\s*from\s*'@/lib/currency';\n?", "", content)
    # Case B: import { formatAmount, HOME_CURRENCY } from '@/lib/currency';
    content = re.sub(r"import\s*\{\s*([^,]+),\s*HOME_CURRENCY\s*\}\s*from\s*'@/lib/currency';", r"import { \1 } from '@/lib/currency';", content)
    # Case C: import { CURRENCIES, HOME_CURRENCY }
    content = re.sub(r"import\s*\{\s*HOME_CURRENCY,\s*([^}]+)\s*\}\s*from\s*'@/lib/currency';", r"import { \1 } from '@/lib/currency';", content)
    content = re.sub(r"import\s*\{\s*CURRENCIES,\s*HOME_CURRENCY\s*\}\s*from\s*'@/lib/currency';", r"import { CURRENCIES } from '@/lib/currency';", content)

    # 2. Add SettingsProvider import
    if "import { useSettings }" not in content:
        # Find last import
        imports = list(re.finditer(r"^import\s+.*?;$", content, re.MULTILINE))
        if imports:
            last_import = imports[-1]
            content = content[:last_import.end()] + "\nimport { useSettings } from '@/components/SettingsProvider';" + content[last_import.end():]

    # 3. Add const { baseCurrency } = useSettings(); inside the component.
    # We will just inject it after the main component declaration
    # E.g. export default function Component() {
    comp_match = re.search(r"export default function \w+\([^)]*\) \{", content)
    if comp_match:
        insert_pos = comp_match.end()
        content = content[:insert_pos] + "\n  const { baseCurrency } = useSettings();" + content[insert_pos:]
    else:
        # try without default
        comp_match = re.search(r"export function \w+\([^)]*\) \{", content)
        if comp_match:
            insert_pos = comp_match.end()
            content = content[:insert_pos] + "\n  const { baseCurrency } = useSettings();" + content[insert_pos:]

    # 4. Replace HOME_CURRENCY.code with baseCurrency
    content = content.replace("HOME_CURRENCY.code", "baseCurrency")

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")
