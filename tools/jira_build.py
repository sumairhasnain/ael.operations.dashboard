"""Builds jira_issues.json from a Jira search result (JSON with issues.nodes). Usage: python3 jira_build.py [result_file]
Without an argument it uses the newest saved tool-result file that contains a DGSRLFMT/ALCIC/KAN search."""
import json, sys, glob, os, datetime
p = sys.argv[1] if len(sys.argv) > 1 else None
if not p:
    c = [f for f in glob.glob(os.path.expanduser('~/.claude/projects/*/tool-results/*searchJiraIssuesUsingJql*')) + glob.glob('/root/.claude/projects/*/tool-results/*searchJiraIssuesUsingJql*')]
    c.sort(key=os.path.getmtime, reverse=True); p = c[0] if c else None
if not p: sys.exit('NO_JIRA_RESULT')
d = json.load(open(p)); d = d.get('issues', d)
N = d if isinstance(d, list) else (d.get('nodes') or d.get('issues') or [])   # 16 Nov: the search now returns issues as a plain list
asof = (datetime.datetime.utcnow() + datetime.timedelta(hours=5)).strftime('%Y-%m-%d'); out = []
for n in N:
    f = n.get('fields', {}); g = lambda k, s: (f.get(k) or {}).get(s); par = f.get('parent') or {}
    out.append(dict(key=n['key'], project=g('project', 'key'), project_name=g('project', 'name'), summary=f.get('summary'), type=g('issuetype', 'name'),
        status=g('status', 'name'), cat=((f.get('status') or {}).get('statusCategory') or {}).get('key'), assignee=g('assignee', 'displayName'),
        start=f.get('customfield_10015'), due=f.get('duedate'), created=(f.get('created') or '')[:10], resolved=(f.get('resolutiondate') or '')[:10] or None,
        parent=par.get('key'), priority=g('priority', 'name'), updated=(f.get('updated') or '')[:10], asof=asof))
if len(out) < 10: sys.exit(f'TOO_FEW_ISSUES {len(out)}')
json.dump(out, open('jira_issues.json', 'w'), separators=(',', ':')); print(json.dumps(dict(issues=len(out), asof=asof)))
