import { redirect } from 'next/navigation';
import SalesCreditNotesOperationsRedirect from '../operations/page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('SalesCreditNotesOperationsRedirect', () => {
  it('redirects to /sales-returns', () => {
    SalesCreditNotesOperationsRedirect();
    expect(redirect).toHaveBeenCalledWith('/sales-returns');
  });
});
