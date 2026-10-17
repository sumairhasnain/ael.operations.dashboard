"""Builds site/app.html from src/dashboard.html (the page exported from the Claude dashboard).
Cloudflare Pages runs this on every deploy:  build command `python3 tools/build.py`, output folder `site`.
It makes a few small, checked edits so the page works inside the portal:
  * "today" comes from the viewer's clock (Pakistan time) instead of the date frozen in the page;
  * Cost and Savings lines on the Overview are hidden for people who may not see those tabs;
  * a tab the person may not open falls back to their first permitted tab.
If the dashboard page changes so much that an edit no longer matches, the build stops with a
clear message and the previous version of the portal stays live."""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / 'src' / 'dashboard.html').read_text(encoding='utf-8')
tpl = (ROOT / 'tools' / 'app.template.html').read_text(encoding='utf-8')

PATCHES = [
    # (description, regex, replacement)
    ('today from the clock', r"window\.__TODAY = '\d{4}-\d{2}-\d{2}'", "window.__TODAY = window.__PORTAL.today"),
    ('default month/asof', r"month: '\d{4}-\d{2}', asof: '\d{4}-\d{2}-\d{2}'", "month: window.__TODAY.slice(0, 7), asof: window.__TODAY"),
    ('fallback month', r"const month = p\.month \|\| '\d{4}-\d{2}'", "const month = p.month || window.__TODAY.slice(0, 7)"),
    ('overview bullets do not require cost/savings', r"'smp_pm', 'smp_cost', 'smp_savings'\)\) \{", "'smp_pm')) {"),
    ('tag cost bullet', r"(note: 'Budget vs actual, lower is better · sample') \}", r"\1, lock: 'smp_cost' }"),
    ('tag savings bullet and filter locked', r"(note: 'Since Jun · sample') \}\]\);",
     r"\1, lock: 'smp_savings' }].filter(b => !b.lock || dash.data(b.lock).status === 'ok'));"),
    ('tab guard', r"if \(!pages\.includes\(p\)\) p = 'overview';",
     "if (!pages.includes(p) || !window.__PORTAL.canTab(p)) p = window.__PORTAL.firstTab;"),
]
out = src
for name, rx, rep in PATCHES:
    out, n = re.subn(rx, rep, out)
    if n == 0:
        sys.exit(f'BUILD STOPPED: could not apply "{name}". The dashboard page changed; update tools/build.py.')
if '</template' in out:
    sys.exit('BUILD STOPPED: dashboard page contains </template>.')
(ROOT / 'site' / 'app.html').write_text(tpl.replace('<!--DASHBOARD-->', out), encoding='utf-8')
print(f'site/app.html written ({len(out):,} bytes of dashboard, {len(PATCHES)} edits applied)')
