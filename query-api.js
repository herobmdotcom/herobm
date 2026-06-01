const fetch = require('node-fetch');

async function check() {
  const res = await fetch('http://localhost:3001/api/gl/settings', {
    // Add dummy or local dev headers if needed, but we can just see if it's public or we can login
  });
  const text = await res.text();
  console.log(res.status, text);
}
check();
