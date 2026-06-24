export async function fetchProductsFromApi(): Promise<any[]> {
  const apiUrl = process.env.API_URL || 'http://localhost:3001';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password123';

  try {
    // 1. Log in to get JWT
    const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: adminPassword })
    });
    
    if (!loginRes.ok) {
      const errBody = await loginRes.text();
      console.error('[SimEngine] Failed to login to API to fetch products:', loginRes.status, errBody);
      return [];
    }

    const { access_token } = await loginRes.json();

    // 2. Fetch products
    const prodRes = await fetch(`${apiUrl}/api/products?limit=100`, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!prodRes.ok) {
      console.error('[SimEngine] Failed to fetch products');
      return [];
    }

    const data = await prodRes.json();
    return data.data || [];
  } catch (err) {
    console.error('[SimEngine] Error fetching products:', err);
    return [];
  }
}
