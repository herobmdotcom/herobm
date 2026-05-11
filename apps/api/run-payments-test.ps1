$env:NODE_OPTIONS = "--experimental-vm-modules"
& "C:\Program Files\nodejs/node.exe" "C:\Program Files\nodejs/node_modules/npm/bin/npx-cli.js" jest --testPathPatterns="payments" --no-coverage 2>&1 | Out-File -Encoding utf8 "c:\Users\Marcel\volz\modbm\modbm\test-payments.txt"
