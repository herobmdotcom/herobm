import { ERPNextConfig, JournalEntry } from './types';
import * as http from 'http';

export class ERPNextClient {
  private config: ERPNextConfig;

  constructor(config: ERPNextConfig) {
    this.config = config;
  }

  private request<T>(method: string, endpoint: string, data?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      // Parse URL assuming baseUrl like 'http://127.0.0.1:8000'
      const url = new URL(`${this.config.baseUrl}/api/resource/${endpoint}`);
      
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Authorization': `token ${this.config.apiKey}:${this.config.apiSecret}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // Force Host header for Frappe multi-tenant resolution
          'Host': 'modbm.localhost'
        }
      };

      const req = http.request(options, (res) => {
        let bodyBytes = '';
        res.on('data', chunk => bodyBytes += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(bodyBytes);
              resolve(parsed.data as T);
            } catch (err) {
              reject(new Error(`Failed to parse ERPNext response: ${bodyBytes}`));
            }
          } else {
            let serverMessages = '';
            try {
              const parsed = JSON.parse(bodyBytes);
              if (parsed._server_messages) {
                 const msgs = JSON.parse(parsed._server_messages);
                 serverMessages = msgs.map((m: string) => JSON.parse(m).message).join(' | ');
              }
            } catch (e) {
                // ignore
            }
            reject(new Error(`ERPNext API Error: ${res.statusCode} ${res.statusMessage} - ${serverMessages || bodyBytes}`));
          }
        });
      });

      req.on('error', (err) => reject(err));

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  async createJournalEntry(entry: JournalEntry): Promise<any> {
    const totalDebit = entry.accounts.reduce((sum, acc) => sum + (acc.debit_in_account_currency || 0), 0);
    const totalCredit = entry.accounts.reduce((sum, acc) => sum + (acc.credit_in_account_currency || 0), 0);

    const payload = {
      doctype: 'Journal Entry',
      title: entry.title,
      company: entry.company || this.config.companyName || 'ModBM',
      posting_date: entry.posting_date,
      user_remark: entry.user_remark,
      total_debit: totalDebit,
      total_credit: totalCredit,
      accounts: entry.accounts
    };

    return this.request('POST', 'Journal Entry', payload);
  }

  async createResource(doctype: string, payload: any): Promise<any> {
    const data = { doctype, ...payload };
    return this.request('POST', doctype, data);
  }
}
