const stdin = process.stdin;
stdin.setRawMode = function() { return this; };
stdin.isTTY = true;
process.stdout.isTTY = true;

const originalOn = stdin.on.bind(stdin);
stdin.on = function(event, callback) {
  originalOn(event, callback);
  if (event === 'keypress') {
    // We wait for the prompt to be rendered, then we simulate the arrow down and enter
    setTimeout(() => {
      // Simulate DOWN arrow: name='down'
      this.emit('keypress', '', { name: 'down', ctrl: false, meta: false, shift: false });
      
      // Simulate ENTER: name='return'
      setTimeout(() => {
        this.emit('keypress', '\r', { name: 'return', ctrl: false, meta: false, shift: false });
      }, 50);
    }, 500);
  }
  return this;
};

require('../../node_modules/drizzle-kit/bin.cjs');
