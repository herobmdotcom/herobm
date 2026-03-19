import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

// Fallback to minimal polyfill if running in older node, but Node 18+ has fetch.
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};

envContent.split('\n').forEach((line) => {
    const match = line.match(/^\s*([^=]+)\s*=\s*(.*)\s*$/);
    if (match) {
        env[match[1]] = match[2].trim();
    }
});

const API_KEY = env['ERPNEXT_API_KEY'];
const API_SECRET = env['ERPNEXT_API_SECRET'];
const BASE_URL = env['ERPNEXT_URL']?.replace('erpnext-backend', '127.0.0.1');

if (!API_KEY || !API_SECRET || !BASE_URL) {
    console.warn("Skipping ERPNext provisioning: Missing ERPNEXT_API_KEY/SECRET/URL in .env");
    process.exit(0);
}

const getHeaders = () => ({
    'Authorization': `token ${API_KEY}:${API_SECRET}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Host': 'modbm.localhost'
});

async function apiCall(method: string, endpoint: string, body?: any): Promise<any> {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers: getHeaders()
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400) {
                    let errorMsg = res.statusMessage;
                    try {
                        const parsed = JSON.parse(data);
                        errorMsg = JSON.stringify(parsed);
                    } catch {
                        errorMsg = data;
                    }
                    reject(new Error(`API call failed: ${res.statusCode} ${res.statusMessage} - ${errorMsg}`));
                } else {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve(data);
                    }
                }
            });
        });

        req.on('error', (e) => reject(new Error(`Connection error to ${url}: ${e.message}`)));

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function resourceExists(doctype: string, name: string): Promise<boolean> {
    try {
        await apiCall('GET', `/api/resource/${doctype}/${encodeURIComponent(name)}`);
        return true;
    } catch (e: any) {
        if (e.message.includes('404')) {
            return false;
        }
        throw e;
    }
}

async function provisionCompany() {
    const configPath = path.resolve(process.cwd(), 'configs/erpnext/company_setup.json');
    const companyData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const exists = await resourceExists('Company', companyData.company_name);
    if (exists) {
        console.log(`Company '${companyData.company_name}' already exists.`);
        return companyData.company_name;
    }

    console.log(`Creating Company '${companyData.company_name}'...`);
    const payload = {
        ...companyData,
        abbr: companyData.company_name.substring(0, 3).toUpperCase(),
        domain: 'Distribution',
        create_chart_of_accounts_based_on: 'Standard Template',
        chart_of_accounts: 'Standard'
    };

    const res = await apiCall('POST', '/api/resource/Company', payload);
    console.log(`Successfully created Company '${companyData.company_name}'`);
    return companyData.company_name;
}

async function provisionChartOfAccounts(companyName: string) {
    const csvPath = path.resolve(process.cwd(), 'configs/erpnext/chart_of_accounts.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('Account Name'));

    for (const line of lines) {
        const [accountName, parentAccountRaw, accountTypeRaw, isGroupRaw, rootTypeRaw] = line.split(',');
        
        const accountFullName = `${accountName} - ${companyName.substring(0, 3).toUpperCase()}`;
        const exists = await resourceExists('Account', accountFullName);
        
        if (exists) {
            console.log(`Account '${accountFullName}' already exists.`);
            continue;
        }

        const parentAccount = parentAccountRaw ? `${parentAccountRaw} - ${companyName.substring(0, 3).toUpperCase()}` : null;
        
        const payload: any = {
            account_name: accountName,
            is_group: isGroupRaw === '1' ? 1 : 0,
            company: companyName,
        };

        if (parentAccount) {
            payload.parent_account = parentAccount;
        } else if (rootTypeRaw) {
            payload.root_type = rootTypeRaw;
        }
        
        if (accountTypeRaw) {
            payload.account_type = accountTypeRaw;
        }

        try {
            await apiCall('POST', '/api/resource/Account', payload);
            console.log(`Created Account '${accountFullName}'`);
        } catch (e: any) {
            console.error(`Failed to create account '${accountFullName}': ${e.message}`);
        }
    }
}

async function provisionTaxes(companyName: string) {
    const configPath = path.resolve(process.cwd(), 'configs/erpnext/tax_templates.json');
    if (!fs.existsSync(configPath)) return;
    
    const taxesData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    for (const tax of taxesData) {
        const taxTitleWithSuffix = `${tax.title} - ${companyName.substring(0, 3).toUpperCase()}`;
        const exists = await resourceExists('Item Tax Template', taxTitleWithSuffix);
        if (exists) {
            console.log(`Tax Template '${taxTitleWithSuffix}' already exists.`);
            continue;
        }

        console.log(`Creating Tax Template '${tax.title}'...`);
        try {
            const taxAccount = tax.account.endsWith(` - ${companyName.substring(0, 3).toUpperCase()}`) 
                ? tax.account 
                : `${tax.account} - ${companyName.substring(0, 3).toUpperCase()}`;
                
            const payload = {
                title: tax.title,
                company: companyName,
                taxes: [
                    {
                        tax_type: taxAccount,
                        tax_rate: tax.rate
                    }
                ]
            };
            await apiCall('POST', '/api/resource/Item Tax Template', payload);
            console.log(`Created Tax Template '${tax.title}'`);
        } catch (e: any) {
            console.error(`Failed to create tax template '${tax.title}': ${e.message}`);
        }
    }
}

async function provisionWarehouseTypes() {
    const types = ["Transit", "Fixed Asset"];
    for (const wt of types) {
        const exists = await resourceExists('Warehouse Type', wt);
        if (exists) continue;
        
        console.log(`Creating Warehouse Type '${wt}'...`);
        try {
            await apiCall('POST', '/api/resource/Warehouse Type', {
                name: wt,
                warehouse_type_name: wt
            });
            console.log(`Created Warehouse Type '${wt}'`);
        } catch (e: any) {
            console.warn(`Could not create Warehouse Type '${wt}': ${e.message}`);
        }
    }
}

async function main() {
    console.log("Starting ERPNext provisioning...");
    try {
        await provisionWarehouseTypes();
        const companyName = await provisionCompany();
        await provisionChartOfAccounts(companyName);
        await provisionTaxes(companyName);
        console.log("ERPNext provisioning complete.");
    } catch (e: any) {
        console.error("Provisioning failed:", e.message);
        process.exit(1);
    }
}

main();
