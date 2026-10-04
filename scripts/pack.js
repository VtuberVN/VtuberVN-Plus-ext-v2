import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version || '1.0.0';
const isV2 = rootDir.includes('-v2') || version.startsWith('2.');
const prefix = isV2 ? 'vtubervn-star-v2' : 'vtubervn-star-v1';

const distChrome = path.join(rootDir, 'dist_chrome');
const distFirefox = path.join(rootDir, 'dist_firefox');
const keyPem = path.join(rootDir, 'key.pem');

function findBrowserExe() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function packageVariant(target) {
  const isProd = target === 'prod';
  const variantName = isProd ? 'Production (No Localhost)' : 'Development (With Localhost)';
  const outSubdir = isProd ? 'prod' : 'dev';
  const outDir = path.join(rootDir, 'packages', outSubdir);
  const suffix = isProd ? '' : '-local';

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`\n======================================================`);
  console.log(` Packaging: ${prefix} v${version} [${variantName}]`);
  console.log(`======================================================\n`);

  // Build clean bundle with target environment variable
  console.log(`-> Building bundle (${isProd ? 'BUILD_TARGET=prod' : 'BUILD_TARGET=dev'})...`);
  execSync('yarn build', {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, BUILD_TARGET: isProd ? 'prod' : 'dev', NO_LOCAL: isProd ? 'true' : 'false' },
  });

  const outputs = [];

  // 1. Chrome ZIP
  const chromeZip = path.join(outDir, `${prefix}-v${version}${suffix}-chrome.zip`);
  if (fs.existsSync(chromeZip)) fs.unlinkSync(chromeZip);
  execSync(`tar.exe -a -c -f "${chromeZip}" -C "${distChrome}" .`, { stdio: 'inherit' });
  outputs.push({ type: 'Chrome ZIP', file: chromeZip, size: fs.statSync(chromeZip).size });

  // 2. Chrome CRX
  const browserExe = findBrowserExe();
  if (browserExe) {
    try {
      const tempCrx = path.join(rootDir, 'dist_chrome.crx');
      const tempPem = path.join(rootDir, 'dist_chrome.pem');
      if (fs.existsSync(tempCrx)) fs.unlinkSync(tempCrx);

      let packCmd = `"${browserExe}" --pack-extension="${distChrome}"`;
      if (fs.existsSync(keyPem)) {
        packCmd += ` --pack-extension-key="${keyPem}"`;
      }

      execSync(packCmd, { stdio: 'ignore' });

      if (!fs.existsSync(keyPem) && fs.existsSync(tempPem)) {
        fs.renameSync(tempPem, keyPem);
      } else if (fs.existsSync(tempPem)) {
        fs.unlinkSync(tempPem);
      }

      if (fs.existsSync(tempCrx)) {
        const targetCrx = path.join(outDir, `${prefix}-v${version}${suffix}.crx`);
        if (fs.existsSync(targetCrx)) fs.unlinkSync(targetCrx);
        fs.renameSync(tempCrx, targetCrx);
        outputs.push({ type: 'Chrome CRX', file: targetCrx, size: fs.statSync(targetCrx).size });
      }
    } catch (err) {
      console.warn('Warning: Unable to create CRX package:', err.message);
    }
  }

  // 3. Firefox ZIP & XPI
  const firefoxZip = path.join(outDir, `${prefix}-v${version}${suffix}-firefox.zip`);
  if (fs.existsSync(firefoxZip)) fs.unlinkSync(firefoxZip);
  execSync(`tar.exe -a -c -f "${firefoxZip}" -C "${distFirefox}" .`, { stdio: 'inherit' });
  outputs.push({ type: 'Firefox ZIP', file: firefoxZip, size: fs.statSync(firefoxZip).size });

  const firefoxXpi = path.join(outDir, `${prefix}-v${version}${suffix}.xpi`);
  if (fs.existsSync(firefoxXpi)) fs.unlinkSync(firefoxXpi);
  execSync(`tar.exe -a -c -f "${firefoxXpi}" -C "${distFirefox}" .`, { stdio: 'inherit' });
  outputs.push({ type: 'Firefox XPI', file: firefoxXpi, size: fs.statSync(firefoxXpi).size });

  console.log(`\nCompleted package [${variantName}]:`);
  for (const out of outputs) {
    const sizeKb = (out.size / 1024).toFixed(1);
    console.log(`  - [${out.type}] ${path.basename(out.file)} (${sizeKb} KB)`);
  }
  console.log(`  -> Output directory: ${outDir}\n`);
}

const args = process.argv.slice(2);
const buildAll = args.includes('--all');
const buildLocal = args.includes('--local') || args.includes('--dev');

if (buildAll) {
  packageVariant('prod');
  packageVariant('dev');
} else if (buildLocal) {
  packageVariant('dev');
} else {
  // Default to production clean build (without localhost)
  packageVariant('prod');
}
