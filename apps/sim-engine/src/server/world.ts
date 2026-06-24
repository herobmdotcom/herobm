export interface VirtualCustomer {
  id: string; // Internal engine ID (e.g. CUST-001)
  name: string;
  email: string;
  phone: string;
  companyName: string;
  address: { street: string, city: string, postalCode: string, country: string };
  balanceStatus: 'GOOD' | 'CREDIT_HOLD'; // Tracks if they hit a credit limit
}

export interface VirtualOrder {
  id: string; // Internal engine ID (e.g. ORD-001)
  customerId: string;
  status: 'PENDING' | 'FULFILLED' | 'RETURNED' | 'FAILED_CREDIT_LIMIT';
  lines: { productId: string, quantity: number }[];
}

export class WorldState {
  private customers: VirtualCustomer[] = [];
  private orders: VirtualOrder[] = [];
  private products: any[] = [];

  // Used for generating unique sequential IDs
  private custCounter = 0;
  private ordCounter = 0;

  setProducts(products: any[]) {
    this.products = products;
  }

  getProducts() {
    return this.products;
  }

  addCustomer(customer: Omit<VirtualCustomer, 'id' | 'balanceStatus'>): VirtualCustomer {
    this.custCounter++;
    const newCust: VirtualCustomer = {
      ...customer,
      id: `CUST-${this.custCounter.toString().padStart(3, '0')}`,
      balanceStatus: 'GOOD'
    };
    this.customers.push(newCust);
    return newCust;
  }

  addOrder(order: Omit<VirtualOrder, 'id' | 'status'>): VirtualOrder {
    this.ordCounter++;
    const newOrd: VirtualOrder = {
      ...order,
      id: `ORD-${this.ordCounter.toString().padStart(3, '0')}`,
      status: 'PENDING'
    };
    this.orders.push(newOrd);
    return newOrd;
  }

  getCustomers() {
    return this.customers;
  }

  getOrders() {
    return this.orders;
  }

  updateOrderStatus(orderId: string, status: VirtualOrder['status']) {
    const order = this.orders.find(o => o.id === orderId);
    if (order) {
      order.status = status;
    }
  }

  updateCustomerBalanceStatus(customerId: string, status: VirtualCustomer['balanceStatus']) {
    const cust = this.customers.find(c => c.id === customerId);
    if (cust) {
      cust.balanceStatus = status;
    }
  }
}
