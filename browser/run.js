/**
 * Playwright Browser Runner
 * 
 * Executes a Playwright script file in headed mode.
 * Usage: node run.js <script-file.js>
 */
const { execSync } = require('child_process');
const path = require('path');

const scriptFile = process.argv[2];
if (!scriptFile) {
  console.error('Usage: node run.js <script-file.js>');
  process.exit(1);
}

const fullPath = path.resolve(scriptFile);
console.log(`Running: ${fullPath}`);

try {
  execSync(`node "${fullPath}"`, { stdio: 'inherit', timeout: 300000 });
} catch (err) {
  console.error('Script error:', err.message);
  process.exit(1);
}
