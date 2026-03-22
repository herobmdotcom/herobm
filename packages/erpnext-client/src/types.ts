export interface ERPNextConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  companyName?: string;
}

export interface JournalEntryAccount {
  account: string;
  debit_in_account_currency: number;
  credit_in_account_currency: number;
  party_type?: string;
  party?: string;
  reference_type?: string;
  reference_name?: string;
}

export interface JournalEntry {
  title: string;
  company: string;
  posting_date: string;
  user_remark?: string;
  accounts: JournalEntryAccount[];
}
