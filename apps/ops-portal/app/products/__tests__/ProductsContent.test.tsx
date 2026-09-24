import { render, waitFor } from '@testing-library/react';
import ProductsContent from '../ProductsContent';

let passedGridProps: any = null;
jest.mock('@/components/DataGrid', () => {
  return function MockDataGrid(props: any) {
    passedGridProps = props;
    return <div data-testid="data-grid-mock" />;
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/products',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('ProductsContent', () => {
  beforeEach(() => {
    passedGridProps = null;
    jest.clearAllMocks();
  });

  it('renders DataGrid with customFieldEntityType="products"', async () => {
    render(<ProductsContent />);

    await waitFor(() => {
      expect(passedGridProps).not.toBeNull();
      expect(passedGridProps.customFieldEntityType).toBe('products');
      expect(passedGridProps.columns).toBeDefined();
    });
  });
});
