const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(str) {
  if (!str) return Buffer.alloc(0);
  const clean = str.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function generateSecret(opts = {}) {
  const length = typeof opts === 'number' ? opts : (opts.length || 20);
  const bytes = crypto.randomBytes(length);
  return base32Encode(bytes);
}

function generateURI(opts = {}) {
  const { issuer = 'HeroBM', label = 'User', secret = '', algorithm = 'SHA1', digits = 6, period = 30 } = opts;
  const encIssuer = encodeURIComponent(issuer);
  const encLabel = encodeURIComponent(label);
  return `otpauth://totp/${encIssuer}:${encLabel}?secret=${secret}&issuer=${encIssuer}&algorithm=${algorithm}&digits=${digits}&period=${period}`;
}

function computeTotp(secret, epochSeconds = Math.floor(Date.now() / 1000), period = 30, digits = 6) {
  const counter = Math.floor(epochSeconds / period);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % Math.pow(10, digits);
  return code.toString().padStart(digits, '0');
}

function generateSync(opts = {}) {
  const { secret, epoch = Math.floor(Date.now() / 1000), period = 30, digits = 6 } = opts;
  return computeTotp(secret, epoch, period, digits);
}

async function generate(opts = {}) {
  return generateSync(opts);
}

function verifySync(opts = {}) {
  const { token, secret, epoch = Math.floor(Date.now() / 1000), period = 30, epochTolerance = 1 } = opts;
  if (!token || typeof token !== 'string' || token.length !== 6 || !/^\d+$/.test(token)) {
    return { valid: false };
  }
  for (let offset = -epochTolerance; offset <= epochTolerance; offset++) {
    const expected = computeTotp(secret, epoch + (offset * period), period, 6);
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return { valid: true };
    }
  }
  return { valid: false };
}

async function verify(opts = {}) {
  return verifySync(opts);
}

module.exports = {
  generateSecret,
  generateURI,
  generate,
  generateSync,
  verify,
  verifySync,
};
