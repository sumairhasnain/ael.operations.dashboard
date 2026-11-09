// Copies ../site into ./www and adds the native sign-in layer to the pages that need it.
import { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, '..', 'site'), www = join(root, 'www');
if (!existsSync(join(site, 'app.html'))) { console.error('site/app.html not found. Run `python3 tools/build.py` in the repo root first.'); process.exit(1); }

rmSync(www, { recursive: true, force: true }); mkdirSync(www, { recursive: true });
cpSync(site, www, { recursive: true });
rmSync(join(www, '_headers'), { force: true }); rmSync(join(www, 'robots.txt'), { force: true });
cpSync(join(root, 'native', 'native-auth.js'), join(www, 'assets', 'native-auth.js'));

// native-auth.js must load after portal.js on every page that uses it
for (const page of ['index.html', 'change-password.html', 'app.html']) {
  const file = join(www, page); let html = readFileSync(file, 'utf8');
  const tag = '<script src="assets/native-auth.js"></script>';
  if (html.includes('assets/native-auth.js')) continue;
  const m = html.match(/<script src="assets\/portal\.js[^"]*"><\/script>/);
  if (!m) { console.error('portal.js tag not found in ' + page); process.exit(1); }
  html = html.replace(m[0], m[0] + '\n' + tag);
  writeFileSync(file, html);
}
console.log('www ready');
