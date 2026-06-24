import { WorldState } from './world';
import { Timeline } from './timeline';
import { EventType } from './catalogue';

export function generateEpoch(world: WorldState, timeline: Timeline, currentEventTimestamp: number) {
  const now = currentEventTimestamp || Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * ONE_DAY;

  // Let's generate roughly 5-10 events for the next 7 days
  const numEvents = Math.floor(Math.random() * 5) + 5;

  for (let i = 0; i < numEvents; i++) {
    const delay = Math.floor(Math.random() * SEVEN_DAYS);
    const timestamp = now + delay;

    const r = Math.random();

    if (r < 0.1) {
      // 10% chance: Customer Onboarding
      const newCust = world.addCustomer({
        name: `Virtual Customer ${Math.floor(Math.random() * 1000)}`,
        email: `cust${Math.floor(Math.random() * 10000)}@example.com`,
        phone: `555-${Math.floor(1000 + Math.random() * 9000)}`,
        companyName: `Company ${Math.floor(Math.random() * 100)}`,
        address: { street: '123 Fake St', city: 'Metropolis', postalCode: '12345', country: 'US' }
      });
      timeline.addEvent({
        id: Math.random().toString(36).substring(7),
        type: EventType.CUSTOMER_ONBOARDING,
        timestamp,
        payload: { customer: newCust },
        status: 'pending'
      });
    } else if (r < 0.2) {
      // 10% chance: Customer Enquiry
      const products = world.getProducts();
      const product = products.length > 0 ? products[Math.floor(Math.random() * products.length)] : { productId: 'PRD-UNKNOWN' };
      timeline.addEvent({
        id: Math.random().toString(36).substring(7),
        type: EventType.CUSTOMER_ENQUIRY,
        timestamp,
        payload: { productId: product.productId || product.id, quantity: Math.floor(Math.random() * 100) + 1 },
        status: 'pending'
      });
    } else if (r < 0.99) {
      // 79% chance: Customer Order
      const customers = world.getCustomers();
      let customer;
      let isNewGuest = false;

      // 30% of orders are from new guest customers if there are existing customers, otherwise 100%
      if (customers.length === 0 || Math.random() < 0.3) {
        isNewGuest = true;
        customer = world.addCustomer({
          name: `Guest Customer ${Math.floor(Math.random() * 1000)}`,
          email: `guest${Math.floor(Math.random() * 10000)}@example.com`,
          phone: `555-${Math.floor(1000 + Math.random() * 9000)}`,
          companyName: `Guest Company ${Math.floor(Math.random() * 100)}`,
          address: { street: '456 Guest Ave', city: 'Gotham', postalCode: '67890', country: 'US' }
        });
      } else {
        customer = customers[Math.floor(Math.random() * customers.length)];
      }

      // If they are on credit hold, generate a payment instead!
      if (customer.balanceStatus === 'CREDIT_HOLD') {
        timeline.addEvent({
          id: Math.random().toString(36).substring(7),
          type: EventType.CUSTOMER_PAYMENT,
          timestamp,
          payload: { note: 'Customer attempting to pay to clear credit hold', customerId: customer.id },
          status: 'pending'
        });
        // We will assume the payment works and they are good again
        world.updateCustomerBalanceStatus(customer.id, 'GOOD');
        continue;
      }

      const products = world.getProducts();
      const numLines = Math.floor(Math.random() * 3) + 1;
      const lines = [];
      for (let j = 0; j < numLines; j++) {
        const product = products.length > 0 ? products[Math.floor(Math.random() * products.length)] : { productId: 'PRD-UNKNOWN' };
        lines.push({ productId: product.productId || product.id, quantity: Math.floor(Math.random() * 50) + 1 });
      }

      const order = world.addOrder({ customerId: customer.id, lines });

      timeline.addEvent({
        id: Math.random().toString(36).substring(7),
        type: EventType.CUSTOMER_ORDER,
        timestamp,
        payload: {
          virtualOrderId: order.id,
          customer: isNewGuest ? customer : { id: customer.id, email: customer.email }, // Full info if guest
          lines
        },
        status: 'pending'
      });
    } else {
      // 1% chance: Customer Return
      const orders = world.getOrders();
      const fulfilledOrders = orders.filter(o => o.status === 'FULFILLED');
      if (fulfilledOrders.length > 0) {
        const order = fulfilledOrders[Math.floor(Math.random() * fulfilledOrders.length)];
        world.updateOrderStatus(order.id, 'RETURNED');
        timeline.addEvent({
          id: Math.random().toString(36).substring(7),
          type: EventType.CUSTOMER_RETURN,
          timestamp,
          payload: {
            virtualOrderId: order.id,
            reason: 'Customer did not want the item',
            lines: order.lines
          },
          status: 'pending'
        });
      }
    }
  }
}
