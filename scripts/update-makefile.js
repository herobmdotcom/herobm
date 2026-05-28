const fs = require('fs');

let content = fs.readFileSync('Makefile', 'utf8');

// Insert after `test-structural-local:`
const targetStr = "test-structural-local:\n";
const insertion = "\t@powershell -ExecutionPolicy Bypass -File infra/tests/test_openapi_no_placeholder_schemas.ps1\n" +
                  "\t@powershell -ExecutionPolicy Bypass -File infra/tests/test_fe_no_defensive_unpacking.ps1\n" +
                  "\t@powershell -ExecutionPolicy Bypass -File infra/tests/test_fe_no_api_any_casting.ps1\n" +
                  "\t@powershell -ExecutionPolicy Bypass -File infra/tests/test_fe_no_ts_expect_error.ps1\n";

if (!content.includes('test_fe_no_defensive_unpacking.ps1')) {
    content = content.replace(targetStr, targetStr + insertion);
    fs.writeFileSync('Makefile', content);
    console.log('Makefile updated');
} else {
    console.log('Makefile already contains tests');
}
