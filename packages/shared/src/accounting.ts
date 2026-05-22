export const GL_ACCOUNT_TYPE = {
  ASSET: 'asset',
  LIABILITY: 'liability',
  EQUITY: 'equity',
  REVENUE: 'revenue',
  EXPENSE: 'expense',
} as const;

export type GLAccountType = typeof GL_ACCOUNT_TYPE[keyof typeof GL_ACCOUNT_TYPE];
