export async function fetchProductsFromApi(retries = 5): Promise<any[]> {
  const apiUrl = process.env.API_URL || 'http://localhost:3001';
  const adminPassword = process.env.ADMIN_PASSWORD;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 1. Log in to get JWT
      const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: adminPassword })
      });
      
      if (!loginRes.ok) {
        const errBody = await loginRes.text();
        console.error(`[SimEngine] Failed to login to API (Attempt ${attempt}):`, loginRes.status, errBody);
        if (attempt === retries) return [];
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      const { access_token } = await loginRes.json();

      // 2. Fetch products
      const prodRes = await fetch(`${apiUrl}/api/products?limit=100`, {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });

      if (!prodRes.ok) {
        console.error(`[SimEngine] Failed to fetch products (Attempt ${attempt})`);
        if (attempt === retries) return [];
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      const data = await prodRes.json();
      return data.data || [];
    } catch (err) {
      console.error(`[SimEngine] Error fetching products (Attempt ${attempt}):`, err);
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}
