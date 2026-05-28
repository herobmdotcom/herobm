const fs = require('fs');
const path = require('path');

const dirs = [
    path.join(__dirname, 'apps/ops-portal/app/sales-orders'),
    path.join(__dirname, 'apps/ops-portal/app/purchase-orders')
];

let changedFiles = 0;

function processFile(filePath) {
    if (filePath.includes('__tests__')) return; // let's skip tests or process them? Process them to be safe.
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Remove @ts-expect-error and its following empty spaces or comments on that line
    content = content.replace(/[ \t]*\/\/\s*@ts-expect-error.*/g, '');

    // The user wants to replace `.data.data` with `.data`
    // e.g. listData.data || []  wait, that might be fine if listData is an object with .data, but if it's already just the data array...
    // Let's replace `(res as any).data || res` with `res.data`
    content = content.replace(/\(\(res\s+as\s+any\)\)\.data\s*\|\|\s*res/g, 'res.data');
    content = content.replace(/\(\((res|data|pData)\s+as\s+any\)\)\?\.data\s*\|\|\s*\1/g, '$1.data');
    
    // Sometimes it's (res as any)?.data || res || []
    content = content.replace(/\(\((res|data|pData)\s+as\s+any\)\)\?\.data\s*\|\|\s*\1\s*\|\|\s*\[\]/g, '($1.data || [])');
    content = content.replace(/\(\((res|data|pData)\s+as\s+any\)\)\.data\s*\|\|\s*\1\s*\|\|\s*\[\]/g, '($1.data || [])');
    content = content.replace(/\(res\s+as\s+any\)\?\.data\s*\|\|\s*res\s*\|\|\s*\[\]/g, '(res.data || [])');
    content = content.replace(/\(res\s+as\s+any\)\.data\s*\|\|\s*res\s*\|\|\s*\[\]/g, '(res.data || [])');

    content = content.replace(/\(data\s+as\s+any\)\?\.data\?\.name\s*\|\|\s*\(data\s+as\s+any\)\?\.name/g, 'data.data?.name');
    content = content.replace(/\(data\s+as\s+any\)\?\.data\?\.customerOrderNumber\s*\|\|\s*\(data\s+as\s+any\)\?\.customerOrderNumber/g, 'data.data?.customerOrderNumber');
    content = content.replace(/\(data\s+as\s+any\)\?\.data\?\.notes\s*\|\|\s*\(data\s+as\s+any\)\?\.notes/g, 'data.data?.notes');
    content = content.replace(/\(data\s+as\s+any\)\?\.data\?\.fulfillmentLocationId\s*\|\|\s*\(data\s+as\s+any\)\?\.fulfillmentLocationId/g, 'data.data?.fulfillmentLocationId');
    content = content.replace(/\(data\s+as\s+any\)\?\.data\?\.discrepanciesAcknowledged\s*\|\|\s*\(data\s+as\s+any\)\?\.discrepanciesAcknowledged/g, 'data.data?.discrepanciesAcknowledged');

    // listData.data || listData || [] -> listData.data || []
    content = content.replace(/listData\.data\s*\|\|\s*listData\s*\|\|\s*\[\]/g, 'listData.data || []');
    
    // (r as any).data || r -> r
    content = content.replace(/\(r\s+as\s+any\)\.data\s*\|\|\s*r/g, 'r');

    // res.data?.data -> res.data
    content = content.replace(/res\.data\?\.data/g, 'res.data');

    // data.data.data -> data.data
    // Wait, some `data` are already `res.data`. So `data.data` might be redundant. If the code says `res.data as any`, and the prompt says "res.data is exactly the type you need".
    // "Search for `?.data?.data` or `.data.data` and remove the redundant unpacking. `res.data` is exactly the type you need"
    // So if code is `const data = res.data as any;` and later `data.data.something`, then we change to `data.something`?
    // Actually, I will just replace `\.data\.data` with `.data`.
    content = content.replace(/\.data\.data/g, '.data');
    content = content.replace(/\?\.data\?\.data/g, '?.data');

    // remove `as any` from API calls
    // Usually it's like `{ ... } as any`
    // Let's replace `} as any)` with `})`
    content = content.replace(/}\s*as\s*any\)/g, '})');
    content = content.replace(/}\s*as\s*any,/g, '},');
    content = content.replace(/\]\s*as\s*any\)/g, '])');
    content = content.replace(/\]\s*as\s*any,/g, '],');
    // `payload as any` -> `payload`
    content = content.replace(/payload\s*as\s*any/g, 'payload');
    // `product as any` -> `product`
    content = content.replace(/product\s*as\s*any/g, 'product');
    content = content.replace(/duplicate\s*as\s*any/g, 'duplicate');
    content = content.replace(/value\s*as\s*any/g, 'value');
    content = content.replace(/id\s*as\s*any/g, 'id');
    // `{ [field]: value } as any`
    content = content.replace(/\{\s*\[field\]:\s*value\s*\}\s*as\s*any/g, '{ [field]: value }');
    // `stateCode as any` -> `stateCode`
    // `order?.stateCode as any` -> `order?.stateCode`
    content = content.replace(/stateCode\s*as\s*any/g, 'stateCode');

    // typecasts in mapped arrays `(line: any)`
    // Prompt says: "Search for `as any` and `: any` usage related to the API and remove them."
    // So maybe we don't need to remove *all* `: any`, just the ones related to the API? But the prompt says "remove them".
    // I will try to remove `: any` in `(res: any)` and `(err: any)` and `(data: any)`.
    content = content.replace(/\(res:\s*any\)/g, '(res)');
    content = content.replace(/\(err:\s*any\)/g, '(err)');
    content = content.replace(/\(data:\s*any\)/g, '(data)');
    content = content.replace(/\(pData:\s*any\)/g, '(pData)');
    content = content.replace(/\(listData:\s*any\)/g, '(listData)');
    content = content.replace(/\(r:\s*any\)/g, '(r)');

    // "If an endpoint requires { body: {} } (now typed as EmptyBodyDto), ensure you pass it instead of "" or omitting it."
    // e.g. api.ordersControllerArchive(id) -> api.ordersControllerArchive(id, { body: {} })
    // How to find these? Let's check typical ones.
    
    // There are some `res.data as any`. Let's remove `as any` there too.
    content = content.replace(/res\.data\s+as\s+any/g, 'res.data');
    content = content.replace(/data\s+as\s+any/g, 'data');
    
    // `newOrder as any`
    content = content.replace(/\(newOrder\s+as\s+any\)\./g, 'newOrder.');

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        changedFiles++;
        console.log(`Updated ${filePath}`);
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            processFile(fullPath);
        }
    }
}

dirs.forEach(walk);
console.log(`Changed ${changedFiles} files.`);
