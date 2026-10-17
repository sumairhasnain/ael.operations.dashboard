// Copies every data/*.json file into the Supabase "datasets" table.
// Runs inside GitHub Actions. Needs two repository secrets:
//   SUPABASE_URL          e.g. https://abcd1234.supabase.co
//   SUPABASE_SERVICE_KEY  the "secret" (sb_secret_...) or legacy "service_role" key
import { readdir, readFile } from 'node:fs/promises';

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
if (!/^https?:\/\/.+/.test(URL_) || !KEY) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY secret.'); process.exit(1); }

const access = JSON.parse(await readFile('data/_access.json', 'utf8'));
const headers = { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
if (KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`; // legacy JWT-style key

const files = (await readdir('data')).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort();
let ok = 0, failed = 0;
for (const f of files) {
  const name = f.replace(/\.json$/, '');
  let data;
  try { data = JSON.parse(await readFile(`data/${f}`, 'utf8')); }
  catch (e) { console.error(`✗ ${name}: not valid JSON (${e.message})`); failed++; continue; }
  const row = { name, tabs: access[name] || access._default || ['overview'], data, updated_at: new Date().toISOString() };
  const res = await fetch(`${URL_}/rest/v1/datasets?on_conflict=name`, { method: 'POST', headers, body: JSON.stringify(row) });
  if (res.ok) { ok++; console.log(`✓ ${name} (${Array.isArray(data) ? data.length + ' rows' : 'object'})`); }
  else { failed++; console.error(`✗ ${name}: ${res.status} ${await res.text()}`); }
}
console.log(`Synced ${ok} of ${files.length} datasets.`);
if (failed) process.exit(1);
