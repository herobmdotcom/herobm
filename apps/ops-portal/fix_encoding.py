import sys

with open('messages/en.json', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace mojibake 'â€¦' with '...'
text = text.replace('â€¦', '...')
text = text.replace('Ã—', 'x')
text = text.replace('â† ', '← ')
text = text.replace('â€”', '—')
text = text.replace('ðŸ’¾', '💾')

with open('messages/en.json', 'w', encoding='utf-8') as f:
    f.write(text)
