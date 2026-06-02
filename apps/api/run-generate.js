const { spawn } = require('child_process');

const p = spawn('npx', ['drizzle-kit', 'generate', '--name', 'sync_schema'], {
  cwd: 'C:\\Users\\Marcel\\volz\\modbm\\modbm\\apps\\api',
  shell: true
});

p.stdout.on('data', (data) => {
  const text = data.toString();
  console.log('STDOUT:', text);
  // If it prompts for rename, say yes (or empty to accept default)
  if (text.includes('Are you sure you want to drop')) {
    p.stdin.write('y\n');
  }
  if (text.includes('Is this a rename?')) {
    p.stdin.write('y\n');
  }
});

p.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString());
});

p.on('close', (code) => {
  console.log(`Exited with code ${code}`);
});
