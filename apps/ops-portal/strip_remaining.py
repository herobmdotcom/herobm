import os

files_to_strip = [
    r"c:\Users\Marcel\volz\modbm\modbm\apps\ops-portal\app\suppliers\[id]\page.tsx",
    r"c:\Users\Marcel\volz\modbm\modbm\apps\ops-portal\app\sales-orders\[id]\ReturnsSection.tsx",
    r"c:\Users\Marcel\volz\modbm\modbm\apps\ops-portal\app\sales-orders\[id]\page.tsx",
    r"c:\Users\Marcel\volz\modbm\modbm\apps\ops-portal\app\sales-orders\new\page.tsx",
    r"c:\Users\Marcel\volz\modbm\modbm\apps\ops-portal\app\purchase-orders\new\page.tsx",
    r"c:\Users\Marcel\volz\modbm\modbm\apps\ops-portal\app\products\[id]\page.tsx",
    r"c:\Users\Marcel\volz\modbm\modbm\apps\ops-portal\app\products\new\page.tsx",
    r"c:\Users\Marcel\volz\modbm\modbm\apps\ops-portal\app\global-error.tsx",
    r"c:\Users\Marcel\volz\modbm\modbm\apps\ops-portal\app\error.tsx",
    r"c:\Users\Marcel\volz\modbm\modbm\apps\ops-portal\app\admin\system-logs\page.tsx",
    r"c:\Users\Marcel\volz\modbm\modbm\apps\ops-portal\app\admin\event-queue\page.tsx"
]

count = 0
for f in files_to_strip:
    if os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as file:
            lines = file.readlines()
        
        if lines and 'eslint-disable i18next/no-literal-string' in lines[0]:
            lines.pop(0)
            with open(f, 'w', encoding='utf-8') as file:
                file.writelines(lines)
            count += 1
            print(f'Stripped from {f}')

print(f'\nTotal files stripped: {count}')
