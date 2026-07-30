const { execSync } = require('child_process');
const fs = require('fs');

const platform = process.platform;
const arch = process.arch;
let libc = 'gnu';
let parcelLibc = 'glibc';

if (platform === 'linux') {
  try {
    if (fs.existsSync('/etc/alpine-release')) {
      libc = 'musl';
      parcelLibc = 'musl';
    }
  } catch (e) {}
}

const packages = [];

if (platform === 'win32') {
  // Windows is locked correctly in package-lock.json usually.
} else if (platform === 'darwin') {
  packages.push(`@parcel/watcher-darwin-${arch}`);
  packages.push(`@swc/core-darwin-${arch}`);
} else {
  packages.push(`@parcel/watcher-${platform}-${arch}-${parcelLibc}`);
  packages.push(`@swc/core-${platform}-${arch}-${libc}`);
}

if (packages.length > 0) {
  console.log(`Installing native bindings for ${platform}-${arch}...`);
  try {
    execSync(`npm install --no-save ${packages.join(' ')}`, { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to install native dependencies.');
    process.exit(1);
  }
} else {
  console.log(`Native bindings handled natively for ${platform}-${arch}.`);
}
