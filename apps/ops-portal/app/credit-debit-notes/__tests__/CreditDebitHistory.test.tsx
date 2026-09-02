import { redirect } from 'next/navigation';
import CreditDebitNotesPage from '../page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('CreditDebitNotesPage Redirect', () => {
  it('redirects to /sales-credit-notes', () => {
    CreditDebitNotesPage();
    expect(redirect).toHaveBeenCalledWith('/sales-credit-notes');
  });
});
