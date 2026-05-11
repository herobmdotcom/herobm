import re
with open('test_output.txt', 'r', encoding='utf-16le') as f:
    lines = f.readlines()

fails = []
for i, line in enumerate(lines):
    if 'FAIL src/' in line:
        fails.append(line.strip())

print("Failing files:")
for f in fails:
    print(f)
