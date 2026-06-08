const crypto = require('crypto');

// 1. Generate a new Ed25519 Keypair
function generateKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

  console.log('=== NEW KEYPAIR GENERATED ===\n');
  console.log('PRIVATE KEY (Keep this secret, store in a password manager!):');
  console.log(privateKey.export({ type: 'pkcs8', format: 'pem' }));
  
  console.log('PUBLIC KEY (Embed this in the application source code):');
  console.log(publicKey.export({ type: 'spki', format: 'pem' }));
}

// 2. Sign a new license
// In a real scenario, you'd load the private key from an environment variable or secure vault.
function generateLicense(privateKeyPem, systemId, type, durationDays) {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  
  const header = { alg: 'EdDSA', typ: 'JWT' };
  
  const now = Math.floor(Date.now() / 1000);
  const exp = durationDays === 'perpetual' ? undefined : now + (durationDays * 24 * 60 * 60);

  const payload = {
    jti: crypto.randomUUID(), // Unique ID for this license
    iat: now,
    exp: exp,
    system_id: systemId,
    type: type // 'trial' or 'perpetual'
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signTarget = `${encodedHeader}.${encodedPayload}`;
  
  const signature = crypto.sign(null, Buffer.from(signTarget), privateKey);
  const encodedSignature = signature.toString('base64url');

  const jwt = `${signTarget}.${encodedSignature}`;
  
  console.log('\n=== GENERATED LICENSE KEY ===');
  console.log(jwt);
  console.log('\nPayload:', payload);
}

const command = process.argv[2];

if (command === 'generate-keys') {
  generateKeypair();
} else if (command === 'sign') {
  const privateKeyPem = process.env.PRIVATE_KEY;
  const systemId = process.argv[3];
  const type = process.argv[4]; // 'trial' | 'perpetual'
  const duration = process.argv[5] || 'perpetual'; // days

  if (!privateKeyPem || !systemId || !type) {
    console.error('Usage: PRIVATE_KEY="..." node tools/license-keys.js sign <system_id> <type> [duration_days]');
    process.exit(1);
  }

  generateLicense(privateKeyPem, systemId, type, duration === 'perpetual' ? 'perpetual' : parseInt(duration, 10));
} else {
  console.log('Usage:');
  console.log('  node tools/license-keys.js generate-keys');
  console.log('  PRIVATE_KEY="..." node tools/license-keys.js sign <system_id> <type> [duration_days]');
}
