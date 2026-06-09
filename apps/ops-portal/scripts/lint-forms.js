const fs = require('fs');
const path = require('path');

// Find all .tsx files
function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      if (fs.statSync(dirFile).isDirectory()) {
        filelist = walkSync(dirFile, filelist);
      } else {
        if (dirFile.endsWith('.tsx')) {
          filelist.push(dirFile);
        }
      }
    } catch (err) {
      if (err.code === 'OOM' || err.code === 'EISDIR') {
        // ignore
      }
    }
  });
  return filelist;
}

const rootDir = path.resolve(__dirname, '..');
const searchDirs = [
  path.join(rootDir, 'app'),
  path.join(rootDir, 'components')
];

let files = [];
searchDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    files = files.concat(walkSync(dir));
  }
});

let errorsFound = false;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');

  // Match: <form ... onSubmit={handler}
  // We capture the handler name if it's a simple variable, or we catch the whole thing.
  // Actually, let's just look for onSubmit={handler} where handler is a word.
  const onSubmitRegex = /<form[^>]*onSubmit=\{([a-zA-Z0-9_]+)\}/g;
  let match;
  while ((match = onSubmitRegex.exec(content)) !== null) {
    const handlerName = match[1];

    // Now look if there's a <button ... onClick={handlerName}
    // or <button ... onClick={() => handlerName(
    const buttonOnClickRegex = new RegExp(`<button[^>]*onClick=\\{([^}]*${handlerName}[^}]*)\\}`);
    const btnMatch = buttonOnClickRegex.exec(content);

    if (btnMatch) {
      console.error(`\x1b[31m[ERROR]\x1b[0m Form validation anti-pattern detected in ${path.relative(rootDir, file)}`);
      console.error(`        The form uses onSubmit={${handlerName}} but a button uses onClick={${btnMatch[1]}}`);
      console.error(`        To fix: Use <button type="submit" form="form-id"> and <form id="form-id">.`);
      errorsFound = true;
    }
  }
});

if (errorsFound) {
  console.error('\n\x1b[31m❌ Form Linting Failed: Found buttons bypassing HTML5 validation by calling the submit handler directly.\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m✅ Form Linting Passed: No form validation anti-patterns detected.\x1b[0m');
}
