const crypto = require('crypto');
module.exports = {
  v4: () => crypto.randomUUID(),
  v5: (name, namespace) => crypto.randomUUID()
};
