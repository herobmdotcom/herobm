import glob, re
import os

for f in glob.glob('apps/api/migrations/*.sql'):
    if '0012' in f: continue
    with open(f, 'r', encoding='utf-8') as file:
        original = file.read()
    
    content = original
    # Fix broken DO $ from previous attempt
    content = content.replace('DO $ BEGIN', 'DO $$ BEGIN')
    content = content.replace('END $;', 'END $$;')

    # Wrap raw ALTER TABLE ADD CONSTRAINT (that aren't already wrapped)
    # The regex won't match if it's already inside a DO block because the DO block puts spaces before ALTER TABLE
    # Wait, my regex `(?m)^ALTER TABLE` only matches if it's at the start of the line.
    
    def repl(m):
        return f"DO $$ BEGIN\n    {m.group(0)}\nEXCEPTION\n    WHEN duplicate_object THEN null;\nEND $$;"
    
    new_content = re.sub(r'(?m)^ALTER TABLE \".*?\" ADD CONSTRAINT \".*?\" FOREIGN KEY .*?;(?:--> statement-breakpoint)?$', repl, content)
    
    # Also fix the one case where I might have missed escaping or something
    if original != new_content:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
        print(f'Updated {f}')
print('Done')
