import re

with open('test_output.txt', 'r', encoding='utf-16le') as f:
    text = f.read()

# remove ANSI color codes
ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
clean_text = ansi_escape.sub('', text)

lines = clean_text.split('\n')
printing = False
for line in lines:
    if 'FAIL src/' in line:
        pass
    if '? ' in line and 'Console' not in line:
        printing = True
    if printing:
        print(line)
        if 'Test Suites:' in line:
            printing = False
            break
