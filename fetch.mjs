// Downloads pending CR / CC presentation uploads from Supabase into files/<id>/ and marks them "fetched".
// Runs in GitHub Actions with the SUPABASE_URL and SUPABASE_SERVICE_KEY repository secrets.
import { mkdir, writeFile } from 'node:fs/promises';

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
if (!/^https?:\/\/.+/.test(URL_) || !KEY) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY secret.'); process.exit(1); }
const H = { apikey: KEY };
if (KEY.startsWith('eyJ')) H.Authorization = `Bearer ${KEY}`;

const safe = n => String(n).replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '_').slice(-120) || 'file';
const res = await fetch(`${URL_}/rest/v1/cr_uploads?status=in.(pending,fetched)&order=id`, { headers: H });
if (!res.ok) { console.error('List failed', res.status, await res.text()); process.exit(1); }
const rows = await res.json();
const status = [];
for (const r of rows) {
  const dir = `files/${r.id}`;
  await mkdir(dir, { recursive: true });
  const f = await fetch(`${URL_}/storage/v1/object/cr-uploads/${r.path.split('/').map(encodeURIComponent).join('/')}`, { headers: H });
  if (!f.ok) { console.error(`✗ ${r.id} ${r.file_name}: ${f.status}`); status.push({ id: r.id, ok: false, error: `download ${f.status}` }); continue; }
  const buf = Buffer.from(await f.arrayBuffer());
  const name = safe(r.file_name);
  await writeFile(`${dir}/${name}`, buf);
  await writeFile(`${dir}/meta.json`, JSON.stringify({ id: r.id, file: name, file_name: r.file_name, size_bytes: buf.length,
    uploaded_by: r.full_name || '', email: r.email || '', shop: r.shop, note: r.note, uploaded_at: r.uploaded_at }, null, 2));
  if (r.status === 'pending') {
    const u = await fetch(`${URL_}/rest/v1/cr_uploads?id=eq.${r.id}`, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'fetched' }) });
    if (!u.ok) console.error(`  could not mark ${r.id} fetched: ${u.status}`);
  }
  status.push({ id: r.id, ok: true, file: name, bytes: buf.length });
  console.log(`✓ ${r.id} ${r.file_name} (${buf.length} bytes)`);
}
await writeFile('status.json', JSON.stringify({ at: new Date().toISOString(), uploads: status }, null, 2));
console.log(`${status.filter(s => s.ok).length} of ${rows.length} uploads in the inbox.`);
