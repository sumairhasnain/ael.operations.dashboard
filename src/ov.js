/* Overview tab (Umair, 11 Nov 2026 23:28). One 16:9 page, two rows of four cards in this order: Production, Vendor Supply,
   Inventory, Manpower / Cost of Production, Capacity, Projects, VA/CR. Each card: 4-6 KPIs on the left and one chart on the
   right, worked out from the same datasets as its tab (month and "as of" date from the filter pane, all shops). Clicking a card
   opens a detail window with more charts; clicking outside it, the X button or Esc closes it. A viewer who may not open a tab
   sees that card locked (its data is never sent to them). */
(() => {
  const AK = window.AK; if (!AK) return;
  const { C, tip } = AK;
  const nf = d3.format(','), f1 = d3.format(',.1f'), f0 = d3.format(',.0f');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const kf = v => v == null || !isFinite(v) ? '—' : Math.abs(v) >= 1e6 ? f1(v / 1e6) + 'M' : Math.abs(v) >= 1e4 ? f0(v / 1e3) + 'k' : nf(Math.round(v));
  const rs = v => v == null || !isFinite(v) ? '—' : 'Rs ' + (Math.abs(v) >= 1e9 ? d3.format(',.2f')(v / 1e9) + 'B' : Math.abs(v) >= 1e6 ? f1(v / 1e6) + 'M' : Math.abs(v) >= 1e3 ? f0(v / 1e3) + 'k' : nf(Math.round(v)));
  const pc = v => v == null || !isFinite(v) ? '—' : f0(v) + '%';
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = m => MN[+m.slice(5, 7) - 1] + '-' + m.slice(2, 4), dlab = d => +d.slice(8) + ' ' + MN[+d.slice(5, 7) - 1];
  const D = id => { const d = window.dash && dash.data(id); return d && d.status === 'ok' ? (Array.isArray(d.data) ? d.data : []) : null; };
  const ST = id => { const d = window.dash && dash.data(id); return d ? d.status : 'loading'; };
  const CARDS = [['production', 'Production'], ['vendor', 'Vendor Supply'], ['inventory', 'Inventory'],
    ['cost', 'Cost of Production'], ['savings', 'VA/CR Activities'], ['workforce', 'Manpower'], ['capacity', 'Capacity'], ['projects', 'Projects']];
  const ACC = { production: '#051C2C', vendor: '#2251FF', inventory: '#1F9E89', workforce: '#00A9F4', cost: '#8C6BD8', capacity: '#E0A100', projects: '#33414B', savings: '#1E8C5A' };
  const ICON = { production: '<path d="M2 14V7l4 2.5V7l4 2.5V4h4v10z"/>', vendor: '<path d="M1 4h9v7H1zM10 7h3l2 2.5V11h-5M4 13.5a1.3 1.3 0 1 0 0-.1M12 13.5a1.3 1.3 0 1 0 0-.1"/>',
    inventory: '<path d="M2 6l6-3 6 3v7l-6 3-6-3zM2 6l6 3 6-3M8 9v7"/>', workforce: '<path d="M6 7a2.5 2.5 0 1 0 0-.1M1.5 14c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4M11.5 7.5a2 2 0 1 0 0-.1M11 10c2 0 3.2 1.4 3.5 3.5"/>',
    cost: '<path d="M3 3h10M3 6.5h10M6 3c3 0 4 1.6 4 3.5S8.5 10 5.5 10L11 15"/>', capacity: '<path d="M2 12a6 6 0 1 1 12 0M8 12l3-4M5 12h.01M11 12h.01"/>',
    projects: '<path d="M2 3h12v10H2zM6 3v10M10 3v10M3.5 5.5h1.5M7.5 5.5h1.5M7.5 8h1.5M11.5 5.5h1.5"/>', savings: '<path d="M3 13c0-6 4-9 10-10-1 6-4 10-10 10zM3 13l6-6"/>' };
  const ico = id => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id] || ''}</svg>`;
  const STA = { good: ['On track', '#1E8C5A', '#E6F4EC'], watch: ['Watch', '#9A6B00', '#FDF3D6'], bad: ['Needs action', '#B3261E', '#FBE7E6'], info: ['Month to date', '#33414B', '#EEF1F4'] };
  /* 14 Nov 06:15 (Umair): status shown as a coloured symbol instead of the words - green tick (on track), amber ! (watch), red cross (needs action); the word stays as the hover text */
  const SYM = { good: '<path d="M5.2 9.3l2.4 2.4 5.2-5.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    watch: '<path d="M9 4.6v5.4" stroke="#fff" stroke-width="2.1" stroke-linecap="round"/><circle cx="9" cy="13.2" r="1.25" fill="#fff"/>',
    bad: '<path d="M6.2 6.2l5.6 5.6M11.8 6.2l-5.6 5.6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' };
  const pill = k => { const x = STA[k] || STA.info; if (!SYM[k]) return `<span class="pill" style="color:${x[1]};background:${x[2]}"><i></i>${x[0]}</span>`;
    return `<span class="stsym" title="${x[0]}" role="img" aria-label="${x[0]}"><svg viewBox="0 0 18 18" width="22" height="22"><circle cx="9" cy="9" r="9" fill="${k === 'watch' ? '#E8A33A' : x[1]}"/>${SYM[k]}</svg></span>`; };
  const band = (v, g, w, hiGood = true) => v == null ? 'info' : hiGood ? (v >= g ? 'good' : v >= w ? 'watch' : 'bad') : (v <= g ? 'good' : v <= w ? 'watch' : 'bad');
  /* 12 Nov 00:06 (Umair): less text on the cards. One headline figure + 3 short rows; sub-lines, card subtitle and 'View details' are gone (hover for the notes, the detail window keeps everything) */
  const SHORT = { 'Direct material': 'Material', 'Indirect material': 'Indirect', 'Direct labour': 'Labour', 'Excess stock': 'Excess', 'Slow moving': 'Slow', 'Total potential': 'Potential', 'Absent latest day': 'Latest day', 'Vendors under 80%': 'Under 80%', 'Parts over capacity': 'Parts over', 'Machines over 85%': 'M/c over 85%', 'Machines studied': 'Machines', 'In-house parts': 'In-house' };
  const PICK = { production: [0, 1],   /* 14 Nov 06:27 (Umair): Production card shows FG production and Dispatch only (In-house parts and Short to plan removed) */
                  vendor: [0, 1, 2, 4], inventory: [0, 1, 2, 3], workforce: [1, 0, 3, 2], cost: [0, 1, 2, 3], capacity: [2, 0, 3, 4], projects: [1, 0, 2, 4], savings: [2, 1, 3, 0] };
  const NEED = { production: ['atlas_parts_daily', 'atlas_parts'], vendor: ['atlas_vendor_supply'], inventory: ['sap_stock'], workforce: ['sp_attendance'],
    cost: ['cogm'], capacity: ['cap_machines', 'cap_parts', 'atlas_parts_daily', 'atlas_parts'], projects: ['jira_issues'], savings: ['cr_ideas'] };

  const css = document.createElement('style'); css.textContent = `
.ael #summary .ovg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:14px;height:calc(100vh - 170px);min-height:460px;margin:10px 0 0;width:100%}   /* 11 Nov 23:40 (Umair): full screen width */
.ael #summary .ovhd{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin:0;width:100%;border-bottom:2px solid #051C2C;padding-bottom:8px}
.ael #summary .ovhd h2{font-family:var(--font-anthropic-serif);font-weight:400;font-size:24px;margin:0;color:#051C2C}
.ael #summary .ovhd h2.ovpg{cursor:pointer;text-decoration:underline dotted #9AA5B1;text-decoration-thickness:1px;text-underline-offset:6px;border-radius:4px;padding:0 4px;margin-left:-4px}
.ael #summary .ovhd h2.ovpg:hover,.ael #summary .ovhd h2.ovpg:focus-visible{background:#EEF3F8;outline:none}
.ael #summary .ovhd h2.ovpg .car{font-size:.55em;color:#5B6770;margin-left:5px;vertical-align:.15em}
.ael #summary .ovhd .sb{font-size:12px;color:#5B6770;margin-top:2px}
.ael #summary .ovhd>div:first-child{display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap}
.ael #summary .ovst{display:flex;gap:4px;align-items:flex-end;justify-content:center;padding-bottom:4px;height:40px;box-sizing:border-box}
.ael #summary .ovst button{border:0;border-radius:3px;padding:0;width:9px;height:24px;cursor:pointer;flex:0 0 auto;transition:width .15s ease,height .15s ease,box-shadow .12s ease}
.ael #summary .ovst button.nt{transition:none}
.ael #summary .ovsum{display:flex;align-items:center;gap:12px;margin-left:10px;padding-bottom:1px}
.ael #summary .ovsum .t{font-family:var(--font-anthropic-serif);font-weight:400;font-size:24px;line-height:1;color:#051C2C;white-space:nowrap}
.ael #summary .ovsum .ln{width:2px;height:28px;background:#051C2C}
.ael #summary .ovst button.on{box-shadow:0 0 0 1.5px #fff,0 0 0 3px #051C2C}
.ael #summary .ovst button.hv{width:13.5px;height:36px}   /* 14 Nov 01:12 (Umair): hovered bar 1.5x, neighbours pushed left and right. 05:41: a class set by script, not :hover, so a redraw cannot shrink and regrow it */
.ael #summary .ovhd .lgd{display:flex;gap:12px;font-size:11px;color:#5B6770;align-items:center;flex-wrap:wrap}
.ael #summary .pill{display:inline-flex;align-items:center;gap:5px;font-family:var(--font-anthropic-sans);font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:2px 8px;border-radius:10px;white-space:nowrap}
.ael #summary .stsym,.ovm .stsym{display:inline-flex;line-height:0;flex:0 0 auto;margin-left:auto}
.ovm .stsym{margin-left:10px;vertical-align:-4px}
.ael #summary .ovhd .lgd .stsym{margin-left:0}
.ael #summary .pill i,.ovm .pill i{width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block}
.ovm .pill{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:2px 8px;border-radius:10px;margin-left:10px;vertical-align:4px}
.ael #summary .ovc{background:#fff;border:1px solid #D5DBE1;border-top:4px solid var(--ac,#051C2C);border-radius:6px;padding:10px 14px 8px;overflow:hidden;display:flex;flex-direction:column;min-width:0;min-height:0;cursor:pointer;transition:box-shadow .15s,border-color .15s;position:relative}
.ael #summary .ovc:hover,.ael #summary .ovc:focus-visible{border-color:#051C2C;border-top-color:var(--ac,#051C2C);box-shadow:0 8px 22px rgba(5,28,44,.14);transform:translateY(-2px);outline:none}
.ael #summary .ovc{transition:box-shadow .18s,transform .18s,border-color .18s}
.ael #summary .ovc .hd{display:flex;align-items:center;gap:8px;margin-bottom:2px}
.ael #summary .ovc .ic{width:26px;height:26px;border-radius:50%;background:color-mix(in srgb,var(--ac,#051C2C) 12%,#fff);color:var(--ac,#051C2C);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.ael #summary .ovc .ic svg{width:15px;height:15px}
.ael #summary .ovc .hd h3{margin:0;flex:1;min-width:0}
.ael #summary .ovc .su{font-size:10.5px;color:#5B6770;margin:0 0 8px 34px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ael #summary .ovc .mo{font-size:10.5px;color:var(--ac,#051C2C);text-align:right;margin-top:4px;opacity:.75;letter-spacing:.03em}
.ael #summary .ovc:hover .mo{opacity:1}
.ael #summary .ovc h3{font-family:var(--font-anthropic-serif);font-weight:400;font-size:17px;color:#051C2C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ael #summary .ovb{display:flex;gap:10px;flex:1;min-height:0}
.ael #summary .ovk{flex:0 0 38%;display:flex;flex-direction:column;justify-content:space-between;gap:2px;min-width:0}
.ael #summary .ovk .k{border-left:3px solid #051C2C;padding:0 0 0 8px;min-width:0}
.ael #summary .ovk .l{font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:#5B6770;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ael #summary .ovk .v{font-family:var(--font-anthropic-serif);font-size:clamp(15px,1.45vw,21px);line-height:1.15;color:#051C2C;font-variant-numeric:tabular-nums;white-space:nowrap}
.ael #summary .ovk .s{font-size:10.5px;color:#5B6770;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ael #summary .ovv{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}
.ael #summary .ovv .vt{font-size:10.5px;color:#5B6770;margin-bottom:2px}
.ael #summary .ovv .vc{flex:1;min-height:0}
.ael #summary .ovl{position:absolute;inset:44px 14px 12px;display:flex;align-items:center;justify-content:center;text-align:center;color:#5B6770;font-size:12.5px}
.ael #summary .ovn{display:none}
.ael #summary{padding-top:6px !important;padding-bottom:0 !important;margin-top:0 !important}
.ael.ovfit{min-height:0 !important;padding-bottom:0 !important}
.ovm{position:fixed;inset:0;background:rgba(5,28,44,.45);z-index:200;display:flex;align-items:center;justify-content:center;padding:24px}
.ovm .bx{background:#fff;border-radius:8px;border-top:5px solid var(--ac,#051C2C);width:min(1280px,96vw);max-height:92vh;overflow:auto;padding:18px 22px 20px;box-shadow:0 18px 50px rgba(0,0,0,.3);font-family:var(--font-anthropic-sans);color:#051C2C}
.ovm .bh{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px}
.ovm h2{font-family:var(--font-anthropic-serif);font-weight:400;font-size:22px;margin:0}
.ovm .bs{font-size:12px;color:#5B6770;margin-top:2px}
.ovm .br{display:flex;align-items:center;gap:10px;flex:0 0 auto}
.ovm .fx{font:inherit;font-size:12.5px;font-weight:600;padding:6px 12px;border:1px solid #D0312D;border-radius:4px;background:#D0312D;color:#fff;cursor:pointer}
.ovm .fx:hover{background:#B02622}
.ovm .wn.wnh{cursor:help}.ovm .wn.wnh:hover{text-decoration:underline dotted #5B6770;text-underline-offset:3px}
.ovm .fw{position:relative;display:inline-flex}
.ovm .ff{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid #D5DBE1;border-radius:50%;background:#fff;color:#051C2C;cursor:pointer}
.ovm .ff:hover,.ovm .ff[aria-expanded="true"]{background:#EEF3F8}.ovm .ff.on{background:#051C2C;color:#fff;border-color:#051C2C}
.ovm .fpn{position:absolute;right:0;top:40px;z-index:5;background:#fff;border:1px solid #D5DBE1;border-radius:8px;box-shadow:0 8px 24px rgba(5,28,44,.18);padding:12px;display:grid;gap:10px;width:300px;font-size:12.5px}
.ovm .fpn[hidden]{display:none}.ovm .fpn label{display:grid;gap:4px;color:#5B6770;font-weight:600;letter-spacing:.02em}
.ovm .fpn select,.ovm .fpn input{font:inherit;font-weight:400;color:#051C2C;padding:6px 8px;border:1px solid #C9D1D9;border-radius:4px;background:#fff;width:100%;box-sizing:border-box}
.ovm .fpb{display:flex;justify-content:space-between;gap:8px}.ovm .fpb button{font:inherit;font-weight:600;padding:5px 12px;border-radius:4px;cursor:pointer;border:1px solid #C9D1D9;background:#fff;color:#051C2C}
.ovm .fpb .fpd{background:#051C2C;color:#fff;border-color:#051C2C}
.ovm .wr.vpick{cursor:pointer}.ovm .wr.vpick:hover{background:#F2F6FA}
.ovm .wr.sel{background:#EEF3FF;box-shadow:inset 3px 0 0 #2251FF}
.ovm .x{border:1px solid #D5DBE1;background:#fff;border-radius:50%;width:32px;height:32px;font-size:18px;line-height:1;cursor:pointer;color:#051C2C;flex:0 0 auto}
.ovm .x:hover{background:#051C2C;color:#fff}
.ovm .bk{display:flex;flex-wrap:wrap;gap:8px 26px;margin:6px 0 12px;padding-bottom:10px;border-bottom:1px solid #EEF1F4}
.ovm .bk .k{border-left:3px solid var(--ac,#051C2C);padding-left:9px}
.ovm .bk .l{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:#5B6770}
.ovm .bk .v{font-family:var(--font-anthropic-serif);font-size:22px;font-variant-numeric:tabular-nums}
.ovm .bk .s{font-size:11px;color:#5B6770}
.ovm .bg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 22px}
.ovm .pn h4{margin:0 0 4px;font-size:13px;font-weight:600}
.ovm .pn .lg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11px;color:#5A6670;margin-bottom:2px}
.ovm .pn .lg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.ovm .pn .em{color:#5B6770;font-size:12px;padding:30px 0;text-align:center}
.ovm .ft{font-size:11.5px;color:#5B6770;margin-top:12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
.ovm .ft button,.ovm .br .go{border:1px solid #051C2C;background:#051C2C;color:#fff;border-radius:4px;padding:5px 12px;font-size:12px;cursor:pointer}
.ovm .br .go{font:inherit;font-size:12.5px;font-weight:600;padding:6px 12px;white-space:nowrap}
@media (max-width:1000px){.ael #summary .ovg{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:none;aspect-ratio:auto;max-height:none}.ael #summary .ovc{height:300px}.ovm .bg{grid-template-columns:1fr}}
.ael #summary .ovc{padding:12px 16px 12px}
.ael #summary .ovc .hd{margin-bottom:10px}
.ael #summary .ovk{flex:0 0 35%;min-width:0;justify-content:flex-start;gap:0}
.ael #summary .ovk .hero{padding-bottom:10px}
.ael #summary .ovk .hero .l{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#5B6770;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ael #summary .ovk .hero .v{font-family:var(--font-anthropic-serif);font-size:clamp(20px,1.65vw,28px);line-height:1.15;color:#051C2C;font-variant-numeric:tabular-nums;white-space:nowrap}
.ael #summary .ovk .hero .s{font-size:11px;color:#5B6770;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ael #summary .ovk .rows{border-top:1px solid #E2E6EB}
.ael #summary .ovk .r{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:7px 0;border-bottom:1px solid #EEF1F4;font-size:12px;color:#5B6770}
.ael #summary .ovk .r span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ael #summary .ovk .r b{font-family:var(--font-anthropic-serif);font-weight:400;font-size:clamp(14px,1.15vw,17px);color:#051C2C;font-variant-numeric:tabular-nums;white-space:nowrap}
.ael #summary .ovv .vt{font-size:10.5px;color:#8A949E;margin-bottom:4px;text-align:right}
.ael #summary .ovb{gap:12px}
.ael #summary .ovv{background:linear-gradient(180deg,#F7F9FB,#fff);border-radius:6px;padding:4px 4px 0}
.ael #summary .ovv .vt{font-size:11px;color:#33414B;font-weight:600;margin:2px 4px 2px}
.ael #summary .ovv .vt{display:flex;justify-content:flex-end;align-items:center;gap:8px;white-space:nowrap;overflow:hidden}
.ael #summary .ovv .vtt{margin-left:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ael #summary .tg{font:600 10.5px var(--font-anthropic-sans);border:1px solid #C9D1D9;background:#fff;color:#33414B;border-radius:12px;padding:3px 10px;cursor:pointer;margin-right:auto;white-space:nowrap}
.ael #summary .ovbc{flex-direction:column;gap:8px}
.ael #summary .ovkh{display:flex;flex-wrap:wrap;gap:8px 22px;flex:0 0 auto}
.ael #summary .ovkh .ovff{border-left:3px solid #051C2C;padding:2px 0 2px 10px;min-width:0}
.ael #summary .ovkh span{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#5B6770;white-space:nowrap}
.ael #summary .ovkh b{font-family:var(--font-anthropic-serif);font-weight:400;font-size:22px;color:#051C2C;font-variant-numeric:tabular-nums}
.ael #summary .ovbh{flex:0 0 auto;font-size:12px;color:#33414B;background:#FBE7E6;border-radius:4px;padding:5px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ael #summary .ovbh b{color:#B3261E;font-weight:600}
.ael #summary .ovbh.tk{display:flex;gap:6px;align-items:center}
.ael #summary .ovbh .tkw{flex:1;min-width:0;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12px,#000 calc(100% - 12px),transparent);mask-image:linear-gradient(90deg,transparent,#000 12px,#000 calc(100% - 12px),transparent)}
.ael #summary .ovbh .tkt{display:inline-flex;white-space:nowrap;animation:ovtk linear infinite;will-change:transform}
.ael #summary .ovbh .tkw:hover .tkt{animation-play-state:paused}
@keyframes ovtk{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.ael #summary .ovbh .tkt{animation:none}}
.ael #summary .ovbh.ok{background:#E6F4EC;color:#1E8C5A}
.ael #summary .ovbh.ok b{color:#1E8C5A}
/* 14 Nov 11:06 (Umair): one KPI that flips FG Production -> Dispatch -> FG Production (4 s each; hover holds it) */
.ael #summary .ovfl{perspective:600px}
.ael #summary .hd .ovkh{margin-left:auto;flex:0 0 auto}
.ael #summary .hd .ovkh + .stsym{margin-left:10px}
.ael #summary .ovc[data-k="cost"] .hd .ovkh + .stsym{margin-right:14px}   /* 16 Nov 13:58 (Umair): icon a little in from the edge now the KPI is shorter */
.ael #summary .hd h3.ovh3{flex:0 0 auto;white-space:nowrap;overflow:visible}   /* 14 Nov 11:14 (Umair): title always shown in full; the KPI takes what is left */
.ael #summary .hd .ovkh .ovff{padding-left:8px}
.ael #summary .hd h3.ovh3.two{line-height:1.02}
.ael #summary .hd .ovkh span{font-size:9.5px}
.ael #summary .hd .ovkh b{font-size:20px;line-height:1.1}
.ael #summary .ovfl .ovfi{display:grid;transform-style:preserve-3d;animation:ovflip 8s ease-in-out infinite}
.ael #summary .ovfl:hover .ovfi{animation-play-state:paused}
.ael #summary .ovkh .ovff{grid-area:1/1;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:#fff}
.ael #summary .ovkh .ovff.bk{transform:rotateX(180deg)}
@keyframes ovflip{0%,42%{transform:rotateX(0)}50%,92%{transform:rotateX(180deg)}100%{transform:rotateX(360deg)}}
/* 15 Nov 18:11 (Umair): four-step KPI - label stays, value flips sideways; then the whole KPI flips up to the next label */
.ael #summary .ovfl.q4 .ovfi{animation:ov4 16s ease-in-out infinite}
@keyframes ov4{0%,46%{transform:rotateX(0)}50%,96%{transform:rotateX(180deg)}100%{transform:rotateX(360deg)}}
.ael #summary .ovkh .ovff .hv{display:block;perspective:500px}
/* 16 Nov (Umair, option 2): Cost of Production KPI keeps the % large and 'MoM' small, so the status icon fits */
.ael #summary .ovkh .ovff .ovmom{font-family:Inter,system-ui,Arial,sans-serif;font-size:.42em;font-weight:600;letter-spacing:.04em;color:#5B6770;margin-left:3px;vertical-align:.12em}
.ael #summary .ovkh .ovff .hv>i{display:grid;font-style:normal;transform-style:preserve-3d}
.ael #summary .ovkh .ovff .hv>i>i{grid-area:1/1;font-style:normal;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:#fff;white-space:nowrap}
.ael #summary .ovkh .ovff .hv>i>i+i{transform:rotateY(180deg)}
.ael #summary .ovkh .ovff:not(.bk) .hv>i{animation:ovhA 16s ease-in-out infinite}
.ael #summary .ovkh .ovff.bk .hv>i{animation:ovhB 16s ease-in-out infinite}
@keyframes ovhA{0%,21%{transform:rotateY(0)}25%,73%{transform:rotateY(180deg)}75%,100%{transform:rotateY(0)}}
@keyframes ovhB{0%,71%{transform:rotateY(0)}75%,100%{transform:rotateY(180deg)}}
.ael #summary .ovfl.q4:hover .ovfi,.ael #summary .ovfl.q4:hover .hv>i{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){.ael #summary .ovfl.q4 .ovfi,.ael #summary .ovkh .ovff .hv>i{animation:none}}
@media (prefers-reduced-motion:reduce){.ael #summary .ovfl .ovfi{animation:none}}
.ael #summary .ovwl{flex:1;min-height:0;display:flex;gap:8px;background:linear-gradient(180deg,#F7F9FB,#fff);border-radius:6px;padding:4px 8px 4px 0;margin:0 -10px;overflow:hidden}
/* 14 Nov 13:08 (Umair): no 'Watch list' heading; Vendors / Parts are thin vertical tabs on the left edge so the list gets the full height */
.ael #summary .ovwl .wh{flex:0 0 20px;display:flex;flex-direction:column;gap:3px}
.ael #summary .ovwl .wh button{flex:1;writing-mode:vertical-rl;transform:rotate(180deg);font:600 9.5px var(--font-anthropic-sans);letter-spacing:.08em;text-transform:uppercase;border:0;background:#E9EDF1;color:#5B6770;border-radius:6px 0 0 6px;padding:0;cursor:pointer}
.ael #summary .ovwl .wh button:hover{color:#051C2C}
.ael #summary .ovwl[data-on="v"] .wh button[data-k="v"],.ael #summary .ovwl[data-on="p"] .wh button[data-k="p"]{background:#051C2C;color:#fff}
.ael #summary .ovwl .wps{position:relative;flex:1;min-height:0}
.ael #summary .ovwl .wp{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-around;transition:opacity .35s,transform .35s}
.ael #summary .ovwl[data-on="v"] .wp[data-p="p"],.ael #summary .ovwl[data-on="p"] .wp[data-p="v"]{opacity:0;transform:translateY(6px);pointer-events:none}
.ael #summary .ovwl .wr{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(50px,1fr) 44px;align-items:center;gap:8px}
.ael #summary .ovwl .wn{font-size:12.5px;color:#051C2C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15}
.ael #summary .ovwl .wn i{display:block;font-style:normal;font-size:10px;color:#8A949E;overflow:hidden;text-overflow:ellipsis}
.ael #summary .ovwl .wb{position:relative;height:9px;background:#E9EDF1;border-radius:5px}
.ael #summary .ovwl .wb span{position:absolute;left:0;top:0;bottom:0;border-radius:5px}
.ael #summary .ovwl .wb em{position:absolute;left:66.7%;top:-4px;bottom:-4px;width:1.5px;background:#051C2C}
.ael #summary .ovwl .wr b{font-size:13px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
.ovm .ovwd{max-height:420px;overflow-y:auto;padding-right:6px;scrollbar-width:thin;scrollbar-color:#D5DBE1 transparent}
.ovm .ovwd::-webkit-scrollbar{width:7px}.ovm .ovwd::-webkit-scrollbar-track{background:transparent}.ovm .ovwd::-webkit-scrollbar-thumb{background:#D5DBE1;border-radius:4px}.ovm .ovwd::-webkit-scrollbar-thumb:hover{background:#B9C1C9}
.ovm .ovwd .wr{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(80px,1fr) 52px;align-items:center;gap:10px;height:28px;border-bottom:1px solid #F1F3F5}
.ovm .ovwd .wr[data-c]{cursor:help}
.ovm .ovwd .wn{font-size:12.5px;color:#051C2C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1}
.ovm .ovwd .wn i{display:block;font-style:normal;font-size:10px;color:#8A949E;overflow:hidden;text-overflow:ellipsis}
.ovm .ovwd .wb{position:relative;height:9px;background:#E9EDF1;border-radius:5px}
.ovm .ovwd .wb span{position:absolute;left:0;top:0;bottom:0;border-radius:5px}
.ovm .ovwd .wb em{position:absolute;left:66.7%;top:-4px;bottom:-4px;width:1.5px;background:#051C2C}
.ovm .ovwd .wr b{font-size:13px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
#vpop{z-index:260}
#vpop .ovrw{display:block;position:static;width:440px;box-shadow:0 6px 20px rgba(5,28,44,.18)}
.ael #summary .ovwl .wr[data-c]{cursor:help}
.ael #summary .ovwl .we{font-size:12px;color:#1E8C5A;text-align:center}
.ael #summary .ovf3{display:grid}
.ael #summary .ovkh .ovf3 .ovff{grid-area:1/1;background:#fff;animation:ov3 12s ease-in-out infinite}
.ael #summary .ovkh .ovf3 .f1{animation-delay:-8s}.ael #summary .ovkh .ovf3 .f2{animation-delay:-4s}
.ael #summary .ovf3:hover .ovff{animation-play-state:paused}
@keyframes ov3{0%,29%{opacity:1;transform:none}33%,96%{opacity:0;transform:rotateX(90deg)}100%{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ael #summary .ovkh .ovf3 .ovff{animation:none}.ael #summary .ovkh .ovf3 .f1,.ael #summary .ovkh .ovf3 .f2{display:none}}
.ael #summary .ovvt{position:relative}
/* 14 Nov 23:54 (Umair): the raw-material switch is a small round 'RM' button in the header; struck through = raw material left out */
.ael #summary .hd .tgrm{flex:0 0 auto;width:32px;height:32px;border-radius:50%;padding:0;margin:0;display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-anthropic-sans),Arial,sans-serif;font-size:10.5px;font-weight:700;line-height:1;letter-spacing:.02em;background:#fff;border:1.5px solid #C9D1D9;color:#5B6770;position:relative}
.ael #summary .hd .tgrm:hover{border-color:#1F9E89;color:#1F9E89}
.ael #summary .hd .tgrm.on{background:#E3F3F0;border-color:#1F9E89;color:#1F9E89}
.ael #summary .hd .tgrm.on span::after{content:'';position:absolute;left:6px;right:6px;top:50%;height:1.5px;background:currentColor;transform:rotate(-35deg)}
.ael #summary .hd .tgrm.tgrm::before,.ael #summary .hd .tgrm.tgrm.on::before{content:none;display:none}
.ael #summary .ovvt .tgc{position:absolute;top:4px;right:6px;z-index:1;margin:0;font-size:9.5px;padding:3px 8px}   /* raw-material switch sits in the chart's top-right corner so the header keeps room for the KPI and symbol */
.ael #summary .hd .tgc.on{background:#1F9E89;border-color:#1F9E89;color:#fff}
.ael #summary .ovhb{flex:0 0 auto;display:flex;gap:3px;margin-top:2px}
.ael #summary .ovhb div{min-width:0;display:flex;flex-direction:column}
.ael #summary .ovhb i{display:block;height:20px;border-radius:3px;color:#fff;font:700 10.5px var(--font-anthropic-sans);font-style:normal;padding:4px 5px 0;white-space:nowrap;overflow:hidden}
.ael #summary .ovhb span{font-size:10.5px;font-weight:600;color:#33414B;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ael #summary .ovhb em{font-style:normal;font-size:10px;color:#5B6770;white-space:nowrap}
#summary svg.ovflp .pA,#summary svg.ovflp .pB{transition:opacity .5s ease}
#summary svg.ovflp[data-on="a"] .pB,#summary svg.ovflp[data-on="b"] .pA{opacity:0;pointer-events:none}
#summary svg.ovflp .pC{transition:opacity .5s ease}
#summary svg.ovflp:not([data-on="c"]) .pC,#summary svg.ovflp[data-on="c"] .pA,#summary svg.ovflp[data-on="c"] .pB{opacity:0;pointer-events:none}
.ael #summary .ovbc .ovv{margin:0 -10px;padding-top:6px}
.ael #summary .tg:hover{border-color:#1F9E89;color:#1F9E89}
.ael #summary .tg.on{background:#1F9E89;border-color:#1F9E89;color:#fff}
.ael #summary .tg.on::before{content:'✓ '}`;
  document.head.appendChild(css);

  /* ---------- small chart helpers (sized to their box) ---------- */
  const mk = (el, h) => { el.replaceChildren(); const w = Math.max(160, el.clientWidth || 300); h = h || Math.max(90, el.clientHeight || 160);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', h).attr('viewBox', `0 0 ${w} ${h}`); return { svg, w, h }; };
  const none = (el, msg) => { el.innerHTML = `<div class="em" style="color:#5B6770;font-size:12px;text-align:center;padding:20px 0">${esc(msg)}</div>`; };
  const axisY = (svg, y, x0, x1, fmt, n = 4) => { svg.append('g').selectAll('line').data(y.ticks(n)).join('line').attr('x1', x0).attr('x2', x1).attr('y1', d => y(d)).attr('y2', d => y(d)).attr('stroke', '#EEF1F4');
    svg.append('g').selectAll('text').data(y.ticks(n)).join('text').attr('x', x0 - 4).attr('y', d => y(d) + 3).attr('text-anchor', 'end').attr('font-size', 9.5).attr('fill', '#5B6770').text(fmt); };
  /* lines: xs labels, series [{name,color,values,dash}] */
  function lineC(el, xs, S, o = {}) { if (!xs.length) return none(el, o.empty || 'No data'); const { svg, w, h } = mk(el, o.h); const ml = o.ml ?? 38, mb = 16, mt = 6;
    const all = S.flatMap(s => s.values).filter(v => v != null); if (o.ref != null) all.push(o.ref);
    const y = d3.scaleLinear().domain([o.min ?? Math.min(0, d3.min(all)), (d3.max(all) || 1) * 1.05]).nice().range([h - mb, mt]), x = d3.scalePoint().domain(d3.range(xs.length)).range([ml, w - 6]);
    axisY(svg, y, ml, w - 6, o.yFmt || kf, o.h && o.h > 200 ? 5 : 3);
    if (o.ref != null) svg.append('line').attr('x1', ml).attr('x2', w - 6).attr('y1', y(o.ref)).attr('y2', y(o.ref)).attr('stroke', '#8A949E').attr('stroke-dasharray', '3 3');
    S.forEach(s => svg.append('path').attr('d', d3.line().defined(v => v != null).x((v, i) => x(i)).y(v => y(v))(s.values)).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', s.width || 2.6).attr('stroke-linejoin', 'round').attr('stroke-dasharray', s.dash || null));
    const step = Math.max(1, Math.ceil(xs.length / (w / 46)));
    xs.forEach((t, i) => { if (i % step === 0 || i === xs.length - 1) svg.append('text').attr('x', x(i)).attr('y', h - 3).attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#5B6770').text(o.xFmt ? o.xFmt(t) : t); });
    const hv = svg.append('rect').attr('x', ml).attr('y', mt).attr('width', w - ml - 6).attr('height', h - mb - mt).attr('fill', 'transparent');
    hv.on('mousemove', ev => { const [mx] = d3.pointer(ev); const i = Math.max(0, Math.min(xs.length - 1, Math.round((mx - ml) / ((w - ml - 6) / Math.max(1, xs.length - 1))))); tip.show(ev, [o.xFmt ? o.xFmt(xs[i]) : xs[i], ...S.map(s => `${s.name}: ${s.values[i] == null ? '—' : (o.fmt || kf)(s.values[i])}`)]); }).on('mouseleave', tip.hide); }
  /* vertical columns: cats, series [{name,color}], get(cat, s) ; o.stack */
  function colC(el, cats, S, get, o = {}) { if (!cats.length) return none(el, o.empty || 'No data'); const { svg, w, h } = mk(el, o.h); const ml = o.ml ?? 38, mb = o.rot ? 46 : 16, mt = 6;
    const tot = c => o.stack ? d3.sum(S, s => Math.max(0, get(c, s) || 0)) : d3.max(S, s => get(c, s) || 0);
    const y = d3.scaleLinear().domain([0, (d3.max(cats, tot) || 1) * (o.vals ? 1.22 : 1.06)]).nice().range([h - mb, mt]), x = d3.scaleBand().domain(d3.range(cats.length)).range([ml, w - 4]).padding(cats.length > 12 ? 0.18 : 0.14);
    const x1 = d3.scaleBand().domain(S.map(s => s.name)).range([0, x.bandwidth()]).padding(0.05);
    axisY(svg, y, ml, w - 4, o.yFmt || kf, o.h && o.h > 200 ? 5 : 3);
    cats.forEach((c, i) => { let y0 = 0; const L = [o.cFmt ? o.cFmt(c) : c, ...S.map(s => `${s.name}: ${(o.fmt || kf)(get(c, s) || 0)}`)];
      S.forEach(s => { const v = Math.max(0, get(c, s) || 0); const bx = o.stack ? x(i) : x(i) + x1(s.name), bw = o.stack ? x.bandwidth() : x1.bandwidth();
        const fill = typeof s.color === 'function' ? s.color(c) : s.color; /* 19 Nov (Umair): colour can follow the day, as in Daily Production */
        svg.append('rect').attr('x', bx).attr('y', y(y0 + v)).attr('width', bw).attr('height', Math.max(0, y(y0) - y(y0 + v))).attr('fill', fill)
          .on('mousemove', ev => tip.show(ev, L)).on('mouseleave', tip.hide);
        /* 19 Nov (Umair): value labels like the Production tab's Daily Production chart (rotated, inside the bar when it fits) */
        if (o.vals && !o.stack && v > 0 && bw >= 6) { const t = v >= 1e6 ? d3.format('.2f')(v / 1e6) + 'M' : v >= 1000 ? d3.format('.1f')(v / 1000) + 'k' : d3.format(',.0f')(v), tl = t.length * 5.6 + 4, bh = y(0) - y(v), cx = bx + bw / 2, inside = bh >= tl + 4, ty = inside ? y(v) + 4 : y(v) - 3, dark = fill !== C.plan && fill !== '#DCE3EA' && fill !== '#C9D1D9';
          svg.append('text').attr('transform', `translate(${cx + (bw >= 9 ? 3.2 : 2.6)},${ty}) rotate(-90)`).attr('text-anchor', inside ? 'end' : 'start').style('font-size', bw >= 12 ? '9.5px' : bw >= 9 ? '8.5px' : '7.5px').style('font-weight', 600).style('pointer-events', 'none').style('fill', inside && dark ? '#fff' : C.navy).text(t); }
        if (o.stack) y0 += v; });
      const lb = o.cFmt ? o.cFmt(c) : c, step = Math.max(1, Math.ceil(cats.length / (w / (o.rot ? 18 : 40))));
      if (i % step === 0 || i === cats.length - 1) { const t = svg.append('text').attr('font-size', 9).attr('fill', '#5B6770');
        if (o.rot) t.attr('transform', `translate(${x(i) + x.bandwidth() / 2 + 3},${h - mb + 6}) rotate(-45)`).attr('text-anchor', 'end').text(String(lb).length > 14 ? String(lb).slice(0, 13) + '…' : lb);
        else t.attr('x', x(i) + x.bandwidth() / 2).attr('y', h - 3).attr('text-anchor', 'middle').text(lb); } });
    svg.append('line').attr('x1', ml).attr('x2', w - 4).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', '#051C2C'); }
  /* horizontal bars: items [{label, v, plan?, color?, tip?}] ; o.pct shows v as % with 100 line */
  function hbarC(el, items, o = {}) { if (!items.length) return none(el, o.empty || 'No data'); const rh = o.rh || 20, lw = o.lw || 120, h = o.h || Math.max(items.length * rh + 18, Math.min(el.clientHeight || 0, items.length * 44 + 18)); const { svg, w } = mk(el, h);
    const mx = Math.min(o.cap || Infinity, o.max || d3.max(items, d => Math.max(d.v || 0, d.plan || 0, o.ref || 0)) || 1), x = d3.scaleLinear().domain([0, mx * 1.05]).range([lw, w - 62]);
    const rh2 = (h - 18) / items.length;
    items.forEach((d, i) => { const y = 4 + i * rh2, bh = Math.max(8, Math.min(26, rh2 * 0.7));
      const lt = svg.append('text').attr('x', lw - 6).attr('y', y + bh / 2 + 3.5).attr('text-anchor', 'end').attr('font-size', o.fs || 11).attr('fill', '#051C2C').text(d.label.length > (o.lc || 20) ? d.label.slice(0, (o.lc || 20) - 1) + '…' : d.label);
      /* 18 Nov 17:19 (Umair): o.pick makes a shop name (and its bar) a filter for the whole window; the picked one is bold, click it again to clear */
      if (o.pick) { const on = o.sel != null && o.sel === d.label; lt.attr('class', 'hpick').attr('font-weight', on ? 700 : null).style('cursor', 'pointer').on('click', ev => { ev.stopPropagation(); tip.hide(); o.pick(d.label); }); lt.append('title').text(on ? `Click to show all shops` : `Click to filter this window to ${d.label}`); }
      else lt.append('title').text(d.label);
      if (d.plan != null) svg.append('rect').attr('x', lw).attr('y', y).attr('width', Math.max(0, x(d.plan) - lw)).attr('height', bh).attr('fill', '#E6E9EC');
      svg.append('rect').attr('x', lw).attr('y', y + (d.plan != null ? bh * 0.2 : 0)).attr('width', Math.max(0.5, x(Math.min(mx * 1.05, Math.max(0, d.v || 0))) - lw)).attr('height', d.plan != null ? bh * 0.6 : bh).attr('fill', d.color || C.navy)
        .on('mousemove', ev => tip.show(ev, d.tip || [d.label, (o.fmt || kf)(d.v)])).on('mouseleave', tip.hide)
        .style('cursor', o.pick ? 'pointer' : null).on('click', o.pick ? ev => { ev.stopPropagation(); tip.hide(); o.pick(d.label); } : null);
      svg.append('text').attr('x', Math.min(w - 44, x(Math.min(mx * 1.05, Math.max(d.v || 0, d.plan || 0))) + 4)).attr('y', y + bh / 2 + 3.5).attr('font-size', 10.5).attr('font-weight', 600).attr('fill', '#33414B').text(d.lab ?? (o.fmt || kf)(d.v)); });
    if (o.ref != null) svg.append('line').attr('x1', x(o.ref)).attr('x2', x(o.ref)).attr('y1', 0).attr('y2', h - 14).attr('stroke', '#8A949E').attr('stroke-dasharray', '3 3');
    svg.append('line').attr('x1', lw).attr('x2', lw).attr('y1', 0).attr('y2', h - 14).attr('stroke', '#051C2C'); }
  /* 18 Nov 17:25 (Umair): long part lists scroll inside the chart box instead of squeezing the bars */
  function hbarS(el, items, o = {}) { if (items.length <= 11) return hbarC(el, items, o); const d = document.createElement('div'); d.className = 'ovwd'; d.style.maxHeight = (o.h || 260) + 'px'; el.appendChild(d); return hbarC(d, items, { ...o, h: items.length * 24 + 18 }); }
  /* 15 Nov 11:29 (Umair): Cost of Production card body - pane A conversion cost by month (current month actual + hatched run-rate projection,
     dashed line at last month's total), pane B conversion cost per part by shop vs last month. Panes flip with the other cards (window.__ovFL). */
  function costFlip(el, cv) { if (!cv || !cv.M.length) return none(el, 'No data'); const { svg, w, h } = mk(el);
    svg.classed('ovflp', true).attr('data-on', 'a'); const pA = svg.append('g').attr('class', 'pA'), pB = svg.append('g').attr('class', 'pB');
    const pid = 'cvh' + Math.random().toString(36).slice(2, 7);
    svg.append('defs').append('pattern').attr('id', pid).attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)')
      .append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', '#8C6BD8').attr('stroke-width', 2);
    const M = cv.M.slice(-6), ml = 34, mb = 30, mt = 14, top = d => d.m === cv.cur && cv.live ? Math.max(d.tot, cv.proj || 0) : d.tot;
    const y = d3.scaleLinear().domain([0, (d3.max(M, top) || 1) * 1.08]).nice().range([h - mb, mt]), x = d3.scaleBand().domain(M.map(d => d.m)).range([ml, w - 4]).padding(0.2);
    const yf = v => v >= 1e6 ? f0(v / 1e6) + 'M' : kf(v); axisY(pA, y, ml, w - 4, yf, 3);
    M.forEach(d => { let y0 = 0; const isC = d.m === cv.cur && cv.live;
      const L = [mon(d.m) + (isC ? ` to ${dlab(cv.asof)}` : ''), ...cv.CV.map(([k]) => `${k}: ${rs(d.parts[k])}`), `Conversion: ${rs(d.tot)}${d.units ? ` · Rs ${f1(d.tot / d.units)} per part` : ''}`, `Material: ${rs(d.mat)}`, `COGM: ${rs(d.tot + d.mat)}`, ...(isC ? [`Projected conversion: ${rs(cv.proj)} (run rate x ${cv.nd}/${cv.el} days)`] : []), ...(d.parts.Labour ? [] : ['Labour not in the data for this month'])];
      cv.CV.forEach(([k, c]) => { const v = Math.max(0, d.parts[k] || 0); if (!v) return; pA.append('rect').attr('x', x(d.m)).attr('y', y(y0 + v)).attr('width', x.bandwidth()).attr('height', Math.max(0, y(y0) - y(y0 + v))).attr('fill', c).on('mousemove', ev => tip.show(ev, L)).on('mouseleave', tip.hide); y0 += v; });
      if (isC && cv.proj > d.tot) { pA.append('rect').attr('x', x(d.m) + 0.5).attr('y', y(cv.proj)).attr('width', x.bandwidth() - 1).attr('height', Math.max(0, y(d.tot) - y(cv.proj))).attr('fill', `url(#${pid})`).attr('stroke', '#8C6BD8').on('mousemove', ev => tip.show(ev, L)).on('mouseleave', tip.hide);
        pA.append('text').attr('x', x(d.m) + x.bandwidth() / 2).attr('y', y(cv.proj) - 4).attr('text-anchor', 'middle').attr('font-size', 9.5).attr('font-weight', 700).attr('fill', '#5B3FB0').text(yf(cv.proj) + ' proj.'); }
      pA.append('text').attr('x', x(d.m) + x.bandwidth() / 2).attr('y', h - mb + 11).attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#5B6770').text(mon(d.m).slice(0, 3)); });
    const pv = M.find(d => d.m === cv.prev); if (pv && cv.live) pA.append('line').attr('x1', ml).attr('x2', w - 4).attr('y1', y(pv.tot)).attr('y2', y(pv.tot)).attr('stroke', '#051C2C').attr('stroke-dasharray', '4 3');
    pA.append('line').attr('x1', ml).attr('x2', w - 4).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', '#051C2C');
    const lg = pA.append('g').attr('transform', `translate(${ml},${h - 6})`); let lx = 0;
    [...cv.CV, ...(cv.live ? [['Projection', null]] : [])].forEach(([k, c]) => { const g = lg.append('g').attr('transform', `translate(${lx},0)`);
      g.append('rect').attr('y', -7).attr('width', 8).attr('height', 8).attr('fill', c || `url(#${pid})`).attr('stroke', c ? null : '#8C6BD8');
      const t = g.append('text').attr('x', 11).attr('font-size', 9).attr('fill', '#33414B').text(k); let tw = 40; try { tw = t.node().getComputedTextLength(); } catch (e) {} lx += tw + 20; });
    if (lx > w - ml) lg.attr('transform', `translate(${ml},${h - 6}) scale(${(w - ml) / lx},1)`);
    /* pane B: shop ranking */
    const S = cv.shops, tb = Math.max(40, h - 6);
    pB.append('rect').attr('x', 0).attr('y', (h - tb) / 2).attr('width', 20).attr('height', tb).attr('rx', 6).attr('fill', '#051C2C');
    pB.append('text').attr('transform', `translate(10,${h / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', 9.5).attr('font-weight', 600).attr('letter-spacing', '.08em').attr('fill', '#fff').text(('Cost / part vs ' + (cv.prev ? mon(cv.prev).slice(0, 3) : 'last month')).toUpperCase());
    if (!S.length) { pB.append('text').attr('x', w / 2).attr('y', h / 2).attr('text-anchor', 'middle').attr('font-size', 12).attr('fill', '#5B6770').text('No earlier month to compare'); return; }
    const n = Math.min(S.length, Math.max(4, Math.floor((h - 4) / 19))), L = S.length > n ? [...S.slice(0, n - 2), ...S.slice(-2)] : S, rh = (h - 4) / L.length, lw = Math.min(118, (w - 30) * 0.4), x0 = 30 + lw;
    const cap = 40, mx = Math.min(cap, Math.max(10, d3.max(L, d => Math.abs(d.v)))), half = (w - x0 - 44), sx = v => v / mx * half * (d3.min(L, d => d.v) < 0 ? 0.62 : 1), ax = x0 + (d3.min(L, d => d.v) < 0 ? half * 0.38 : 0);
    L.forEach((d, i) => { const yy = 2 + i * rh, bh = Math.min(14, rh * 0.62), c = d.v > 5 ? C.bad : d.v > 2 ? '#E0A100' : '#1E8C5A', bw = sx(Math.max(-mx, Math.min(mx, d.v))), cut = Math.abs(d.v) > mx;   /* an outlier is drawn to the scale's end with a break, its true % beside it */
      const T = [d.k, `Rs ${f1(d.now)} per part in ${mon(cv.cur)}`, `Rs ${f1(d.prev)} in ${mon(cv.prev)}`, `${d.v >= 0 ? '+' : ''}${f1(d.v)}%`];
      const t = pB.append('text').attr('x', 30).attr('y', yy + rh / 2).attr('dy', '0.35em').attr('font-size', 10.5).attr('fill', '#33414B').text(d.k);
      try { while (t.node().getComputedTextLength() > lw - 6 && t.text().length > 4) t.text(t.text().slice(0, -2) + '…'); } catch (e) {}
      pB.append('rect').attr('x', bw >= 0 ? ax : ax + bw).attr('y', yy + (rh - bh) / 2).attr('width', Math.max(2, Math.abs(bw))).attr('height', bh).attr('fill', c);
      if (cut) { const bx = bw >= 0 ? ax + bw - 12 : ax + bw + 8; pB.append('path').attr('d', `M${bx},${yy + (rh - bh) / 2 - 1}l4,${bh + 2}M${bx + 4},${yy + (rh - bh) / 2 - 1}l4,${bh + 2}`).attr('stroke', '#fff').attr('stroke-width', 2); }
      pB.append('text').attr('x', bw >= 0 ? ax + bw + 4 : ax + 4).attr('y', yy + rh / 2).attr('dy', '0.35em').attr('font-size', 10).attr('font-weight', 700).attr('fill', '#051C2C').text(`${d.v >= 0 ? '+' : '−'}${f0(Math.abs(d.v))}%`);
      pB.append('rect').attr('x', 24).attr('y', yy).attr('width', w - 24).attr('height', rh).attr('fill', 'transparent').on('mousemove', ev => tip.show(ev, T)).on('mouseleave', tip.hide); });
    pB.append('line').attr('x1', ax).attr('x2', ax).attr('y1', 0).attr('y2', h - 2).attr('stroke', '#051C2C'); }
  /* 15 Nov 17:42 (Umair): VA/CR card body - pane A savings landing line (completed vs plan by target month), pane B shops by stage */
  function savFlip(el, sv) { if (!sv) return none(el, 'No data'); const { svg, w, h } = mk(el);
    svg.classed('ovflp', true).attr('data-on', 'a'); const pA = svg.append('g').attr('class', 'pA'), pB = svg.append('g').attr('class', 'pB');
    const G = '#1E8C5A', A = '#E0A100', Q = '#9AA5B1', ml = 34, mb = 30, mt = 16;
    const mx = d3.max([...sv.planC, ...sv.doneC.filter(v => v != null)]) || 1, y = d3.scaleLinear().domain([0, mx * 1.08]).nice().range([h - mb, mt]), x = d3.scalePoint().domain(d3.range(12)).range([ml + 4, w - 10]);
    const yf = v => v >= 1e6 ? f0(v / 1e6) + 'M' : kf(v); axisY(pA, y, ml, w - 4, yf, 3);
    pA.append('line').attr('x1', ml).attr('x2', w - 4).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', '#c5ccd4');
    pA.append('path').attr('d', d3.line().x((v, i) => x(i)).y(v => y(v))(sv.planC)).attr('fill', 'none').attr('stroke', Q).attr('stroke-width', 2).attr('stroke-dasharray', '5 4');
    pA.append('path').attr('d', d3.line().defined(v => v != null).x((v, i) => x(i)).y(v => y(v))(sv.doneC)).attr('fill', 'none').attr('stroke', G).attr('stroke-width', 3.2).attr('stroke-linejoin', 'round');
    const ci = sv.FM.indexOf(sv.cm);
    if (ci >= 0) { pA.append('circle').attr('cx', x(ci)).attr('cy', y(sv.doneNow)).attr('r', 4.5).attr('fill', G);
      pA.append('text').attr('x', x(ci) + 7).attr('y', y(sv.doneNow) + 14).attr('font-size', 10).attr('font-weight', 700).attr('fill', G).text(yf(sv.doneNow) + ' today');
      if (sv.gap > 0) { pA.append('line').attr('x1', x(ci)).attr('x2', x(ci)).attr('y1', y(sv.planNow)).attr('y2', y(sv.doneNow)).attr('stroke', C.bad).attr('stroke-width', 2);
        pA.append('text').attr('x', x(ci) - 5).attr('y', y(sv.planNow) - 5).attr('text-anchor', 'end').attr('font-size', 10).attr('font-weight', 700).attr('fill', C.bad).text('gap ' + yf(sv.gap)); } }
    pA.append('text').attr('x', x(11)).attr('y', y(sv.planC[11]) - 6).attr('text-anchor', 'end').attr('font-size', 9.5).attr('fill', '#33414B').text(`plan ${yf(sv.planC[11])} by ${mon(sv.FM[11]).slice(0, 3)}`);
    sv.FM.forEach((m, i) => { if (w < 330 && i % 2) return; pA.append('text').attr('x', x(i)).attr('y', h - mb + 12).attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#5B6770').text(mon(m).slice(0, 3)); });
    pA.append('text').attr('x', ml).attr('y', h - 4).attr('font-size', 9).attr('fill', '#5B6770').text('Annual saving switched on: — completed   - - ideas by target month');
    const hv = pA.append('rect').attr('x', ml).attr('y', mt).attr('width', w - ml).attr('height', h - mb - mt).attr('fill', 'transparent');
    hv.on('mousemove', ev => { const [mx_] = d3.pointer(ev); const i = d3.minIndex(d3.range(12), j => Math.abs(x(j) - mx_)); tip.show(ev, [mon(sv.FM[i]), `Plan (ideas due by then): ${rs(sv.planC[i])} a year`, ...(sv.doneC[i] != null ? [`Completed: ${rs(sv.doneC[i])} a year`] : [])]); }).on('mouseleave', tip.hide);
    /* pane B */
    const S = sv.shops.filter(d => d.c + d.p + d.q > 0), n = Math.min(S.length, Math.max(3, Math.floor((h - 22) / 22))), L = S.slice(0, n), rh = (h - 22) / Math.max(1, L.length), lw = Math.min(112, w * 0.32);
    const sx = d3.scaleLinear().domain([0, d3.max(L, d => d.c + d.p + d.q) || 1]).range([0, w - lw - 46]);
    L.forEach((d, i) => { const yy = i * rh, bh = Math.min(16, rh * 0.62), y0 = yy + (rh - bh) / 2, T_ = [d.k, `Completed ${rs(d.c)}`, `In progress ${rs(d.p)}`, `Pending / proposal ${rs(d.q)}`, `Total ${rs(d.c + d.p + d.q)} a year`];
      const t = pB.append('text').attr('x', 0).attr('y', yy + rh / 2).attr('dy', '0.35em').attr('font-size', 10.5).attr('fill', '#33414B').text(d.k);
      try { while (t.node().getComputedTextLength() > lw - 6 && t.text().length > 4) t.text(t.text().slice(0, -2) + '…'); } catch (e) {}
      let x0 = lw; [[d.c, G], [d.p, A], [d.q, Q]].forEach(([v, c]) => { if (v > 0) { pB.append('rect').attr('x', x0).attr('y', y0).attr('width', Math.max(1, sx(v))).attr('height', bh).attr('fill', c); x0 += sx(v); } });
      pB.append('text').attr('x', x0 + 4).attr('y', yy + rh / 2).attr('dy', '0.35em').attr('font-size', 10).attr('font-weight', 700).attr('fill', '#051C2C').text(yf(d.c + d.p + d.q));
      pB.append('rect').attr('x', 0).attr('y', yy).attr('width', w).attr('height', rh).attr('fill', 'transparent').on('mousemove', ev => tip.show(ev, T_)).on('mouseleave', tip.hide); });
    const lg = pB.append('g').attr('transform', `translate(0,${h - 6})`); let lx = 0;
    [['Completed', G], ['In progress', A], ['Pending / proposal', Q]].forEach(([k, c]) => { const g = lg.append('g').attr('transform', `translate(${lx},0)`); g.append('rect').attr('y', -7).attr('width', 8).attr('height', 8).attr('fill', c);
      const t = g.append('text').attr('x', 11).attr('font-size', 9).attr('fill', '#33414B').text(k); let tw = 50; try { tw = t.node().getComputedTextLength(); } catch (e) {} lx += tw + 22; }); }
  /* 15 Nov 19:19 (Umair): Manpower card body - pane A labour hours bridge, pane B weekly overtime bought vs hours lost, pane C shop quadrant */
  function wfFlip(el, wf) { if (!wf) return none(el, 'No data'); const { svg, w, h } = mk(el);
    svg.classed('ovflp', true).attr('data-on', 'a').attr('data-n', '3'); const pA = svg.append('g').attr('class', 'pA'), pB = svg.append('g').attr('class', 'pB'), pC = svg.append('g').attr('class', 'pC');
    const R = C.bad, N = '#2251FF', yf = v => v >= 1e3 ? f1(v / 1e3) + 'k' : f0(v);
    /* A: bridge */
    { const B = wf.bridge, mt = 30, mb = 30, base = h - mb, mx = Math.max(B.ros, B.worked) * 1.08, sy = v => v / mx * (base - mt - 14), bw = Math.min(70, (w - 20) / 4 - 16), gap = (w - 4 * bw) / 4;
      const X = i => gap / 2 + i * (bw + gap), steps = [['Rostered', 0, B.ros, '#CFD8E3', yf(B.ros), `${nf(Math.round(B.people))} people`], ['Absence', B.ros - B.lost, B.ros, R, '−' + yf(B.lost), f1(B.ap) + '%'],
        ['Overtime', B.ros - B.lost, B.ros - B.lost + B.ot, N, '+' + yf(B.ot), rs(B.otRs)], ['Worked', 0, B.worked, '#051C2C', yf(B.worked), '']];
      /* 16 Nov 10:17 (Umair): title and the 'x% of hours worked are overtime' line removed */
      const pct = B.worked ? B.ot / B.worked * 100 : 0, rat = B.lost ? B.ot / B.lost : 0;
      pA.append('rect').attr('x', 0).attr('y', 0).attr('width', Math.min(w, 220)).attr('height', 18).attr('rx', 5).attr('fill', '#EEF3FF');
      pA.append('text').attr('x', 7).attr('y', 12.5).attr('font-size', 9.5).attr('fill', '#33414B').text(`${f1(rat)} OT hours per hour lost to absence`);
      pA.append('line').attr('x1', 0).attr('x2', w).attr('y1', base).attr('y2', base).attr('stroke', '#c5ccd4');
      steps.forEach(([lab, y0, y1, c, top, sub], i) => { const t = base - sy(Math.max(y0, y1)), x = X(i);
        pA.append('rect').attr('x', x).attr('y', t).attr('width', bw).attr('height', Math.max(1, sy(Math.abs(y1 - y0)))).attr('fill', c)
          .on('mousemove', ev => tip.show(ev, [lab, top + ' hours', ...(sub ? [sub] : [])])).on('mouseleave', tip.hide);
        pA.append('text').attr('x', x + bw / 2).attr('y', t - 5).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 700).attr('fill', '#051C2C').text(top);
        pA.append('text').attr('x', x + bw / 2).attr('y', base + 12).attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', '#33414B').text(lab);
        if (sub) pA.append('text').attr('x', x + bw / 2).attr('y', base + 24).attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', '#5B6770').text(sub);
        if (i < 3) { const ny = i === 0 ? y1 : i === 1 ? y0 : y1; pA.append('line').attr('x1', x + bw).attr('x2', X(i + 1)).attr('y1', base - sy(ny)).attr('y2', base - sy(ny)).attr('stroke', '#9aa5b1').attr('stroke-dasharray', '2 2'); } }); }
    /* B: weekly mirror */
    { const W = wf.W, mt = 30, mb = 34, mid = mt + (h - mt - mb) * 0.55, up = mid - mt - 14, dn = h - mb - mid - 14, mx = d3.max(W, d => d.ot) || 1, ml = d3.max(W, d => d.lost) || 1, s_ = Math.min(up / mx, dn / ml);
      const bw = Math.min(36, (w - 50) / W.length - 14), X = i => 46 + i * ((w - 50) / W.length);
      pB.append('text').attr('x', 0).attr('y', 11).attr('font-size', 11).attr('font-weight', 700).attr('fill', '#33414B').text('Overtime bought vs hours lost, by week');
      pB.append('text').attr('x', 0).attr('y', mt + 10).attr('font-size', 9).attr('fill', N).text('▲ OT h'); pB.append('text').attr('x', 0).attr('y', h - mb - 4).attr('font-size', 9).attr('fill', R).text('▼ lost h');
      pB.append('line').attr('x1', 40).attr('x2', w).attr('y1', mid).attr('y2', mid).attr('stroke', '#051C2C');
      W.forEach((d, i) => { const x = X(i), op = d.inc ? 0.4 : 1, T = [`Week of ${dlab(d.k)}${d.inc ? ' (sheet not complete)' : ''}`, `Overtime ${nf(Math.round(d.ot))} h · ${rs(d.ot * 42500 / 26 / 8 * 1.5)}`, `Lost to absence ${nf(Math.round(d.lost))} h`, `Absenteeism ${d.ap == null ? '—' : f1(d.ap) + '%'}`];
        pB.append('rect').attr('x', x).attr('y', mid - d.ot * s_).attr('width', bw).attr('height', d.ot * s_).attr('fill', N).attr('opacity', op);
        pB.append('text').attr('x', x + bw / 2).attr('y', mid - d.ot * s_ - 3).attr('text-anchor', 'middle').attr('font-size', 9).attr('font-weight', 700).attr('fill', '#051C2C').text(yf(d.ot));
        pB.append('rect').attr('x', x).attr('y', mid).attr('width', bw).attr('height', d.lost * s_).attr('fill', R).attr('opacity', op);
        pB.append('text').attr('x', x + bw / 2).attr('y', mid + d.lost * s_ + 10).attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', R).text(yf(d.lost));
        pB.append('text').attr('x', x + bw / 2).attr('y', h - mb + 13).attr('text-anchor', 'middle').attr('font-size', 9.5).attr('font-weight', 700).attr('fill', d.ap > 13 ? R : d.ap > 10 ? '#9A6B00' : '#1E8C5A').text(d.ap == null ? '' : f1(d.ap) + '%');
        pB.append('text').attr('x', x + bw / 2).attr('y', h - mb + 25).attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', '#5B6770').text(dlab(d.k) + (d.inc ? '*' : ''));
        pB.append('rect').attr('x', x - 4).attr('y', mt).attr('width', bw + 8).attr('height', h - mt).attr('fill', 'transparent').on('mousemove', ev => tip.show(ev, T)).on('mouseleave', tip.hide); });
      if (W.some(d => d.inc)) pB.append('text').attr('x', w).attr('y', 11).attr('text-anchor', 'end').attr('font-size', 8.5).attr('fill', '#5B6770').text('* sheet not complete'); }
    /* C: quadrant */
    { const Q = wf.Q, ml = 40, mb = 26, mt = 10, x0 = Math.min(3, d3.min(Q, d => d.ap) || 0), x1 = Math.max(22, (d3.max(Q, d => d.ap) || 0) + 1), y1 = Math.max(100, d3.max(Q, d => d.oh) || 0);
      const X = d3.scaleLinear().domain([x0, x1]).range([ml, w - 8]), Y = d3.scaleSqrt().domain([0, y1]).range([h - mb, mt]), tY = Math.max(0.1, wf.ohAll);
      pC.append('rect').attr('x', X(10)).attr('y', mt).attr('width', w - 8 - X(10)).attr('height', Math.max(0, Y(tY) - mt)).attr('fill', '#FDECEC');
      pC.append('text').attr('x', w - 10).attr('y', mt + 12).attr('text-anchor', 'end').attr('font-size', 9.5).attr('font-weight', 700).attr('fill', R).text('ABSENT + OVERTIME');
      pC.append('text').attr('x', w - 10).attr('y', mt + 24).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', R).text('fix rostering');
      [0, 10, 25, 50, 100].filter(v => v <= y1).forEach(v => pC.append('text').attr('x', ml - 4).attr('y', Y(v) + 3).attr('text-anchor', 'end').attr('font-size', 8.5).attr('fill', '#9aa5b1').text(v));
      pC.append('line').attr('x1', ml).attr('x2', w - 8).attr('y1', h - mb).attr('y2', h - mb).attr('stroke', '#c5ccd4'); pC.append('line').attr('x1', ml).attr('x2', ml).attr('y1', mt).attr('y2', h - mb).attr('stroke', '#c5ccd4');
      pC.append('line').attr('x1', X(10)).attr('x2', X(10)).attr('y1', mt).attr('y2', h - mb).attr('stroke', '#051C2C').attr('stroke-dasharray', '3 3');
      pC.append('line').attr('x1', ml).attr('x2', w - 8).attr('y1', Y(tY)).attr('y2', Y(tY)).attr('stroke', '#051C2C').attr('stroke-dasharray', '3 3');
      pC.append('text').attr('x', (ml + w) / 2).attr('y', h - 6).attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', '#5B6770').text(`Absenteeism % → (lines: 10% target, ${f0(wf.ohAll)} OT h/head average)`);
      pC.append('text').attr('transform', `translate(10,${(mt + h - mb) / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', '#5B6770').text('OT hours per head →');
      const placed = [];
      Q.slice().sort((a, b) => b.oh - a.oh).forEach(d => { const cx = X(d.ap), cy = Y(d.oh), c = d.ap > 10 && d.oh > tY ? R : d.ap > 10 || d.oh > tY * 2.5 ? '#E0A100' : N;
        pC.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 5.5).attr('fill', c).attr('opacity', 0.9).on('mousemove', ev => tip.show(ev, [d.k, `Absenteeism ${f1(d.ap)}%`, `${f1(d.oh)} OT hours per head (${kf(d.ot)} h)`, `${nf(Math.round(d.hc))} people a day`])).on('mouseleave', tip.hide);
        if (c === N && !(d.ap < 6 || d.oh < tY / 3)) return;   /* ordinary shops: hover only, so labels stay readable */
        let right = cx < w - 90, ly = cy + 3.5; for (let k = 0; k < 4 && placed.some(p => Math.abs(p.y - ly) < 10 && Math.abs(p.x - cx) < 80); k++) ly += 10;
        placed.push({ x: cx, y: ly }); pC.append('text').attr('x', right ? cx + 8 : cx - 8).attr('y', ly).attr('text-anchor', right ? 'start' : 'end').attr('font-size', 9.5).attr('fill', '#33414B').text(d.k.replace('Carburetor ', 'Carb ').replace('Aluminium', 'Al').replace(' / Die Cast', '')); }); } }
  /* 15 Nov 22:17 (Umair): Capacity card body - A part bullets, B bottleneck of the most loaded part, C machine fleet */
  function capFlip(el, cp) { if (!cp) return none(el, 'No data'); const { svg, w, h } = mk(el);
    svg.classed('ovflp', true).attr('data-on', 'a').attr('data-n', '3'); const pA = svg.append('g').attr('class', 'pA'), pB = svg.append('g').attr('class', 'pB'), pC = svg.append('g').attr('class', 'pC');
    const R = C.bad, A = '#E0A100', G = '#1E8C5A', N = '#051C2C', ucol = u => u > 100 ? R : u > 85 ? A : G;
    /* A */
    { const L = cp.PB.slice().sort((a, b) => (b.u ?? -1) - (a.u ?? -1)), lw = Math.min(118, w * 0.33), x0 = lw, x1 = w - 46, rh = (h - 26) / Math.max(1, L.length);
      const mx = d3.max(L, d => Math.max(d.cap, d.plan, d.pace)) || 1, sx = v => v / mx * (x1 - x0);
      L.forEach((d, i) => { const y = i * rh, bh = Math.min(14, rh * 0.42), yc = y + rh / 2, T = [d.k, `Capacity ${kf(d.cap)} a month (bottleneck ${d.bn})`, d.plan ? `Nov plan ${kf(d.plan)} = ${pc(d.u)} load` : 'No Nov plan in Atlas', `Made ${kf(d.act)} to ${dlab(cp.end)} · pace ${kf(d.pace)} for the month`];
        const t = pA.append('text').attr('x', 0).attr('y', yc).attr('dy', '0.35em').attr('font-size', 10.5).attr('fill', '#33414B').text(d.k);
        try { while (t.node().getComputedTextLength() > lw - 6 && t.text().length > 4) t.text(t.text().slice(0, -2) + '…'); } catch (e) {}
        pA.append('rect').attr('x', x0).attr('y', yc - bh / 2).attr('width', sx(d.cap)).attr('height', bh).attr('fill', '#E6E9EC');
        pA.append('rect').attr('x', x0).attr('y', yc - bh / 4).attr('width', sx(Math.min(d.pace, mx))).attr('height', bh / 2).attr('fill', N);
        if (d.plan) pA.append('line').attr('x1', x0 + sx(d.plan)).attr('x2', x0 + sx(d.plan)).attr('y1', yc - bh / 2 - 3).attr('y2', yc + bh / 2 + 3).attr('stroke', ucol(d.u)).attr('stroke-width', 3);
        pA.append('text').attr('x', w).attr('y', yc).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 10.5).attr('font-weight', 700).attr('fill', d.plan ? ucol(d.u) : '#9A6B00').text(d.plan ? pc(d.u) : 'no plan');
        pA.append('rect').attr('x', 0).attr('y', y).attr('width', w).attr('height', rh).attr('fill', 'transparent').on('mousemove', ev => tip.show(ev, T)).on('mouseleave', tip.hide); });
      const lg = pA.append('g').attr('transform', `translate(0,${h - 4})`); let lx = 0;
      [['capacity / month', '#E6E9EC', 8], ['output at current pace', N, 4], ['Nov plan', R, 10]].forEach(([k, c, hh]) => { const g = lg.append('g').attr('transform', `translate(${lx},0)`);
        g.append('rect').attr('y', -4 - hh / 2).attr('width', k === 'Nov plan' ? 3 : 12).attr('height', hh).attr('fill', c); const t = g.append('text').attr('x', k === 'Nov plan' ? 7 : 16).attr('font-size', 9).attr('fill', '#33414B').text(k);
        let tw = 60; try { tw = t.node().getComputedTextLength(); } catch (e) {} lx += tw + 30; }); }
    /* B: bottleneck of the most loaded part - horizontal bars, one line of title, one line of advice (15 Nov 22:36: cleaner) */
    { const d = cp.top; if (d) { const O = d.ops.slice().sort((x, y) => x.op < y.op ? -1 : 1), sh = d.plan ? d.plan - d.cap : 0, k1 = v => v >= 1000 ? f1(v / 1000).replace(/\.0$/, '') + 'k' : f0(v);
      const tip_ = d.sb.length ? `Standby ${d.sb[0]} can run ${d.bn}` : d.sh < 3 ? `A 3rd shift on ${d.bn} adds ${k1(d.cap / d.sh)}` : '';
      pB.append('text').attr('x', 0).attr('y', 11).attr('font-size', 11).attr('font-weight', 700).attr('fill', '#33414B').text(`${d.k} · by operation`);
      if (sh > 0) pB.append('text').attr('x', w).attr('y', 11).attr('text-anchor', 'end').attr('font-size', 10.5).attr('font-weight', 700).attr('fill', R).text(`${d.bn} short ${k1(sh)}`);
      const top = 26, bot = tip_ && h > 120 ? 18 : 4, lw = 92, vw = 38, x0 = lw, x1 = w - vw, rh = Math.min(52, (h - top - bot) / O.length), bh = Math.min(18, rh * 0.5);
      const mx = Math.max(d3.max(O, o => o.cap), d.plan || 0) * 1.02, sx = v => v / mx * (x1 - x0), pxp = d.plan ? x0 + sx(d.plan) : -99;
      O.forEach((o, i) => { const y = top + i * rh + rh / 2, b_ = o.op === d.bn;
        pB.append('text').attr('x', 0).attr('y', y - 1).attr('font-size', 11).attr('font-weight', 700).attr('fill', N).text(o.op);
        pB.append('text').attr('x', 0).attr('y', y + 10).attr('font-size', 8.5).attr('fill', '#5B6770').text(`${o.n} m/c · ${o.ct} s`);
        pB.append('rect').attr('x', x0).attr('y', y - bh / 2).attr('width', sx(o.cap)).attr('height', bh).attr('rx', 2).attr('fill', b_ ? R : '#B7C0C9')
          .on('mousemove', ev => tip.show(ev, [`${d.k} · ${o.op}`, `${kf(o.cap)} pcs a month`, `${o.n} machine${o.n > 1 ? 's' : ''} · ${o.ct} s cycle · ${o.sh} shifts`])).on('mouseleave', tip.hide);
        pB.append('text').attr('x', (x0 + sx(o.cap) < pxp + 4 && x0 + sx(o.cap) > pxp - 40 ? pxp : x0 + sx(o.cap)) + 5).attr('y', y).attr('dy', '0.35em').attr('font-size', 10.5).attr('font-weight', 700).attr('fill', b_ ? R : N).text(k1(o.cap)); });
      if (d.plan) { const px = x0 + sx(d.plan); pB.append('line').attr('x1', px).attr('x2', px).attr('y1', top - 4).attr('y2', top + O.length * rh).attr('stroke', N).attr('stroke-width', 1.5).attr('stroke-dasharray', '3 2');
        pB.append('text').attr('x', px).attr('y', top - 6).attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', N).text(`plan ${k1(d.plan)}`); }
      if (tip_ && h > 120) pB.append('text').attr('x', 0).attr('y', h - 3).attr('font-size', 9.5).attr('fill', sh > 0 ? R : '#5B6770').text('→ ' + tip_); } }
    /* C */
    { const Lz = cp.lines, lw = Math.min(110, w * 0.3), rh = Math.min(36, (h - 54) / Math.max(1, Lz.length)), mxN = d3.max(Lz, l => l[1].length) || 1, cw = Math.min(22, (w - lw) / mxN), sc = s => ({ Standby: '#7BA7D9', 'Not working': '#9E1C1C', 'No time study': '#D0D5DB' })[s] || '#EEF1F4';
      pC.append('text').attr('x', 0).attr('y', 11).attr('font-size', 11).attr('font-weight', 700).attr('fill', '#33414B').text(`${cp.n.all} machines by line and state`);
      Lz.forEach(([l, ms], i) => { const y = 22 + i * rh; pC.append('text').attr('x', 0).attr('y', y + rh / 2).attr('dy', '0.35em').attr('font-size', 10.5).attr('fill', '#33414B').text(l);
        ms.forEach((m, j) => pC.append('rect').attr('x', lw + j * cw).attr('y', y + (rh - Math.min(22, rh - 6)) / 2).attr('width', cw - 4).attr('height', Math.min(22, rh - 6)).attr('rx', 3).attr('fill', m.u != null ? ucol(m.u) : sc(m.s))
          .on('mousemove', ev => tip.show(ev, [m.m, `${m.part} · ${m.op}`, m.u != null ? `Running · load ${pc(m.u)} of ${kf(m.cap)} a month` : m.s])).on('mouseleave', tip.hide)); });
      const lg = pC.append('g').attr('transform', `translate(0,${h - 20})`); let lx = 0;
      [['<85%', G], ['85–100%', A], ['>100%', R], ['standby', '#7BA7D9'], ['not working', '#9E1C1C'], ['no study', '#D0D5DB']].forEach(([k, c]) => { const g = lg.append('g').attr('transform', `translate(${lx},0)`);
        g.append('rect').attr('y', -8).attr('width', 9).attr('height', 9).attr('rx', 2).attr('fill', c); const t = g.append('text').attr('x', 12).attr('font-size', 9).attr('fill', '#33414B').text(k); let tw = 30; try { tw = t.node().getComputedTextLength(); } catch (e) {} lx += tw + 20; });
      if (lx > w) lg.attr('transform', `translate(0,${h - 20}) scale(${w / lx},1)`);
      pC.append('text').attr('x', 0).attr('y', h - 3).attr('font-size', 9.5).attr('font-weight', 700).attr('fill', cp.n.down ? R : '#5B6770').text(`${cp.n.run} running · ${cp.n.down} not working · ${cp.n.sb} standby · ${cp.n.ns} without a time study`); } }
  /* 15 Nov 23:03 (Umair): Projects - A activity timeline (plan bar, % sub-tasks done, where it should be today), B sub-task burn-up (due vs done), C overdue tasks by owner */
  function pjFlip(el, pj) { if (!pj) return none(el, 'No data'); const { svg, w, h } = mk(el);
    svg.classed('ovflp', true).attr('data-on', 'a').attr('data-n', '3'); const pA = svg.append('g').attr('class', 'pA'), pB = svg.append('g').attr('class', 'pB'), pC = svg.append('g').attr('class', 'pC');
    const R = C.bad, A = '#E0A100', G = '#1E8C5A', N = '#051C2C', pd = d => new Date(d + 'T00:00:00Z');
    /* A */
    { const L = pj.acts.filter(a => a.s && a.e), lw = Math.min(160, w * 0.4), x0 = lw, x1 = w - 34, top = 14, bot = 16, rh = Math.min(28, (h - top - bot) / Math.max(1, L.length)), bh = Math.min(12, rh * 0.55);
      const t0 = d3.min(L, a => a.s), t1c = d3.timeMonth.offset(pd(pj.today), 2), sx = d3.scaleTime().domain([d3.timeMonth.floor(pd(t0)), t1c]).range([x0, x1]).clamp(true);
      sx.ticks(d3.timeMonth.every(1)).forEach(m => { pA.append('line').attr('x1', sx(m)).attr('x2', sx(m)).attr('y1', top - 3).attr('y2', top + L.length * rh).attr('stroke', '#EEF1F4');
        pA.append('text').attr('x', sx(m) + 2).attr('y', top - 5).attr('font-size', 8.5).attr('fill', '#6B7680').text(d3.timeFormat('%b')(m)); });
      L.forEach((a, i) => { const y = top + i * rh + rh / 2, c = a.col, xs = sx(pd(a.s)), xe = sx(pd(a.e)), bw = Math.max(4, xe - xs), past = pd(a.e) > t1c;
        const T = [a.key + ' · ' + a.full, `${a.status} · ${a.owner || 'Unassigned'}`, `Plan ${dlab(a.s)} to ${dlab(a.e)}`, a.n ? `${a.nd} of ${a.n} sub-tasks done (${f0(a.p * 100)}%) · ${f0(a.x * 100)}% expected by today` : 'No sub-tasks', a.late ? `${a.late} days past due` : ''].filter(Boolean);
        const t = pA.append('text').attr('x', 0).attr('y', y).attr('dy', '0.35em').attr('font-size', 9.5).attr('fill', '#33414B').text(a.name);
        try { while (t.node().getComputedTextLength() > lw - 6 && t.text().length > 4) t.text(t.text().slice(0, -2) + '…'); } catch (e) {}
        pA.append('rect').attr('x', xs).attr('y', y - bh / 2).attr('width', bw).attr('height', bh).attr('rx', 2).attr('fill', c).attr('opacity', .25);
        const f = a.done ? 1 : a.n ? a.p : 0; if (f) pA.append('rect').attr('x', xs).attr('y', y - bh / 2).attr('width', bw * f).attr('height', bh).attr('rx', 2).attr('fill', c);
        if (!a.done && a.n) pA.append('line').attr('x1', xs + bw * a.x).attr('x2', xs + bw * a.x).attr('y1', y - bh / 2 - 2).attr('y2', y + bh / 2 + 2).attr('stroke', N).attr('stroke-width', 1.5);
        if (past) pA.append('text').attr('x', x1 + 1).attr('y', y).attr('dy', '0.35em').attr('font-size', 8).attr('fill', c).text('▶');
        pA.append('text').attr('x', Math.min(xe, x1) + (past ? 10 : 3)).attr('y', y).attr('dy', '0.35em').attr('font-size', 8.5).attr('font-weight', 700).attr('fill', c).text(a.done ? 'done' : a.n ? f0(a.p * 100) + '%' : a.late ? 'late' : '');
        pA.append('rect').attr('x', 0).attr('y', y - rh / 2).attr('width', w).attr('height', rh).attr('fill', 'transparent').on('mousemove', ev => tip.show(ev, T)).on('mouseleave', tip.hide); });
      const tx = sx(pd(pj.today)); pA.append('line').attr('x1', tx).attr('x2', tx).attr('y1', top - 3).attr('y2', top + L.length * rh + 2).attr('stroke', R).attr('stroke-width', 1.5);
      const lg = pA.append('g').attr('transform', `translate(0,${h - 3})`); let lx = 0;
      [['done / on track', G], ['behind', A], ['late', R], ['should be today', N], ['today', R]].forEach(([k, c]) => { const g = lg.append('g').attr('transform', `translate(${lx},0)`), ln = k === 'should be today' || k === 'today';
        g.append('rect').attr('y', ln ? -10 : -8).attr('width', ln ? 1.5 : 9).attr('height', ln ? 11 : 9).attr('fill', c); const t = g.append('text').attr('x', ln ? 5 : 12).attr('font-size', 8.5).attr('fill', '#33414B').text(k);
        let tw = 40; try { tw = t.node().getComputedTextLength(); } catch (e) {} lx += tw + (ln ? 14 : 20); });
      if (lx > w) lg.attr('transform', `translate(0,${h - 3}) scale(${w / lx},1)`); }
    /* B */
    { const B = pj.burn; if (B.length > 1) { const top = 16, x0 = 26, x1 = w - 62, y1 = h - 16, mx = d3.max(B, b => Math.max(b.due, b.done)) || 1;
      const sx = d3.scaleTime().domain([pd(B[0].d), pd(B[B.length - 1].d)]).range([x0, x1]), sy = d3.scaleLinear().domain([0, mx * 1.08]).range([y1, top]).nice();
      pB.append('text').attr('x', 0).attr('y', 9).attr('font-size', 11).attr('font-weight', 700).attr('fill', '#33414B').text('Sub-tasks: due vs done (cumulative)');
      axisY(pB, sy, x0, x1, nf, 4);
      sx.ticks(d3.timeMonth.every(1)).forEach(m => pB.append('text').attr('x', sx(m)).attr('y', h - 3).attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', '#6B7680').text(d3.timeFormat('%b')(m)));
      pB.append('path').attr('d', d3.area().x(b => sx(pd(b.d))).y0(b => sy(b.done)).y1(b => sy(b.due)).curve(d3.curveStepAfter)(B)).attr('fill', R).attr('opacity', .12);
      pB.append('path').attr('d', d3.line().x(b => sx(pd(b.d))).y(b => sy(b.due)).curve(d3.curveStepAfter)(B)).attr('fill', 'none').attr('stroke', N).attr('stroke-width', 1.6).attr('stroke-dasharray', '4 2');
      pB.append('path').attr('d', d3.line().x(b => sx(pd(b.d))).y(b => sy(b.done)).curve(d3.curveStepAfter)(B)).attr('fill', 'none').attr('stroke', G).attr('stroke-width', 2.4);
      const L_ = B[B.length - 1], gx = sx(pd(L_.d));
      pB.append('text').attr('x', gx + 5).attr('y', sy(L_.due)).attr('dy', '0.35em').attr('font-size', 10).attr('font-weight', 700).attr('fill', N).text(`${L_.due} due`);
      pB.append('text').attr('x', gx + 5).attr('y', sy(L_.done)).attr('dy', '0.35em').attr('font-size', 10).attr('font-weight', 700).attr('fill', G).text(`${L_.done} done`);
      if (L_.due > L_.done) { pB.append('line').attr('x1', gx).attr('x2', gx).attr('y1', sy(L_.due)).attr('y2', sy(L_.done)).attr('stroke', R).attr('stroke-width', 2);
        pB.append('text').attr('x', gx - 5).attr('y', (sy(L_.due) + sy(L_.done)) / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 10.5).attr('font-weight', 700).attr('fill', R).text(`${L_.due - L_.done} behind`); }
      pB.append('text').attr('x', w).attr('y', 9).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', '#5B6770').text(pj.cm ? `${pj.cm} done this month` : 'none done this month');
      pB.append('rect').attr('x', x0).attr('y', top).attr('width', x1 - x0).attr('height', y1 - top).attr('fill', 'transparent').on('mousemove', ev => { const [mx_] = d3.pointer(ev), dd = sx.invert(mx_).toISOString().slice(0, 10), b = B.filter(q => q.d <= dd).pop() || B[0];
        tip.show(ev, [dlab(b.d), `${b.due} due by then`, `${b.done} done`, `${b.due - b.done} behind`]); }).on('mouseleave', tip.hide); } else pB.append('text').attr('x', w / 2).attr('y', h / 2).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#8A949E').text('No sub-task dates'); }
    /* C */
    { const O = pj.own, lw = Math.min(118, w * 0.32), x0 = lw, x1 = w - 66, top = 20, rh = Math.min(36, (h - top - 16) / Math.max(1, O.length)), bh = Math.min(14, rh * 0.6), mx = d3.max(O, o => o.open) || 1, sx = v => v / mx * (x1 - x0);
      pC.append('text').attr('x', 0).attr('y', 9).attr('font-size', 11).attr('font-weight', 700).attr('fill', '#33414B').text('Open sub-tasks by owner');
      pC.append('text').attr('x', w).attr('y', 9).attr('text-anchor', 'end').attr('font-size', 8.5).attr('fill', '#5B6770').text('last update');
      O.forEach((o, i) => { const y = top + i * rh + rh / 2, st = o.days > 21;
        pC.append('text').attr('x', 0).attr('y', y).attr('dy', '0.35em').attr('font-size', 10).attr('fill', '#33414B').text(o.k);
        pC.append('rect').attr('x', x0).attr('y', y - bh / 2).attr('width', sx(o.open)).attr('height', bh).attr('rx', 2).attr('fill', '#D5DBE1');
        if (o.od) pC.append('rect').attr('x', x0).attr('y', y - bh / 2).attr('width', sx(o.od)).attr('height', bh).attr('rx', 2).attr('fill', R);
        pC.append('text').attr('x', x0 + sx(o.open) + 4).attr('y', y).attr('dy', '0.35em').attr('font-size', 9.5).attr('font-weight', 700).attr('fill', o.od ? R : N).text(o.od ? `${o.od} late of ${o.open}` : `${o.open} open`);
        pC.append('text').attr('x', w).attr('y', y).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 9).attr('font-weight', st ? 700 : 400).attr('fill', st ? R : '#5B6770').text(o.last ? dlab(o.last) : '—');
        pC.append('rect').attr('x', 0).attr('y', y - rh / 2).attr('width', w).attr('height', rh).attr('fill', 'transparent').on('mousemove', ev => tip.show(ev, [o.k, `${o.open} open sub-tasks, ${o.od} past due`, o.last ? `Last Jira update ${dlab(o.last)} (${o.days} days ago)` : ''])).on('mouseleave', tip.hide); });
      const lg = pC.append('g').attr('transform', `translate(0,${h - 3})`);
      lg.append('rect').attr('y', -8).attr('width', 9).attr('height', 9).attr('fill', R); lg.append('text').attr('x', 12).attr('font-size', 8.5).attr('fill', '#33414B').text('past due');
      lg.append('rect').attr('x', 66).attr('y', -8).attr('width', 9).attr('height', 9).attr('fill', '#D5DBE1'); lg.append('text').attr('x', 78).attr('font-size', 8.5).attr('fill', '#33414B').text('open, not yet due');
      lg.append('text').attr('x', w).attr('text-anchor', 'end').attr('font-size', 8.5).attr('fill', R).text('red date = no update for 3+ weeks'); } }
  /* donut: items [{label, v, color}] */
  function donutC(el, items, o = {}) { items = items.filter(d => d.v > 0); if (!items.length) return none(el, 'No data'); const { svg, w, h } = mk(el, o.h);
    if (o.legend === 'side') { /* 14 Nov 23:30 (Umair): donut with value + % inside each slice; on the right, one month's consumption by category (same colours) with its share and days of inventory */
      const tot0 = d3.sum(items, d => d.v), r0 = Math.max(30, Math.min(h / 2 - 1, w * 0.215)), cx0 = r0 + 3,   /* 15 Nov 09:46 (Umair): donut a little larger and thicker */ g0 = svg.append('g').attr('transform', `translate(${cx0},${h / 2})`);
      const pie0 = d3.pie().sort(null).value(d => d.v)(items), ri = r0 * 0.44;
      g0.selectAll('path').data(pie0).join('path').attr('d', d3.arc().innerRadius(ri).outerRadius(r0).padAngle(0.012)).attr('fill', d => d.data.color).attr('stroke', '#fff').attr('stroke-width', 1)
        .on('mousemove', (ev, d) => tip.show(ev, [d.data.label, `${(o.fmt || kf)(d.data.v)} · ${pc(d.data.v / tot0 * 100)} of stock value`])).on('mouseleave', tip.hide);
      const lab0 = d3.arc().innerRadius((ri + r0) / 2).outerRadius((ri + r0) / 2), fs = Math.max(8.5, Math.min(11, r0 / 6.2));
      const lg = g0.selectAll('g.sl').data(pie0.filter(d => d.endAngle - d.startAngle > 0.42)).join('g').attr('class', 'sl').attr('transform', d => `translate(${lab0.centroid(d)})`).attr('pointer-events', 'none');
      lg.append('text').attr('text-anchor', 'middle').attr('y', -1).attr('font-size', fs).attr('font-weight', 700).attr('fill', '#fff').text(d => d.data.v >= 1e6 ? d3.format(',.0f')(d.data.v / 1e6) + 'M' : (o.fmt || kf)(d.data.v).replace('Rs ', ''));
      lg.append('text').attr('text-anchor', 'middle').attr('y', fs + 1).attr('font-size', fs - 1).attr('fill', '#fff').attr('opacity', .9).text(d => pc(d.data.v / tot0 * 100));
      g0.append('text').attr('text-anchor', 'middle').attr('y', -2).attr('font-size', Math.max(12, Math.min(17, ri / 2.6))).attr('font-weight', 700).attr('fill', '#051C2C').text(o.center ?? (o.fmt || kf)(tot0));
      g0.append('text').attr('text-anchor', 'middle').attr('y', Math.max(12, Math.min(17, ri / 2.6)) - 2).attr('font-size', 9).attr('letter-spacing', '.06em').attr('fill', '#8A949E').text('STOCK');
      const SD = o.side || [], tx = cx0 + r0 + 10, lx = tx + 26, rw = w - lx - 2; if (!SD.length || rw < 100) return;
      /* 15 Nov 00:06 (Umair): the right side flips between the consumption bars (pane A) and an inventory-days gauge (pane B) */
      svg.classed('ovflp', true).attr('data-on', 'a');
      const pA = svg.append('g').attr('class', 'pA'), pB = svg.append('g').attr('class', 'pB');
      const drawB = () => { const G = o.gauge; if (!G) { svg.classed('ovflp', false); return; }
        const tab = (gg, label) => { gg.append('rect').attr('x', tx).attr('y', (h - Math.max(40, Math.min(h - 6, 150))) / 2).attr('width', 20).attr('height', Math.max(40, Math.min(h - 6, 150))).attr('rx', 6).attr('fill', '#051C2C');
          gg.append('text').attr('transform', `translate(${tx + 10},${h / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', 9.5).attr('font-weight', 600).attr('letter-spacing', '.08em').attr('fill', '#fff').text(label.toUpperCase()); };
        tab(pB, 'Inventory days');
        /* 15 Nov 00:32 (Umair): one gauge per category, arc in the category's donut colour; number = days of stock, coloured by status against the target */
        const n = SD.length, cols = 1, rows = Math.ceil(n / cols), cw = rw / cols, chh = (h - 4) / rows;   /* gauges stacked: one row per category, name to the right */
        const gr = Math.max(12, Math.min(chh * 0.68, cw * 0.4)), lf = n > 3 ? 10 : 11;   /* 15 Nov 09:42 (Umair): no category names - the arc colour says it */
        SD.forEach((d, i) => { const tg = (G.targets || {})[d.label] ?? G.target, dd = d.dit, mxd = Math.max(90, Math.ceil(Math.max(dd || 0, tg * 2) / 30) * 30), sc = dd == null ? '#8A949E' : dd <= tg ? '#1E8C5A' : dd <= tg * 2 ? '#9A6B00' : C.bad;
          const A = v => -Math.PI / 2 + Math.PI * Math.min(1, v / mxd), gx = lx + cw * (i % cols) + cw / 2 - (gr >= 24 ? 0 : 20), gy = 2 + chh * Math.floor(i / cols) + chh / 2 + gr * 0.42;
          const arc = d3.arc().innerRadius(gr * 0.74).outerRadius(gr).cornerRadius(1.5), g2 = pB.append('g').attr('transform', `translate(${gx},${gy})`);
          g2.append('path').attr('d', arc({ startAngle: -Math.PI / 2, endAngle: Math.PI / 2 })).attr('fill', '#E9EDF1');
          if (dd != null) g2.append('path').attr('d', arc({ startAngle: -Math.PI / 2, endAngle: A(dd) })).attr('fill', d.color);
          const ta = A(tg); g2.append('line').attr('x1', Math.sin(ta) * gr * 0.68).attr('y1', -Math.cos(ta) * gr * 0.68).attr('x2', Math.sin(ta) * gr * 1.1).attr('y2', -Math.cos(ta) * gr * 1.1).attr('stroke', dd != null && dd > tg ? C.bad : '#051C2C').attr('stroke-width', 2.2);   /* 15 Nov 09:35 (Umair): target line red when over target, black when within; no target text */
          if (dd != null) { const na = A(dd); g2.append('line').attr('x2', Math.sin(na) * gr * 0.62).attr('y2', -Math.cos(na) * gr * 0.62).attr('stroke', '#051C2C').attr('stroke-width', 1.8).attr('stroke-linecap', 'round'); }
          g2.append('circle').attr('r', 2.6).attr('fill', '#051C2C');
          const dtxt = dd == null ? '—' : d3.format(',.0f')(dd), big = gr >= 24;
          if (big) g2.append('text').attr('y', -gr * 0.3).attr('text-anchor', 'middle').attr('font-size', Math.max(10, Math.min(16, gr / 2.4))).attr('font-weight', 700).attr('fill', sc).text(dtxt);
                    if (!big) g2.append('text').attr('x', gr + 8).attr('y', -gr * 0.42).attr('dy', '0.35em').attr('font-size', lf).attr('font-weight', 700).attr('fill', sc).text(`${dtxt} d`);   /* small gauges: days beside the dial */
          g2.append('rect').attr('x', -gr).attr('y', -gr - 4).attr('width', cw - 8).attr('height', gr + 8).attr('fill', 'transparent')
            .on('mousemove', ev => tip.show(ev, [d.label, dd == null ? 'No issues in ' + G.mon : `${d3.format(',.0f')(dd)} days of stock (target ${tg})`, `Stock ${(o.fmt || kf)(d.stock)} ÷ ${G.mon} issues ${(o.fmt || kf)(d.cons)} per ${G.nd} days`])).on('mouseleave', tip.hide); });
      };
      const mx = d3.max(SD, d => d.cons) || 1, top0 = 4, rh = Math.min(40, (h - top0) / SD.length), y0 = top0 + Math.max(0, (h - top0 - rh * SD.length) / 2);
      /* 14 Nov 23:44 (Umair): the bar heading is a vertical navy tab on the left of the bars, like the Vendors / Parts tabs on Supply Watch */
      const th = Math.max(40, h - 6), ty = (h - th) / 2;
      pA.append('rect').attr('x', tx).attr('y', ty).attr('width', 20).attr('height', th).attr('rx', 6).attr('fill', '#051C2C');
      pA.append('text').attr('transform', `translate(${tx + 10},${ty + th / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', 9.5).attr('font-weight', 600).attr('letter-spacing', '.08em').attr('fill', '#fff').text((o.sideTitle || 'Consumption').toUpperCase()).each(function () { try { if (this.getComputedTextLength() > th - 14) d3.select(this).attr('textLength', th - 14).attr('lengthAdjust', 'spacingAndGlyphs'); } catch (e) {} });   /* always the full title; squeezed to fit when the card is short */
      const dcol = d => d.dit == null ? '#8A949E' : d.dit > 180 ? C.bad : d.dit > 90 ? '#9A6B00' : '#1E8C5A', dtx = d => d.dit == null ? '  · no use' : `  · ${d3.format(',.0f')(d.dit)} d`;
      if (SD.length > 3) { /* raw material included: one line per category - name, bar, value · days */
        const r1 = Math.min(26, (h - 8) / SD.length), yy = (h - r1 * SD.length) / 2, nw = Math.min(74, rw * 0.29), vw = 64, bwm = Math.max(16, rw - nw - vw - 6);
        SD.forEach((d, i) => { const g = pA.append('g').attr('transform', `translate(${lx},${yy + i * r1})`), bw = Math.max(2, bwm * d.cons / mx);
          g.append('text').attr('y', r1 / 2).attr('dy', '0.35em').attr('font-size', 10).attr('fill', '#33414B').text(d.label.length > 9 ? d.label.slice(0, 7) + '…' : d.label).append('title').text(d.label);
          g.append('rect').attr('x', nw).attr('y', r1 / 2 - 5).attr('width', bw).attr('height', 10).attr('rx', 2).attr('fill', d.color);
          g.append('text').attr('x', rw).attr('text-anchor', 'end').attr('y', r1 / 2).attr('dy', '0.35em').attr('font-size', 9.5).attr('font-weight', 700).attr('fill', '#051C2C').text((o.fmt || kf)(d.cons));
          g.append('rect').attr('width', rw).attr('height', r1).attr('fill', 'transparent').on('mousemove', ev => tip.show(ev, [d.label, `${(o.gauge && o.gauge.mon) || 'Month'} consumption: ${(o.fmt || kf)(d.cons)}`, `Stock ${(o.fmt || kf)(d.stock)} → ${d.dit == null ? 'no use' : d3.format(',.0f')(d.dit) + ' days of inventory'} at that rate`])).on('mouseleave', tip.hide); });
        drawB(); return; }
      SD.forEach((d, i) => { const g = pA.append('g').attr('transform', `translate(${lx},${y0 + i * rh})`), bw = Math.max(2, (rw - 70) * d.cons / mx);
        g.append('text').attr('y', 9).attr('font-size', 11).attr('fill', '#33414B').text(d.label);
        g.append('rect').attr('y', 13).attr('width', bw).attr('height', 11).attr('rx', 2).attr('fill', d.color);
        g.append('text').attr('x', bw + 5).attr('y', 22).attr('font-size', 10.5).attr('font-weight', 700).attr('fill', '#051C2C').text(`${(o.fmt || kf)(d.cons)}`);   /* 15 Nov 09:28 (Umair): days are on the gauges, not here */   /* 14 Nov 23:37 (Umair): no share %, days of stock right after the value */
        g.append('rect').attr('y', 11).attr('width', rw).attr('height', 15).attr('fill', 'transparent').on('mousemove', ev => tip.show(ev, [d.label, `${(o.gauge && o.gauge.mon) || 'Month'} consumption: ${(o.fmt || kf)(d.cons)} (${pc(d.share)} of the total)`, `Stock ${(o.fmt || kf)(d.stock)} → ${d.dit == null ? 'no use' : d3.format(',.0f')(d.dit) + ' days of inventory'} at that rate`])).on('mouseleave', tip.hide); });
      drawB(); return; }
    if (o.legend === 'bottom') { /* 12 Nov 06:57 (Umair): legend under the donut, donut as large as the space allows */
      const tot0 = d3.sum(items, d => d.v), lines = items.map(d => `${d.label} · ${pc(d.v / tot0 * 100)}`), cw = d3.max(lines, t => t.length) * 5.7 + 20, per = Math.max(1, Math.floor((w - 8) / cw)), rows = Math.ceil(items.length / per), lgH = rows * 18 + 6;
      const r0 = Math.max(30, Math.min((h - lgH) / 2 - 8, w / 2 - 6)), cy0 = Math.max(r0 + 4, (h - lgH - 2 * r0 - 12) / 2 + r0), g0 = svg.append('g').attr('transform', `translate(${w / 2},${cy0})`);
      g0.selectAll('path').data(d3.pie().sort(null).value(d => d.v)(items)).join('path').attr('d', d3.arc().innerRadius(r0 * 0.6).outerRadius(r0).padAngle(0.01)).attr('fill', d => d.data.color).attr('stroke', '#fff').attr('stroke-width', 1)
        .on('mousemove', (ev, d) => tip.show(ev, [d.data.label, `${(o.fmt || kf)(d.data.v)} · ${pc(d.data.v / tot0 * 100)}`])).on('mouseleave', tip.hide);
      g0.append('text').attr('text-anchor', 'middle').attr('y', 5).attr('font-size', Math.max(12, Math.min(22, r0 / 3.6))).attr('font-weight', 600).attr('fill', '#051C2C').text(o.center ?? (o.fmt || kf)(tot0));
      const lx = (w - Math.min(per, items.length) * cw) / 2;
      items.forEach((d, i) => { const cx = lx + (i % per) * cw, cy = cy0 + r0 + 14 + Math.floor(i / per) * 18;
        svg.append('rect').attr('x', cx).attr('y', cy).attr('width', 10).attr('height', 10).attr('rx', 2).attr('fill', d.color);
        svg.append('text').attr('x', cx + 14).attr('y', cy + 9).attr('font-size', 11).attr('fill', '#33414B').text(lines[i]); });
      return; } const r = Math.min(h / 2 - 6, w / 3.1);
    const g = svg.append('g').attr('transform', `translate(${r + 6},${h / 2})`), tot = d3.sum(items, d => d.v);
    g.selectAll('path').data(d3.pie().sort(null).value(d => d.v)(items)).join('path').attr('d', d3.arc().innerRadius(r * 0.58).outerRadius(r)).attr('fill', d => d.data.color)
      .on('mousemove', (ev, d) => tip.show(ev, [d.data.label, `${(o.fmt || kf)(d.data.v)} · ${pc(d.data.v / tot * 100)}`])).on('mouseleave', tip.hide);
    g.append('text').attr('text-anchor', 'middle').attr('y', 4).attr('font-size', Math.max(11, Math.min(16, r / 4))).attr('font-weight', 600).attr('fill', '#051C2C').text(o.center ?? (o.fmt || kf)(tot));
    const lh = Math.min(19, (h - 6) / items.length); items.forEach((d, i) => { const y = h / 2 - items.length * lh / 2 + i * lh + lh / 2;
      svg.append('rect').attr('x', 2 * r + 18).attr('y', y - 5).attr('width', 10).attr('height', 10).attr('rx', 2).attr('fill', d.color);
      svg.append('text').attr('x', 2 * r + 31).attr('y', y + 3.5).attr('font-size', 11).attr('fill', '#33414B').text(`${d.label.length > 16 ? d.label.slice(0, 15) + '…' : d.label} · ${pc(d.v / tot * 100)}`); }); }

  /* ---------- per-card models: {kpis:[[label,value,sub,color?]], mini(el), title, sub, detail:[{t, lg, draw(el)}], foot} ---------- */
  const PAL = [C.navy, C.blue, C.cyan, '#1F9E89', '#E0A100', '#8C6BD8', '#B9C1C9', '#D0312D'];
  const lg = L => L.map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('');
  const days = (a, b) => { const o = []; for (let d = new Date(a + 'T00:00:00Z'); d3.utcFormat('%Y-%m-%d')(d) <= b; d = d3.utcDay.offset(d, 1)) o.push(d3.utcFormat('%Y-%m-%d')(d)); return o; };

  const M = {};
  /* 12 Nov 00:20 (Umair): every card follows the Shop filter of the top pane */
  const SHf = P => P.shop && P.shop !== 'All' ? P.shop : '';
  const inSh = (sh, r, ...ks) => !sh || ks.some(k => { const v = r[k]; if (Array.isArray(v)) return v.includes(sh); if (typeof v === 'string' && v.trim().startsWith('[')) { try { return JSON.parse(v).includes(sh); } catch (e) { return false; } } return v === sh; });
  /* 17 Nov 06:51 (Umair): the Production detail window gets the same shop / model / part filter as Vendor Supply (F = {shop, model, part}); it applies only inside the window */
  /* 17 Nov 10:26 (Umair): which filters each Overview window offers */
  const FC = { production: ['shop', 'model', 'part'], vendor: ['shop', 'model', 'part'], inventory: ['shop', 'model', 'part'], savings: ['shop', 'model', 'part'], workforce: ['shop'], cost: ['shop'], capacity: ['shop'], projects: ['shop'] };
  const pModsOf = r => String(r.models || r.model || '').split(/[\/,;]+/).map(x => x.trim()).filter(Boolean);
  M.production = (P, F0) => { const F = F0 || {}; const ms = P.start, end = P.actEnd, pEnd = window.__planTo ? window.__planTo({ day: 0 }, end) : end;
    const SH = F._own ? (F.shop || '') : (F.shop || SHf(P)), parts = new Map(D('atlas_parts').filter(r => inSh(SH, r, 'shop', 'shops') && (!F.model || pModsOf(r).includes(F.model)) && (!F.part || String(r.code) === String(F.part))).map(r => [String(r.code), r])), rows = D('atlas_parts_daily').filter(r => r.date >= ms && r.date <= end && parts.has(String(r.code)));
    const fin = rows.filter(r => (parts.get(String(r.code)) || {}).type === 'Finished'), ih = rows.filter(r => (parts.get(String(r.code)) || {}).type === 'In-house');
    const sum = (rs, k, to) => d3.sum(rs.filter(r => r.date <= to), r => +r[k] || 0);
    const pp = sum(fin, 'prod_plan', pEnd), pa = sum(fin, 'prod_actual', end), dp = sum(fin, 'disp_plan', pEnd), da = sum(fin, 'disp_actual', end), ip = sum(ih, 'prod_plan', pEnd), ia = sum(ih, 'prod_actual', end);
    const mp = d3.sum(D('atlas_parts_daily').filter(r => r.date.startsWith(P.month) && (parts.get(String(r.code)) || {}).type === 'Finished'), r => +r.prod_plan || 0);
    const ds = days(ms, end); let cp = 0, ca = 0, cd = 0; const byD = d3.rollup(fin, v => ({ p: d3.sum(v, r => +r.prod_plan || 0), a: d3.sum(v, r => +r.prod_actual || 0), d: d3.sum(v, r => +r.disp_actual || 0), dpl: d3.sum(v, r => +r.disp_plan || 0) }), r => r.date);
    const cP = ds.map(d => (cp += d <= pEnd ? (byD.get(d) || {}).p || 0 : 0)), cA = ds.map(d => (ca += (byD.get(d) || {}).a || 0)), cD = ds.map(d => (cd += (byD.get(d) || {}).d || 0));
    const col = v => v != null && v < 80 ? C.bad : v != null && v < 95 ? C.warn : null;
    const agg = (rs, key) => d3.rollups(rs, v => ({ p: d3.sum(v.filter(r => r.date <= pEnd), r => +r.prod_plan || 0), a: d3.sum(v, r => +r.prod_actual || 0), dp: d3.sum(v.filter(r => r.date <= pEnd), r => +r.disp_plan || 0), da: d3.sum(v, r => +r.disp_actual || 0) }), key);
    const byShop = agg(fin, r => (parts.get(String(r.code)) || {}).shop || '?').filter(([, o]) => o.p || o.a).sort((a, b) => b[1].p - a[1].p);
    const byModel = agg(fin, r => (parts.get(String(r.code)) || {}).model || '—').filter(([, o]) => o.p || o.a).sort((a, b) => b[1].p - a[1].p);
    /* 18 Nov 17:25 (Umair): with a shop filter on, the shop charts turn into model or part charts (part when a model/part is also picked or the shop has one model) */
    const pcv = o => o.p ? o.a / o.p * 100 : (o.a ? 999 : 0), nm = c => { const r = parts.get(String(c)) || {}; return r.part || String(c); };
    const byPart = rs => agg(rs, r => String(r.code)).filter(([, o]) => o.p || o.a).map(([c, o]) => ({ label: nm(c), v: pcv(o), lab: pc(o.p ? o.a / o.p * 100 : null), color: col(o.p ? o.a / o.p * 100 : null) || C.navy, tip: [nm(c), `Code ${c}`, `Production ${pc(o.p ? o.a / o.p * 100 : null)}`, `${kf(o.a)} of ${kf(o.p)} plan`].concat(o.dp || o.da ? [`Dispatch ${kf(o.da)} of ${kf(o.dp)}`] : []) })).sort((a, b) => a.v - b.v);
    const fgMode = !SH ? 'shop' : (F.model || F.part || byModel.filter(([k]) => k !== '—').length <= 1) ? 'part' : 'model';
    const fgPanel = fgMode === 'shop' ? null : fgMode === 'model'
      ? { t: 'Production compliance by model (finished goods)', draw: el => hbarS(el, byModel.map(([m, o]) => ({ label: m, v: pcv(o), lab: pc(o.p ? o.a / o.p * 100 : null), color: col(o.p ? o.a / o.p * 100 : null) || C.navy, tip: [m, `Production ${pc(o.p ? o.a / o.p * 100 : null)}`, `${kf(o.a)} of ${kf(o.p)} plan`, `Dispatch ${kf(o.da)} of ${kf(o.dp)}`] })).sort((a, b) => a.v - b.v), { fmt: pc, ref: 100, h: 260, lw: 130, cap: 250 }) }
      : { t: 'Production compliance by part (finished goods) · lowest first', draw: el => hbarS(el, byPart(fin), { fmt: pc, ref: 100, h: 260, lw: 190, lc: 27, cap: 250, empty: 'No finished goods plan for this filter' }) };
    const ihPanel = SH ? { t: 'In-house parts compliance by part · lowest first', draw: el => hbarS(el, byPart(ih), { fmt: pc, ref: 100, h: 260, lw: 190, lc: 27, cap: 250, empty: 'No in-house parts plan for this filter' }) } : null;
    const ihShop = agg(ih, r => (parts.get(String(r.code)) || {}).shop || '?').filter(([, o]) => o.p).map(([s, o]) => ({ label: s, v: o.a / o.p * 100, tip: [s, `In-house parts ${pc(o.a / o.p * 100)}`, `${kf(o.a)} of ${kf(o.p)} plan`], color: col(o.a / o.p * 100) || C.navy })).sort((a, b) => a.v - b.v);
    /* 14 Nov 10:34 (Umair): shops short of plan to date, named at the foot of the card (filtered to one shop: its models instead) */
    const all_ = (SH ? byModel : byShop).filter(([k, o]) => o.p > 0 && k !== '?' && k !== '—').map(([k, o]) => ({ k, v: o.a / o.p * 100, a: o.a, p: o.p }));
    const bh = all_.filter(x => x.a < x.p).sort((a, b) => a.v - b.v), ah = all_.filter(x => x.a >= x.p).sort((a, b) => b.v - a.v);   /* 14 Nov 10:59 (Umair): behind = even one piece short of plan to date */   /* 14 Nov 10:45: none behind - list everyone as 'Ahead' */
    const fT = `${F.shop ? ' · shop: ' + F.shop : ''}${F.model ? ' · model: ' + F.model : ''}${F.part ? ' · part: ' + (F.partName || F.part) : ''}`;
    if (fT && !rows.length) return { title: fT.slice(3), kpis: [], none: 'No Atlas plan or production for this filter this month' };
    return { title: fT.slice(3), /* 17 Nov 10:02 (Umair): the 'Finished goods <month> to <date>' line is removed; only an applied window filter shows */ st: band(pp ? pa / pp * 100 : null, 95, 80), behind: { what: SH ? 'models' : 'shops', list: bh, ahead: ah },
      kpis: [['FG production', pc(pp ? pa / pp * 100 : null), `${kf(pa)} of ${kf(pp)} plan`, col(pp ? pa / pp * 100 : null)], ['Dispatch', pc(dp ? da / dp * 100 : null), `${kf(da)} of ${kf(dp)} plan`, col(dp ? da / dp * 100 : null)],
        ['In-house parts', pc(ip ? ia / ip * 100 : null), `${kf(ia)} of ${kf(ip)} plan`, col(ip ? ia / ip * 100 : null)], ['Month plan (FG)', kf(mp), `${pc(mp ? pa / mp * 100 : null)} done so far`], ['Short to plan', kf(Math.max(0, pp - pa)), 'plan less actual']],
      vt: '', /* 14 Nov 06:32 (Umair): no chart title on the Production card */ mini: el => lineC(el, ds, [{ name: 'Plan', color: '#B9C1C9', values: cP, dash: '4 3' }, { name: 'Actual', color: C.navy, values: cA }], { xFmt: d => +d.slice(8), ml: 34 }),
      detail: [
        { t: 'Cumulative production and dispatch (finished goods)', lg: [['Production plan', '#B9C1C9'], ['Production', C.navy], ['Dispatch', C.cyan]], draw: el => lineC(el, ds, [{ name: 'Production plan', color: '#B9C1C9', values: cP, dash: '4 3' }, { name: 'Production', color: C.navy, values: cA }, { name: 'Dispatch', color: C.cyan, values: cD }], { h: 260, xFmt: dlab }) },
        fgPanel || { t: 'Production compliance by shop (finished goods)', draw: el => hbarC(el, byShop.map(([s, o]) => ({ label: s, v: o.p ? o.a / o.p * 100 : 0, lab: pc(o.p ? o.a / o.p * 100 : null), color: col(o.p ? o.a / o.p * 100 : null) || C.navy, tip: [s, `Production ${pc(o.p ? o.a / o.p * 100 : null)}`, `${kf(o.a)} of ${kf(o.p)} plan`, `Dispatch ${kf(o.da)} of ${kf(o.dp)}`] })), { fmt: pc, ref: 100, h: 260, lw: 130, cap: 250, sel: F.shop || null, pick: F._own ? sh => window.__ovPick && window.__ovPick('shop', sh) : null }) },
        { t: 'Production and dispatch by model, plan vs actual', lg: [['Prod plan', '#C9D1D9'], ['Produced', C.navy], ['Disp plan', '#AAE6F0'], ['Dispatched', C.cyan]], draw: el => colC(el, byModel.map(d => d[0]), [{ name: 'Prod plan', color: '#C9D1D9' }, { name: 'Produced', color: C.navy }, { name: 'Disp plan', color: '#AAE6F0' }, { name: 'Dispatched', color: C.cyan }], (c, s) => { const o = new Map(byModel).get(c); return { 'Prod plan': o.p, Produced: o.a, 'Disp plan': o.dp, Dispatched: o.da }[s.name]; }, { h: 260 }) },
        ihPanel || { t: 'In-house parts compliance by shop', draw: el => hbarC(el, ihShop, { fmt: pc, ref: 100, h: 260, lw: 130, cap: 250 }) }],
      foot: '' /* 17 Nov 10:06 (Umair): footnote removed */ }; };

  /* 16 Nov 17:57 (Umair): the detail window can be filtered to one vendor (click a name in "Vendors · lowest compliance first");
     VF = that vendor's full name. The vendor list itself stays complete so another vendor can be picked. */
  /* 16 Nov 18:18 (Umair): the window's own filter button adds shop, model and part (F = {vf, shop, model, part}); they apply only inside the window */
  const vModsOf = () => { const fm = new Map((D('atlas_parts') || []).map(r => [String(r.code), String(r.models || r.model || '').split(/[\/,;]+/).map(x => x.trim()).filter(Boolean)])), m = new Map();
    (D('atlas_bom') || []).forEach(b => { const st = m.get(String(b.code)) || new Set(); String(b.fg || '').split(/[;,]/).forEach(x => (fm.get(x.split(':')[0]) || []).forEach(v => st.add(v))); m.set(String(b.code), st); }); return m; };
  M.vendor = (P, F0) => { const F = typeof F0 === 'string' ? { vf: F0 } : (F0 || {}), VF = F.vf || ''; const ms = P.start, end = P.actEnd, pEnd = window.__planTo ? window.__planTo({ day: 0 }, end) : end;
    const MO = F.model ? vModsOf() : null, okC = cd => (!F.part || String(cd) === String(F.part)) && (!MO || (MO.get(String(cd)) || new Set()).has(F.model));
    const SH = F._own ? (F.shop || '') : (F.shop || SHf(P)), rowsAll = D('atlas_vendor_supply').filter(r => r.date >= ms && r.date <= end && inSh(SH, r, 'shop') && okC(r.code)), rows = VF ? rowsAll.filter(r => r.vendor === VF) : rowsAll;
    const sc = d3.sum(rows.filter(r => r.date <= pEnd), r => +r.scheduled || 0), rc = d3.sum(rows, r => +r.received || 0);
    if (SH && !sc && !rc) return { title: SH, kpis: [], none: `No vendor schedule or receipts for ${SH} this month` };
    const byV = d3.rollups(rows, v => ({ s: d3.sum(v.filter(r => r.date <= pEnd), r => +r.scheduled || 0), r: d3.sum(v, r => +r.received || 0), n: new Set(v.map(r => r.code)).size }), r => r.vendor).filter(([, o]) => o.s > 0);
    const low = byV.filter(([, o]) => o.r / o.s < 0.8), short = d3.sum(rows.filter(r => r.date <= pEnd), r => 0) + d3.sum(byV, ([, o]) => Math.max(0, o.s - o.r));
    const ds = days(ms, end), byD = d3.rollup(rows, v => ({ s: d3.sum(v, r => +r.scheduled || 0), r: d3.sum(v, r => +r.received || 0) }), r => r.date);
    const rcC = d => { const o = byD.get(d) || {}; return !o.s || o.r >= o.s ? C.navy : o.r / o.s >= 0.8 ? C.warn : C.bad; }; /* 19 Nov (Umair): received bar colour as in Daily Production */
    const byS = d3.rollups(rows, v => ({ s: d3.sum(v.filter(r => r.date <= pEnd), r => +r.scheduled || 0), r: d3.sum(v, r => +r.received || 0) }), r => r.shop || '—').filter(([, o]) => o.s > 0);
    const c = sc ? rc / sc * 100 : null, col = v => v < 70 ? C.bad : v < 85 ? C.warn : C.navy;
    let cs = 0, cr = 0; const cS = ds.map(d => (cs += d <= pEnd ? (byD.get(d) || {}).s || 0 : 0)), cR = ds.map(d => (cr += (byD.get(d) || {}).r || 0));
    /* 14 Nov 12:11 (Umair): watch list - the 4 weakest vendors against schedule to date, and the 4 critical vendor-supplied parts lowest against safety stock (shop filter applies) */
    const sn = v => String(v).replace(/\s*\((PVT|PRIVATE)\b.*$/i, '').replace(/\s+(\(?PVT\)?|PRIVATE|LIMITED|LIMIT|LTD\.?|LT|CO\.?)\s*$/i, '').replace(/\s+/g, ' ').trim();
    const byVA = VF ? d3.rollups(rowsAll, v => ({ s: d3.sum(v.filter(r => r.date <= pEnd), r => +r.scheduled || 0), r: d3.sum(v, r => +r.received || 0), n: new Set(v.map(r => r.code)).size }), r => r.vendor).filter(([, o]) => o.s > 0) : byV;
    const vRows = byVA.map(([v, o]) => ({ k: sn(v), full: v, v: o.r / o.s * 100, tip: `${v}: ${kf(o.r)} received of ${kf(o.s)} scheduled to date · ${o.n} parts` }));
    const wVend = vRows.slice().sort((a, b) => a.v - b.v).slice(0, 4);   /* green (100%+) ones fill in when fewer are behind */   /* 14 Nov 13:08 (Umair): always 4, lowest first and upwards */
    const vOf = d3.rollup(D('atlas_vendor_supply').filter(r => r.date >= ms && inSh(SH, r, 'shop') && okC(r.code) && (!VF || r.vendor === VF)), v => d3.greatest(d3.rollups(v, w => d3.sum(w, r => (+r.received || 0) + (+r.scheduled || 0)), r => r.vendor), x => x[1])?.[0], r => String(r.code));
    /* 14 Nov 13:51 (Umair): parts = run-out (stock runway at this month's plan, as the Production tab's runway hover), not % of SAP safety
       stock, which is not reliable for some parts. Vendor parts of the shop(s) in the filter, soonest run-out first; red = runs out before
       the next expected delivery, amber = under 7 working days, green = covered. */
    const nm_ = new Map([...(D('atlas_parts') || []), ...(D('atlas_child_stock') || []), ...(D('atlas_stock_critical') || [])].map(r => [String(r.code), r.part]));
    const RWC = { bad: C.bad, warn: '#E0A100', ok: '#1E8C5A' }, ddf = d3.utcFormat('%-d %b');
    const wPart = window.__rwItem ? [...vOf.keys()].map(cd => { const it = window.__rwItem(cd); if (!it || !(it.need > 0)) return null;
        const dd = it.days, lab = dd >= 30 ? '30+ d' : (dd < 10 ? d3.format('.1f')(dd) : d3.format('.0f')(dd)) + ' d';
        return { code: cd, k: nm_.get(cd) || it.part || cd, sub: sn(vOf.get(cd) || ''), days: dd, col: RWC[it.lvl] || RWC.ok, w: Math.min(100, dd / 30 * 100), mk: it.nxd != null ? Math.min(100, it.nxd / 30 * 100) : null, lab,
          tip: `${nm_.get(cd) || it.part} (${cd}): stock ${nf(it.stock)}${it.vstock ? ` + ${nf(it.vstock)} at vendor` : ''}, need ${nf(it.need)} a day -> ${dd >= 30 ? 'lasts 30+ working days' : 'runs out ' + (it.out ? ddf(new Date(it.out + 'T00:00:00Z')) : '')}${it.nx ? ` · next delivery ${ddf(new Date(it.nx + 'T00:00:00Z'))} (${it.how})` : ' · no delivery expected'} · vendor ${vOf.get(cd)}` }; })
      .filter(Boolean).sort((a, b) => a.days - b.days || a.k.localeCompare(b.k)) : [];
    const allP = wPart.slice();   /* 14 Nov 15:44: full lists for the detail window */
    wPart.splice(4);
    /* vendors: fewer than 4 with a schedule -> add the shop's vendors that delivered with nothing scheduled yet */
    if (wVend.length < 4) d3.rollups(rows, v => d3.sum(v, r => +r.received || 0), r => r.vendor).filter(([v, q]) => q > 0 && !byV.some(([w]) => w === v)).sort((a, b) => b[1] - a[1])
      .forEach(([v, q]) => { if (wVend.length < 4) wVend.push({ k: sn(v), v: null, lab: '+' + kf(q), tip: `${v}: ${kf(q)} received, nothing scheduled to date` }); });
    const allV = vRows.slice().sort((a, b) => a.v - b.v).concat(d3.rollups(rowsAll, v => d3.sum(v, r => +r.received || 0), r => r.vendor).filter(([v, q]) => q > 0 && !byVA.some(([w]) => w === v)).sort((a, b) => b[1] - a[1])
      .map(([v, q]) => ({ k: sn(v), full: v, v: null, lab: '+' + kf(q), tip: `${v}: ${kf(q)} received, nothing scheduled to date` })));
    const wlist = (L, parts) => el => { el.innerHTML = L.length ? `<div class="ovwd">${L.map(x => wRowH(x, VF)).join('')}</div>` : '<div class="em">Nothing to show</div>';
      /* 16 Nov 18:08 (Umair): in the detail window the vendor and runway panels open only over the part name, and sit to its left so they can be read */
      if (parts) el.querySelectorAll('.wr[data-c]').forEach(r => { const n = r.querySelector('.wn') || r; n.classList.add('wnh');
        n.addEventListener('mousemove', ev => vpOv(ev, r.dataset.c, (L.find(x => x.code === r.dataset.c) || {}).k, n)); n.addEventListener('mouseleave', vpOvH); }); };
    return { title: `${F.shop ? ' · shop: ' + F.shop : ''}${F.model ? ' · model: ' + F.model : ''}${F.part ? ' · part: ' + (F.partName || F.part) : ''}${VF ? ' · vendor: ' + VF : ''}`.slice(3), /* 17 Nov 10:16 (Umair): month/date line removed, only the applied filter shows */ vf: VF || '', st: band(c, 95, 80), watch: { vendors: wVend, parts: wPart },
      tick: { bad: vRows.filter(x => x.v < 80).sort((a, b) => a.v - b.v), all: vRows.slice().sort((a, b) => b.v - a.v) },
      kpis: [['Supply compliance', pc(c), 'received vs schedule', c != null && c < 80 ? C.bad : c < 95 ? C.warn : null], ['Scheduled', kf(sc), 'pieces due to date'], ['Received', kf(rc), 'pieces, month to date'], /* 19 Nov 11:37 (Umair): Scheduled before Received */
        ['Vendors scheduled', nf(byV.length), `${nf(new Set(rows.filter(r => +r.scheduled > 0).map(r => r.code)).size)} parts`], ['Vendors under 80%', nf(low.length), `${pc(byV.length ? low.length / byV.length * 100 : null)} of vendors`, low.length ? C.bad : null]],
      vt: 'Daily receipts vs schedule', mini: el => colC(el, ds.filter(d => (byD.get(d) || {}).s || (byD.get(d) || {}).r), [{ name: 'Schedule', color: C.plan }, { name: 'Received', color: rcC }], (d, s) => (byD.get(d) || {})[s.name === 'Schedule' ? 's' : 'r'], { cFmt: d => +d.slice(8), ml: 34 }),
      detail: [
        /* 14 Nov 15:44 (Umair): the card's watch lists in full - 15 rows in view, scroll for the rest */
        { t: `Vendors · lowest compliance first (${allV.length})`, draw: wlist(allV) },
        { t: `Vendor parts · soonest run-out first (${allP.length})`, lg: [['Runs out before next delivery', C.bad], ['Under 7 working days', '#E0A100'], ['Covered', '#1E8C5A']], draw: wlist(allP, true) },
        { t: 'Cumulative receipts vs schedule', lg: [['Schedule', '#B9C1C9'], ['Received', C.navy]], draw: el => lineC(el, ds, [{ name: 'Schedule', color: '#B9C1C9', values: cS, dash: '4 3' }, { name: 'Received', color: C.navy, values: cR }], { h: 260, xFmt: dlab }) },
        /* 19 Nov 11:34 (Umair): 'Weakest 12 vendors' and 'Compliance by shop' removed (redundant); Daily receipts now sits beside Cumulative */
        { t: 'Daily receipts vs schedule', lg: [['Schedule', C.plan], ['Received', C.navy], ['80–99% of schedule', C.warn], ['Below 80%', C.bad]], draw: el => colC(el, ds, [{ name: 'Schedule', color: C.plan }, { name: 'Received', color: rcC }], (d, s) => (byD.get(d) || {})[s.name === 'Schedule' ? 's' : 'r'], { h: 260, cFmt: d => +d.slice(8), vals: 1 }) }], /* 19 Nov (Umair): Daily Production colours and bar labels */
      foot: '' /* 17 Nov 10:16 (Umair): footnote removed */ }; };

  /* 12 Nov 00:34 (Umair): 'Exclude Raw Material' toggle leaves out Raw Material, Production parts and Lubricants */
  const CATC = { 'Raw Material': '#051C2C', 'Production parts': '#2251FF', Lubricants: '#00A9F4', Tools: '#1F9E89', Consumables: '#E0A100', Spares: '#8C6BD8' };
  const EXC = ['Raw Material', 'Production parts', 'Lubricants'];
  let exRM = true, wasOn = false;   /* on by default every time the Overview is opened (Umair, 12 Nov 00:46) */
  /* 17 Nov 2026 (Umair): ATDMC die making (plant MDP) stock joins only when 'Include ATDMC Stock' is on (window.__ATDMC, shared with the Inventory tab, off by default) */
  /* 18 Nov 2026 (Umair): a shared tool's stock is split across the shops that use it, by each shop's share of the last 12 months' issues (sap_stock 'split' = [[shop, share], ...]); one row per shop, quantities and values scaled, the name carries the share */
  if (!window.__invSplit) window.__invSplit = rows => { if (!rows || !rows.some(r => r && r.split && r.split.length > 1)) return rows; const K = ['stock', 'qi', 'blocked', 'transit', 'value_pkr', 'rcv_90d', 'issue_90d', 'rcv_12m', 'rcv_12m_pkr', 'rcv_6m', 'rcv_6m_pkr', 'use_6m_pkr', 'use_month', 'excess_pkr', 'cover_stock'], out = [];
    rows.forEach(r => { if (!r || !r.split || r.split.length < 2) { out.push(r); return; } const note = r.split.map(([s, f]) => s + ' ' + Math.round(f * 100) + '%').join(' · ');
      r.split.forEach(([s, f]) => { const x = { ...r, shop: s, split_share: f, split_note: note, split_total_pkr: r.value_pkr, part: `${r.part || r.code} [${s} ${Math.round(f * 100)}%]` }; K.forEach(k => { if (r[k] != null && r[k] !== '' && !isNaN(+r[k])) x[k] = Math.round(+r[k] * f * 100) / 100; }); out.push(x); }); });
    return out; };
  let _sst = [null, null];
  const SST = () => { const b0 = D('sap_stock') || []; if (_sst[0] !== b0) _sst = [b0, window.__invSplit(b0)]; const b = _sst[1], x = window.__ATDMC ? D('sap_stock_atdmc') || [] : []; return x.length ? b.concat(x) : b; };
  M.inventory = (P, F0) => { const F = F0 || {}, SH = SHf(P), S = SST().filter(r => r.code && inSh(SH, r, 'shop') && !(exRM && EXC.includes(r.category)) && (!F.model || pModsOf({ models: r.models }).includes(F.model)) && (!F.part || String(r.code) === String(F.part))), V = d3.sum(S, r => +r.value_pkr || 0), EX = d3.sum(S, r => +r.excess_pkr || 0);
    const dead = S.filter(r => r.move_bucket === 'No movement since Jan 2024' || r.move_bucket === 'Over 1 year'), DV = d3.sum(dead, r => +r.value_pkr || 0);
    const low = S.filter(r => r.cover_bucket === 'Under 15 days' || r.cover_bucket === 'Out of stock');
    const cat = d3.rollups(S, v => d3.sum(v, r => +r.value_pkr || 0), r => r.category || '—').sort((a, b) => b[1] - a[1]);
    const mv = ['Moved in last 90 days', '91–365 days', 'Over 1 year', 'No movement since Jan 2024'].map(b => [b, d3.sum(S.filter(r => r.move_bucket === b), r => +r.value_pkr || 0)]);
    const stg = d3.rollups(S, v => d3.sum(v, r => +r.value_pkr || 0), r => r.stage || 'Not classed').sort((a, b) => b[1] - a[1]);
    const top = S.filter(r => +r.excess_pkr > 0).sort((a, b) => b.excess_pkr - a.excess_pkr).slice(0, 12);
    const asof = (S.find(r => r.asof) || {}).asof || '';
    /* 14 Nov 19:29 (Umair): stock health - slow / no move = value of items with no issue for over a year; excess = excess value of the other items; working = the rest. The three add up to the stock value. */
    const deadS = new Set(dead), hEX = d3.sum(S.filter(r => !deadS.has(r)), r => Math.min(+r.excess_pkr || 0, +r.value_pkr || 0)), health = [['Working', Math.max(0, V - DV - hEX), '#1F9E89'], ['Excess', hEX, '#E0A100'], ['Slow / no move', DV, '#B3261E']];
    return { health, cat, title: `SAP stock${asof ? ' as of ' + dlab(asof) : ''}${exRM ? ' · excl. raw material, production parts, lubricants' : ''}`, st: band(V ? EX / V * 100 : null, 10, 25, false),
      kpis: [['Stock value', rs(V), `${nf(S.length)} materials`], ['Excess stock', rs(EX), `${pc(V ? EX / V * 100 : null)} of value`, C.warn], ['Slow moving', rs(DV), 'no issue for over a year', C.bad],
        ['Low cover', nf(low.length), 'under 15 days or out of stock', low.length ? C.bad : null], ['Moved in 90 days', rs(mv[0][1]), `${pc(V ? mv[0][1] / V * 100 : null)} of value`]],
      vt: 'Stock value by category', mini: el => { /* consumption = cost-centre issues (MB51) of the last complete month, shop filter applied; DIT = stock value / (that month's issues / days in month) */
        const cm = P.month && P.month < (window.__TODAY || '').slice(0, 7) ? P.month : d3.utcFormat('%Y-%m')(d3.utcMonth.offset(new Date((P.month || (window.__TODAY || '').slice(0, 7)) + '-01T00:00:00Z'), -1));
        const nd = d3.utcDay.count(new Date(cm + '-01T00:00:00Z'), d3.utcMonth.offset(new Date(cm + '-01T00:00:00Z'), 1));
        const cc = d3.rollup((D('sap_cc') || []).filter(r => r.month === cm && inSh(SH, r, 'shop')), v => d3.sum(v, r => +r.value_pkr || 0), r => r.category), ct = d3.sum(cat, ([c]) => Math.max(0, cc.get(c) || 0));
        donutC(el, cat.map(([c, v]) => ({ label: c, v, color: CATC[c] || '#8A949E' })), { fmt: rs, center: V >= 1e6 ? d3.format(',.0f')(V / 1e6) + 'M' : rs(V).replace('Rs ', ''), legend: 'side',   /* 15 Nov 09:56 (Umair): whole millions in the donut */ sideTitle: 'Monthly consumption', sideShort: 'Monthly use',   /* 15 Nov 09:28 (Umair) */
          gauge: (() => { const cons = d3.sum(cat, ([c]) => Math.max(0, cc.get(c) || 0)), d = cons > 0 ? V / (cons / nd) : null, T = 30;   /* 15 Nov 09:35 (Umair): targets Tools 60, Consumables 45, Spares 180 days; others 30 */
            return { days: d, target: T, targets: { Tools: 60, Consumables: 45, Spares: 180 }, stock: V, cons, nd, mon: d3.utcFormat('%b')(new Date(cm + '-01T00:00:00Z')), cash: cons > 0 ? Math.max(0, V - T * cons / nd) : 0 }; })(),
          side: cat.map(([c, v]) => { const u = Math.max(0, cc.get(c) || 0); return { label: c, color: CATC[c] || '#8A949E', cons: u, share: ct ? u / ct * 100 : 0, stock: v, dit: u > 0 ? v / (u / nd) : null }; }) }); },
      detail: [
        { t: 'Stock value by category', draw: el => donutC(el, cat.map(([c, v]) => ({ label: c, v, color: CATC[c] || '#8A949E' })), { h: 250, fmt: rs, center: rs(V) }) },
        { t: 'Stock value by last movement', draw: el => hbarC(el, mv.map(([b, v], i) => ({ label: b, v, lab: rs(v), color: [C.navy, C.blue, C.warn, C.bad][i], tip: [b, rs(v), pc(v / V * 100) + ' of stock'] })), { fmt: rs, h: 250, lw: 170, lc: 28 }) },
        { t: 'Stock value by stage', draw: el => hbarC(el, stg.map(([s, v]) => ({ label: s, v, lab: rs(v) })), { fmt: rs, h: 250, lw: 170, lc: 28 }) },
        { t: 'Largest excess stock (12)', draw: el => hbarC(el, top.map(r => ({ label: `${r.part || r.code}`, v: +r.excess_pkr, lab: rs(+r.excess_pkr), color: C.warn, tip: [r.part, r.code, `Excess ${rs(+r.excess_pkr)} of ${rs(+r.value_pkr)}`, `${r.category} · ${r.shop || 'no shop'}`, `Cover: ${r.cover_bucket}`] })), { fmt: rs, h: 270, lw: 190, lc: 30 }) }],
      foot: 'SAP MB52 stock valued at SAP price; excess = stock above the cover target from recent use.' }; };

  M.workforce = P => { const end = P.actEnd, A = D('sp_attendance').filter(r => r.date >= P.start && r.date <= end && (r.present + r.absent) > 0 && inSh(SHf(P), r, 'shop'));
    if (!A.length) return { title: mon(P.month), kpis: [], none: 'No attendance for this month yet' };
    const pr = d3.sum(A, r => r.present), ab = d3.sum(A, r => r.absent), ot = d3.sum(A, r => r.ot_hours), last = d3.max(A, r => r.date), L = A.filter(r => r.date === last);
    const hc = d3.sum(L, r => r.headcount), ds = [...new Set(A.map(r => r.date))].sort();
    const byD = d3.rollup(A, v => ({ a: d3.sum(v, r => r.absent), p: d3.sum(v, r => r.present), o: d3.sum(v, r => r.ot_hours) }), r => r.date);
    const byS = d3.rollups(A, v => ({ a: d3.sum(v, r => r.absent), p: d3.sum(v, r => r.present), o: d3.sum(v, r => r.ot_hours), hc: d3.sum(v.filter(r => r.date === last), r => r.headcount) }), r => r.shop || r.area);
    const ap = pr + ab ? ab / (pr + ab) * 100 : null, la = d3.sum(L, r => r.present) + d3.sum(L, r => r.absent), lap = la ? d3.sum(L, r => r.absent) / la * 100 : null;
    /* 15 Nov 19:19 (Umair): card = 4-step KPI (absenteeism, MoM, overtime hours, overtime Rs); body flips labour-hours bridge -> weekly
       overtime bought vs hours lost -> shop quadrant (absenteeism vs OT per head); foot names people/shops to act on. Target 10% absent.
       Overtime costed like the COGM: Rs 42,500 / 26 days / 8 h x 1.5. */
    const OTR = 42500 / 26 / 8 * 1.5, sh_ = SHf(P);
    /* the sheet books Carburetor Assembly and Carburetor Machining overtime on 'Carburetor' rows with no headcount: put it back with its people */
    const fx = r => r.area === 'Carburetor' && /assembly/i.test(r.section || '') ? { ...r, shop: 'Carburetor Assembly' } : r.area === 'Carburetor' && /machining/i.test(r.section || '') ? { ...r, shop: 'Carburetor Machining' } : r;
    const ALL = D('sp_attendance').map(fx).filter(r => inSh(sh_, r, 'shop')), sun = d => new Date(d + 'T00:00:00Z').getUTCDay() === 0;
    const AO = ALL.filter(r => r.date >= P.start && r.date <= end), otA = d3.sum(AO, r => r.ot_hours);
    const pm_ = (() => { const d = new Date(Date.UTC(+P.month.slice(0, 4), +P.month.slice(5, 7) - 2, 1)); return d.toISOString().slice(0, 7); })();
    const PA = ALL.filter(r => r.date.startsWith(pm_)), pap = d3.sum(PA, r => r.present + r.absent) ? d3.sum(PA, r => r.absent) / d3.sum(PA, r => r.present + r.absent) * 100 : null;
    const dTot = d3.rollup(ALL.filter(r => !sun(r.date)), v => d3.sum(v, r => r.present + r.absent), r => r.date);
    const roster = d3.median([...byD].filter(([d]) => !sun(d)).map(([, o]) => o.p + o.a)) || 0, incomplete = [...byD].filter(([d, o]) => !sun(d) && o.p + o.a < roster * 0.9).map(([d]) => d).sort();
    const wk = d => { const t = new Date(d + 'T00:00:00Z'), k = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - k); return t.toISOString().slice(0, 10); };
    const wMed = d3.rollup([...dTot], v => d3.median(v, x => x[1]), x => wk(x[0]));
    const W = d3.rollups(ALL, v => ({ a: d3.sum(v, r => r.absent), p: d3.sum(v, r => r.present), o: d3.sum(v, r => r.ot_hours), ds: [...new Set(v.filter(r => !sun(r.date)).map(r => r.date))] }), r => wk(r.date)).sort((a, b) => a[0] < b[0] ? -1 : 1).slice(-6)
      .map(([k, o]) => ({ k, lost: o.a * 8, ot: o.o, ap: o.p + o.a ? o.a / (o.p + o.a) * 100 : null, inc: o.ds.length < 6 || o.ds.some(d => incomplete.includes(d)) }));
    const byS2 = d3.rollups(AO, v => ({ a: d3.sum(v, r => r.absent), p: d3.sum(v, r => r.present), o: d3.sum(v, r => r.ot_hours), hc: d3.median([...d3.rollup(v.filter(r => !sun(r.date)), w_ => d3.sum(w_, r => r.present + r.absent), r => r.date).values()]) || 0 }), r => r.shop || r.area);
    const shQ = byS2.map(([k, o]) => ({ k, ap: o.p + o.a ? o.a / (o.p + o.a) * 100 : 0, oh: o.hc ? o.o / o.hc : 0, ot: o.o, hc: o.hc })).filter(d => d.hc >= 5);
    const ohAll = roster ? otA / roster : 0;
    const PP = (D('sp_attendance_people') || []).filter(r => r.month === P.month && inSh(sh_, r, 'shop')), both = PP.filter(r => r.absent_with_ot_days > 0);
    const tk = [...(both.length ? [`<b>${nf(both.length)} people · ${kf(d3.sum(both, r => +r.ot_in_abs_weeks || 0))} OT h</b>`] : []),
      ...shQ.filter(d => d.ap > 10 && d.oh > ohAll).sort((a, b) => b.ap - a.ap).map(d => `${esc(d.k)} ${f0(d.ap)}% absent, ${f0(d.oh)} OT h/head`),
      ...shQ.filter(d => d.ap <= 10 && d.oh > ohAll * 2).map(d => `${esc(d.k)} ${f0(d.oh)} OT h/head`), ...shQ.filter(d => d.ap > 15 && d.oh < ohAll / 3).map(d => `${esc(d.k)} ${f0(d.ap)}% absent, ${f0(d.oh)} OT h/head`),
      ...(incomplete.length ? [`<span style="color:#9A6B00">sheet incomplete: ${incomplete.slice(-3).map(dlab).join(', ')}</span>`] : [])];
    const wf = { bridge: { ros: (pr + ab) * 8, lost: ab * 8, ot: otA, worked: pr * 8 + otA, otRs: otA * OTR, people: roster, ap, from: P.start, to: last }, W, Q: shQ, ohAll, tk, both: both.length };
    const dm = ap != null && pap != null ? ap - pap : null;
    return { title: `${mon(P.month)} to ${dlab(last)}`, st: band(ap, 10, 13, false), wf,
      kh: [['Absenteeism', [ap == null ? '—' : f1(ap) + '%', dm == null ? '—' : (dm <= 0 ? '▼' : '▲') + f1(Math.abs(dm))], `Absent of present + absent, ${mon(P.month)} to ${dlab(last)}${pap != null ? ` · ${mon(pm_)} ${f1(pap)}%` : ''} · target 10%`, ap == null ? null : ap > 13 ? C.bad : ap > 10 ? '#9A6B00' : '#1E8C5A'],
        ['Overtime', [kf(otA) + ' h', rs(otA * OTR)], `Overtime hours ${mon(P.month)} to ${dlab(last)}, costed at Rs ${f0(OTR)} an hour (Rs 42,500 a month / 26 days / 8 h x 1.5)`, '#2251FF']],
      kpis: [['Headcount', nf(hc), `on ${dlab(last)}`], ['Absenteeism', f1(ap) + '%', 'absent of present + absent, MTD', ap > 8 ? C.bad : ap > 5 ? C.warn : null], ['Absent latest day', lap == null ? '—' : f1(lap) + '%', dlab(last)],
        ['Overtime', kf(ot) + ' h', `${f1(pr ? ot / (pr * 8) * 100 : 0)}% of present hours`], ['OT per day', kf(ot / ds.length) + ' h', `${ds.length} days recorded`]],
      vt: 'Daily absenteeism %', mini: el => lineC(el, ds, [{ name: 'Absenteeism', color: C.bad, values: ds.map(d => { const o = byD.get(d); return o.p + o.a ? Math.round(o.a / (o.p + o.a) * 1000) / 10 : null; }) }], { xFmt: d => +d.slice(8), yFmt: v => v + '%', fmt: v => f1(v) + '%', ml: 30, min: 0 }),
      detail: [
        { t: 'Absenteeism by shop (month to date)', draw: el => hbarC(el, byS.map(([s, o]) => ({ label: s, v: o.p + o.a ? o.a / (o.p + o.a) * 100 : 0 })).sort((a, b) => b.v - a.v).map(d => ({ ...d, lab: f1(d.v) + '%', color: d.v > 8 ? C.bad : d.v > 5 ? C.warn : C.navy })), { fmt: v => f1(v) + '%', h: 280, lw: 130 }) },
        { t: 'Overtime hours by shop (month to date)', draw: el => hbarC(el, byS.map(([s, o]) => ({ label: s, v: o.o, tip: [s, `${kf(o.o)} OT hours`, `${f1(o.p ? o.o / (o.p * 8) * 100 : 0)}% of present hours`, `Headcount ${nf(o.hc)}`] })).sort((a, b) => b.v - a.v).map(d => ({ ...d, lab: kf(d.v) + ' h', color: C.blue })), { fmt: kf, h: 280, lw: 130 }) },
        { t: 'Daily absenteeism %', draw: el => lineC(el, ds, [{ name: 'Absenteeism', color: C.bad, values: ds.map(d => { const o = byD.get(d); return o.p + o.a ? Math.round(o.a / (o.p + o.a) * 1000) / 10 : null; }) }], { h: 230, xFmt: dlab, yFmt: v => v + '%', fmt: v => f1(v) + '%', min: 0 }) },
        { t: 'Daily overtime hours', draw: el => colC(el, ds, [{ name: 'Overtime hours', color: C.blue }], d => (byD.get(d) || {}).o, { h: 230, cFmt: d => +d.slice(8) }) }],
      foot: 'Attendance workbook (SharePoint). Sundays have no attendance marks.' }; };

  M.cost = P => { const R = D('cogm').filter(r => inSh(SHf(P), r, 'shop')), months = [...new Set(R.map(r => r.month))].sort(), m = months.includes(P.month) ? P.month : months[months.length - 1];
    const EL = [['Direct material', '#CFDAE5'], ['Indirect material', '#1D3FD6'], ['Direct labour', '#C2410C'], ['Utilities', '#0B6E4F']], isC = r => EL.some(([e]) => e === r.element);
    const cur = R.filter(r => r.month === m && isC(r)), T = d3.sum(cur, r => r.value_pkr), e = n => d3.sum(cur.filter(r => r.element === n), r => r.value_pkr);
    const byM = months.map(mm => ({ m: mm, ...Object.fromEntries(EL.map(([n]) => [n, d3.sum(R.filter(r => r.month === mm && r.element === n), r => r.value_pkr)])) }));
    const byS = d3.rollups(cur, v => Object.fromEntries(EL.map(([n]) => [n, d3.sum(v.filter(r => r.element === n), r => r.value_pkr)])), r => r.shop).sort((a, b) => d3.sum(EL, ([n]) => b[1][n]) - d3.sum(EL, ([n]) => a[1][n]));
    const V = new Map(R.filter(r => r.month === m && r.element === 'Volume').map(r => [r.shop, r.units]));
    const unit = byS.map(([s]) => { const u = V.get(s); return u ? { label: s, v: d3.sum(cur.filter(r => r.shop === s && !r.spd), r => r.value_pkr) / u, u } : null; }).filter(Boolean).sort((a, b) => b.v - a.v);
    const spd = d3.sum(cur.filter(r => r.spd), r => r.value_pkr), asof = (R.find(r => r.asof) || {}).asof || '';
    /* 15 Nov 11:29 (Umair): card leads with conversion cost (labour, tools, consumables, spares + lubricants, utilities) - what the shops control.
       Cost per part = conversion cost / parts made; material is left out of it because SAP issues material to production orders before the
       parts are finished, so a month-to-date material cost per part reads far too high mid-month. The current month is projected at its run rate. */
    const CV = [['Labour', r => r.element === 'Direct labour', '#1E8C5A'], ['Consumables', r => r.element === 'Indirect material' && r.sub === 'Consumables', '#2251FF'],
      ['Tools', r => r.element === 'Indirect material' && r.sub === 'Tools', '#E0A100'], ['Spares + Lubes', r => r.element === 'Indirect material' && (r.sub === 'Spares' || r.sub === 'Lubricants'), '#8C6BD8'],
      ['Utilities', r => r.element === 'Utilities', '#00A9F4']];
    const cvOf = (rows) => d3.sum(rows.filter(r => CV.some(([, f]) => f(r))), r => r.value_pkr);
    const cvM = months.map(mm => { const rr = R.filter(r => r.month === mm); return { m: mm, parts: Object.fromEntries(CV.map(([k, f]) => [k, d3.sum(rr.filter(f), r => r.value_pkr)])), mat: d3.sum(rr.filter(r => r.element === 'Direct material'), r => r.value_pkr),
      units: d3.sum(rr.filter(r => r.element === 'Volume'), r => +r.units || 0) }; }).map(d => ({ ...d, tot: d3.sum(CV, ([k]) => d.parts[k]) }));
    const nd = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(), live = m === asof.slice(0, 7), el_ = live ? Math.max(1, +asof.slice(8)) : nd, fac = nd / el_;
    const ci = months.indexOf(m), pm = ci > 0 ? months[ci - 1] : null, cM = cvM[ci], pM = pm ? cvM[ci - 1] : null;
    const cpp = d => d && d.units ? d.tot / d.units : null, cNow = cpp(cM), cPrev = cpp(pM), chg = cNow != null && cPrev ? (cNow / cPrev - 1) * 100 : null;
    const proj = cM ? cM.tot * fac : null, pchg = proj != null && pM && pM.tot ? (proj / pM.tot - 1) * 100 : null;
    const shU = (mm, sh) => d3.sum(R.filter(r => r.month === mm && r.shop === sh && r.element === 'Volume'), r => +r.units || 0);
    const shC = (mm, sh) => cvOf(R.filter(r => r.month === mm && r.shop === sh));
    const shops = pm ? [...new Set(R.filter(r => r.month === m).map(r => r.shop))].map(sh => { const u1 = shU(m, sh), u0 = shU(pm, sh), c1 = shC(m, sh), c0 = shC(pm, sh);
      return u1 >= 500 && u0 >= 500 && c1 > 0 && c0 > 0 ? { k: sh, now: c1 / u1, prev: c0 / u0, v: (c1 / u1 / (c0 / u0) - 1) * 100 } : null; }).filter(Boolean).sort((a, b) => b.v - a.v) : [];
    const cv = { CV: CV.map(([k, , c]) => [k, c]), M: cvM, cur: m, prev: pm, live, fac, el: el_, nd, cNow, cPrev, chg, proj, pchg, shops, asof };
    const arw = v => v == null ? '' : (v >= 0 ? ' ▲' : ' ▼') + f1(Math.abs(v)) + '%', scol = v => v == null ? '#051C2C' : v <= 2 ? '#1E8C5A' : v <= 5 ? '#9A6B00' : C.bad;
    return { cv, st: band(chg, 2, 5, false),
      kh: [['Conv. Cost', cNow == null ? '—' : ['Rs ' + f0(cNow), chg == null ? '—' : arw(chg).trim() + ' MoM'], `Labour, tools, consumables, spares, lubricants and utilities per part made, ${mon(m)}${live ? ' to ' + dlab(asof) : ''} vs ${pm ? mon(pm) : '—'} (Rs ${cPrev == null ? '—' : f0(cPrev)})`, scol(chg)],
        [live ? 'Projected ' + mon(m).slice(0, 3) : mon(m).slice(0, 3) + ' conversion', [rs(proj), pchg == null ? '—' : arw(pchg).trim() + ' MoM'], live ? `${rs(cM.tot)} to ${dlab(asof)} at run rate x ${nd}/${el_} days, vs ${pm ? mon(pm) : '—'} ${rs(pM && pM.tot)}` : '', scol(pchg)]],
      title: `COGM ${mon(m)}${m === asof.slice(0, 7) ? ' to ' + dlab(asof) : ''}`,
      kpis: [['COGM', rs(T), SHf(P) && V.get(SHf(P)) ? `Rs ${f0(d3.sum(cur.filter(r => !r.spd), r => r.value_pkr) / V.get(SHf(P)))} per OEM unit` : `${byS.length} shops`], ...EL.map(([n, c]) => [n, rs(e(n)), pc(T ? e(n) / T * 100 : null) + ' of COGM', null, c]), ['SPD share', rs(spd), 'SPD parts made in-house']].slice(0, 6),
      vt: 'COGM by month', mini: el => colC(el, byM.map(d => d.m), EL.map(([n, c]) => ({ name: n, color: c })), (mm, s) => byM.find(d => d.m === mm)[s.name], { stack: 1, cFmt: mon, yFmt: v => v >= 1e9 ? d3.format(',.1f')(v / 1e9) + 'B' : f0(v / 1e6) + 'M', fmt: rs, ml: 38 }),
      detail: [
        { t: `Conversion cost per part by shop, ${mon(m)} vs ${pm ? mon(pm) : '—'}`, draw: el => hbarC(el, shops.map(d => ({ label: d.k, v: d.now, lab: `Rs ${f1(d.now)} (${d.v >= 0 ? '+' : ''}${f1(d.v)}%)`, color: d.v > 5 ? C.bad : d.v > 2 ? '#E0A100' : '#1E8C5A', tip: [d.k, `Rs ${f1(d.now)} per part in ${mon(m)}`, `Rs ${f1(d.prev)} in ${pm ? mon(pm) : '—'}`, `${d.v >= 0 ? '+' : ''}${f1(d.v)}%`] })), { fmt: v => f1(v), h: 300, lw: 130 }) },
        { t: 'COGM by shop and element', lg: EL, draw: el => colC(el, byS.map(d => d[0]), EL.map(([n, c]) => ({ name: n, color: c })), (s, x) => new Map(byS).get(s)[x.name], { stack: 1, h: 280, rot: 1, fmt: rs }) },
        { t: 'COGM by month', lg: EL, draw: el => colC(el, byM.map(d => d.m), EL.map(([n, c]) => ({ name: n, color: c })), (mm, s) => byM.find(d => d.m === mm)[s.name], { stack: 1, h: 280, cFmt: mon, fmt: rs }) },
        { t: 'OEM cost per unit by shop (Rs / unit)', draw: el => hbarC(el, unit.map(d => ({ ...d, lab: 'Rs ' + f0(d.v), tip: [d.label, `Rs ${f0(d.v)} per OEM unit`, `${nf(d.u)} units`] })), { fmt: v => f0(v), h: 280, lw: 130 }) },
        { t: 'Cost elements', draw: el => donutC(el, EL.map(([n, c]) => ({ label: n, v: e(n), color: c })), { h: 250, fmt: rs, center: rs(T) }) }],
      foot: 'SAP MB51 issues, cost-centre issues, attendance (Rs 42,500 a month) and the utilities sheet; SPD parts carry their own share.' }; };

  M.capacity = P => { if (SHf(P) && SHf(P) !== 'Clutch') return { title: SHf(P), kpis: [], none: 'Capacity time studies cover the Clutch area only' };
    const MC = D('cap_machines'), PT = D('cap_parts'), parts = new Map(D('atlas_parts').map(r => [String(r.code), r]));
    const arr = v => Array.isArray(v) ? v.map(String) : typeof v === 'string' ? (v.trim().startsWith('[') ? (() => { try { return JSON.parse(v).map(String); } catch { return []; } })() : v.split(/[,;\s]+/).filter(Boolean)) : [];
    const run = MC.filter(r => r.status === 'Running' && +r.cap_month > 0);
    const plan = c => d3.sum(D('atlas_parts_daily').filter(r => r.date.startsWith(P.month) && String(r.code) === c), r => +r.prod_plan || 0);
    const PL = PT.map(p => { const ms = run.filter(r => r.part === p.part), ops = d3.rollups(ms, v => d3.sum(v, r => +r.cap_month), r => r.op), cap = ops.length ? d3.min(ops, d => d[1]) : null, bn = ops.length ? ops.find(d => d[1] === cap)[0] : null;
      const load = d3.sum(arr(p.plan_codes), plan); return { label: p.part, cap, load, bn, u: cap ? load / cap * 100 : null, mc: ms.length }; }).filter(d => d.cap);
    const util = run.map(r => ({ label: r.machine, line: r.line, part: r.part, op: r.op, v: +r.study_load / +r.cap_month * 100, cap: +r.cap_month, load: +r.study_load })).filter(d => isFinite(d.v)).sort((a, b) => b.v - a.v);
    const over = PL.filter(d => d.u > 100), hi = PL.slice().sort((a, b) => b.u - a.u)[0];
    const st = d3.rollups(MC, v => v.length, r => r.status);
    /* 15 Nov 22:17 (Umair): card = 4-step KPI, faces A part bullets (capacity / plan / month-end pace), B bottleneck of the most loaded part,
       C machine fleet by line and state; foot names the action for each over-loaded part plus machines down and parts with no plan. */
    const end = P.actEnd || P.month + '-28', nd = new Date(Date.UTC(+P.month.slice(0, 4), +P.month.slice(5, 7), 0)).getUTCDate(), el_ = Math.max(1, Math.min(nd, +end.slice(8, 10)));
    const act = cs => { const S = new Set(cs); return d3.sum(D('atlas_parts_daily').filter(r => r.date.startsWith(P.month) && r.date <= end && S.has(String(r.code))), r => +r.prod_actual || 0); };
    const PB = PT.map(p => { const ms = run.filter(r => r.part === p.part); if (!ms.length) return null;
      const ops = d3.rollups(ms, v => ({ cap: d3.sum(v, r => +r.cap_month), n: v.length, ct: v[0].ct, sh: v[0].shifts }), r => r.op).map(([op, o]) => ({ op, ...o }));
      const b = ops.reduce((a, c) => c.cap < a.cap ? c : a), plan_ = d3.sum(arr(p.plan_codes), plan), a_ = act(arr(p.actual_codes));
      const sb = MC.filter(r => r.status === 'Standby' && r.part === p.part && r.op === b.op);
      return { k: p.part, cap: b.cap, plan: plan_, act: a_, pace: a_ / el_ * nd, u: plan_ ? plan_ / b.cap * 100 : null, bn: b.op, ops, sb: sb.map(r => r.machine), perM: b.cap / b.n, sh: b.sh }; }).filter(Boolean);
    const OV = PB.filter(d => d.u > 100).sort((a, b) => b.u - a.u), short = d3.sum(OV, d => d.plan - d.cap), top = PB.slice().sort((a, b) => (b.u || 0) - (a.u || 0))[0];
    const acts = OV.map(d => d.sb.length ? `${esc(d.k.replace(/ (CG125|CD70)$/, ''))}: put standby ${esc(d.sb[0])} on ${esc(d.bn)} (+${kf(d.perM)})`
      : d.sh && d.sh < 3 ? `${esc(d.k.replace(/ (CG125|CD70)$/, ''))}: 3rd shift on ${esc(d.bn)} (+${kf(d.cap / d.sh)})` : `${esc(d.k)}: ${kf(d.plan - d.cap)} pcs short on ${esc(d.bn)}`);
    const down = MC.filter(r => r.status === 'Not working'), nostudy = MC.filter(r => r.status === 'No time study'), noplan = PB.filter(d => !d.plan && d.act > 0);
    const tk = [...acts.map(t => `<b>${t}</b>`), ...(down.length ? [`${down.length} machine${down.length > 1 ? 's' : ''} not working (${down.map(r => esc(r.machine)).join(', ')})`] : []),
      ...noplan.map(d => `<span style="color:#9A6B00">${esc(d.k)}: ${kf(d.act)} made, no Atlas plan</span>`), ...(nostudy.length ? [`<span style="color:#5B6770">${nostudy.length} machines without a time study</span>`] : [])];
    const lines = d3.rollups(MC, v => v.map(r => ({ m: r.machine, op: r.op, part: r.part, s: r.status, u: r.status === 'Running' && +r.cap_month ? +r.study_load / +r.cap_month * 100 : null, cap: +r.cap_month || null })), r => r.line);
    const cp = { PB, top, lines, el: el_, nd, end, n: { run: run.length, all: MC.length, down: down.length, sb: MC.filter(r => r.status === 'Standby').length, ns: nostudy.length }, tk };
    const shortN = s_ => s_.replace(/ (CG125|CD70)$/, '');
    return { title: 'Clutch area · time studies', st: over.length ? 'bad' : hi && hi.u > 85 ? 'watch' : 'good', cp,
      kh: [[top ? ['Highest load', shortN(top.k)] : 'Highest load', [top && top.u != null ? pc(top.u) : '—', top && top.plan > top.cap ? `▼ ${f1((top.plan - top.cap) / 1000)}k pcs` : top ? `${pc(top.u)} of capacity` : '—'], top ? `${top.k}: Nov plan ${kf(top.plan)} vs capacity ${kf(top.cap)} a month (bottleneck ${top.bn})` : '', top && top.u > 100 ? C.bad : top && top.u > 85 ? '#9A6B00' : '#1E8C5A'],
        ['Over capacity', [`${OV.length} part${OV.length === 1 ? '' : 's'}`, OV.length ? `▼ ${f1(short / 1000)}k pcs` : 'none short'], OV.map(d => `${d.k} ${kf(d.plan - d.cap)} short`).join(' · ') || 'Every part within capacity', OV.length ? C.bad : '#1E8C5A']],
      kpis: [['Machines studied', nf(MC.length), `${nf(run.length)} running`], ['Parts / lines', `${nf(PL.length)} / ${nf(new Set(MC.map(r => r.line)).size)}`, 'with a capacity study'],
        ['Highest load', hi ? pc(hi.u) : '—', hi ? hi.label : '', hi && hi.u > 100 ? C.bad : hi && hi.u > 85 ? C.warn : null], ['Parts over capacity', nf(over.length), `${mon(P.month)} Atlas plan vs capacity`, over.length ? C.bad : null],
        ['Machines over 85%', nf(util.filter(d => d.v > 85).length), 'time-study load vs capacity']],
      vt: `Plan load vs capacity, ${mon(P.month)}`, mini: el => hbarC(el, PL.map(d => ({ label: d.label, v: d.u, lab: pc(d.u), color: d.u > 100 ? C.bad : d.u > 85 ? C.warn : C.navy, tip: [d.label, `Load ${pc(d.u)}`, `Plan ${kf(d.load)} vs capacity ${kf(d.cap)} a month`, `Bottleneck op ${d.bn}`] })).sort((a, b) => b.v - a.v), { fmt: pc, ref: 100, lw: 112, lc: 18 }),
      detail: [
        { t: `Part load vs capacity (${mon(P.month)} Atlas plan)`, lg: [['Capacity', '#E6E9EC'], ['Plan load', C.navy]], draw: el => hbarC(el, PL.map(d => ({ label: d.label, v: d.load, plan: d.cap, lab: pc(d.u), color: d.u > 100 ? C.bad : d.u > 85 ? C.warn : C.navy, tip: [d.label, `Plan ${kf(d.load)} vs capacity ${kf(d.cap)}`, `Load ${pc(d.u)}`, `Bottleneck op ${d.bn} · ${d.mc} machines`] })), { fmt: kf, h: 250, lw: 130 }) },
        { t: 'Machine status', draw: el => donutC(el, st.map(([s, n], i) => ({ label: s, v: n, color: { Running: C.navy, Standby: C.warn, 'Not working': C.bad }[s] || PAL[(i + 3) % PAL.length] })), { h: 250, fmt: nf, center: nf(MC.length) + ' machines' }) },
        { t: 'Busiest machines (time-study load vs capacity)', draw: el => hbarC(el, util.slice(0, 14).map(d => ({ label: `${d.label} · ${d.op}`, v: d.v, lab: pc(d.v), color: d.v > 100 ? C.bad : d.v > 85 ? C.warn : C.navy, tip: [d.label, `${d.line} · ${d.part} · ${d.op}`, `Load ${kf(d.load)} vs capacity ${kf(d.cap)} a month`] })), { fmt: pc, ref: 100, h: 320, lw: 190, lc: 30 }) },
        { t: 'Capacity by line (sum of bottleneck parts)', draw: el => hbarC(el, d3.rollups(run, v => v.length, r => r.line).map(([l, n]) => ({ label: l, v: n, lab: n + ' machines', color: C.blue })), { fmt: nf, h: 200, lw: 140 }) }],
      foot: 'Capacity from the Clutch area time studies (7.1 h per shift, 26 days). Shift changes saved on the Capacity tab are not applied here.' }; };

  M.projects = P => { const SH = SHf(P), kw = SH ? SH.split(/[\s/]+/).filter(w => w.length >= 4).map(w => w.toLowerCase()) : [];
    const J = D('jira_issues').filter(r => !SH || kw.some(w => (r.summary + ' ' + r.project_name).toLowerCase().includes(w)));
    if (SH && !J.length) return { title: SH, kpis: [], none: `No Jira activities mention ${SH}` };
    const _j = 0, today = window.__TODAY || new Date().toISOString().slice(0, 10);
    const dn = J.filter(r => r.cat === 'done'), ip = J.filter(r => r.cat === 'indeterminate'), nw = J.filter(r => r.cat === 'new'), od = J.filter(r => r.cat !== 'done' && r.due && r.due < today);
    const SC = [['To do', '#B9C1C9', 'new'], ['In progress', C.warn, 'indeterminate'], ['Done', '#1E8C5A', 'done']];
    const byP = d3.rollups(J, v => Object.fromEntries(SC.map(([n, , k]) => [n, v.filter(r => r.cat === k).length])), r => r.project_name).sort((a, b) => d3.sum(SC, ([n]) => b[1][n]) - d3.sum(SC, ([n]) => a[1][n]));
    const own = d3.rollups(J.filter(r => r.cat !== 'done'), v => ({ n: v.length, o: v.filter(r => r.due && r.due < today).length }), r => r.assignee || 'Unassigned').sort((a, b) => b[1].n - a[1].n).slice(0, 12);
    const asof = (J.find(r => r.asof) || {}).asof || '';
    const wk = d => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - (t.getUTCDay() + 6) % 7); return t.toISOString().slice(0, 10); };
    const wks = [...new Set([...J.map(r => r.created && wk(r.created)), ...dn.map(r => r.resolved && wk(r.resolved.slice(0, 10)))].filter(Boolean))].sort().slice(-12);
    /* 15 Nov 23:03 (Umair): activity status (Tasks + Epics) alongside sub-task status */
    const dd_ = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
    const SUB = J.filter(r => r.type === 'Sub-task'), ACT = J.filter(r => r.type !== 'Sub-task');
    const acts = ACT.map(r => { const k = SUB.filter(x => x.parent === r.key), nd = k.filter(x => x.cat === 'done').length, done = r.cat === 'done';
      const s_ = r.start || d3.min(k, x => x.start || x.created) || r.created, e_ = r.due || d3.max(k, x => x.due) || null;
      const p = k.length ? nd / k.length : null, x = s_ && e_ ? Math.max(0, Math.min(1, dd_(s_, today) / Math.max(1, dd_(s_, e_)))) : 0, late = !done && e_ && e_ < today ? dd_(e_, today) : 0;
      const col = done ? '#1E8C5A' : late ? C.bad : p != null ? (p < x - 0.25 ? C.bad : p < x - 0.05 ? '#E0A100' : '#1E8C5A') : '#E0A100';
      return { key: r.key, name: r.summary.replace(/\s+Task$/i, '').replace(/^(Observation|Changeover) of /i, '').replace(/\s+for\s+.*$/i, '').replace(/Re-?Layouting/i, 'Re-layout').replace(/^Line Automation of /i, 'Automation: ').replace(/ - /g, ', '), full: r.summary, status: r.status, owner: (r.assignee || '').replace(/\b([A-Z])([A-Z]+)\b/g, (m, a, b) => a + b.toLowerCase()), s: s_, e: e_, n: k.length, nd, p, x, late, done, col }; })
      .sort((a, b) => (a.s || '9') < (b.s || '9') ? -1 : 1);
    const subDue = SUB.filter(r => r.due && r.due <= today), subOd = SUB.filter(r => r.cat !== 'done' && r.due && r.due < today), subDn = SUB.filter(r => r.cat === 'done');
    const evd = [...new Set([...SUB.map(r => r.due), ...subDn.map(r => (r.resolved || '').slice(0, 10))].filter(d => d && d <= today)), today].sort();
    const burn = evd.map(d => ({ d, due: SUB.filter(r => r.due && r.due <= d).length, done: subDn.filter(r => (r.resolved || '').slice(0, 10) <= d).length }));
    const own2 = d3.rollups(SUB.filter(r => r.cat !== 'done'), v => ({ open: v.length, od: v.filter(r => r.due && r.due < today).length, last: d3.max(v, r => (r.updated || '').slice(0, 10)) }), r => r.assignee || 'Unassigned')
      .map(([k, o]) => ({ k: k.replace(/\b([A-Z])([A-Z]+)\b/g, (m, a, b) => a + b.toLowerCase()), ...o, days: o.last ? dd_(o.last, today) : null })).sort((a, b) => b.od - a.od || b.open - a.open).slice(0, 8);
    const aDone = acts.filter(a => a.done).length, aLate = acts.filter(a => a.late), aBeh = acts.filter(a => !a.done && !a.late && a.n && a.p < a.x - 0.05);
    const lastUp = d3.max(SUB.filter(r => r.cat !== 'done'), r => (r.updated || '').slice(0, 10));
    const tkP = [...aBeh.sort((a, b) => (a.p - a.x) - (b.p - b.x)).map(a => `<b>${esc(a.name)}: ${f0(a.p * 100)}% done vs ${f0(a.x * 100)}% expected${a.e ? ', due ' + dlab(a.e) : ''}</b>`),
      ...aLate.sort((a, b) => b.late - a.late).map(a => `${esc(a.name)}: ${a.late} days past due (${esc(a.owner || 'Unassigned')})`),
      ...(lastUp && dd_(lastUp, today) > 14 ? [`<span style="color:#5B6770">no open sub-task updated in Jira since ${dlab(lastUp)}</span>`] : [])];
    const pj = { acts, burn, own: own2, today, cm: subDn.filter(r => (r.resolved || '').slice(0, 7) === today.slice(0, 7)).length, tk: tkP };
    const pdue = subDue.length;
    return { title: `Jira${asof ? ' as of ' + dlab(asof) : ''}`, st: band(acts.length ? aLate.length / acts.length * 100 : null, 5, 15, false), pj,
      kh: [['Activities done', [`${aDone} of ${acts.length}`, `${aLate.length} late`], `${aDone} of ${acts.length} project activities done · ${aLate.length} past their due date${aBeh.length ? ` · ${aBeh.length} behind plan` : ''}`, aLate.length ? C.bad : '#1E8C5A'],
        ['Sub-tasks done', [`${subDn.filter(r => r.due && r.due <= today).length} of ${pdue}`, `${subOd.length} late`], `Sub-tasks done of the ${pdue} due by ${dlab(today)} (${subDn.length} done of ${SUB.length} in all) · ${subOd.length} past due`, subOd.length ? C.bad : '#1E8C5A']],
      kpis: [['Activities', nf(J.length), `${byP.length} projects`], ['Done', pc(J.length ? dn.length / J.length * 100 : null), `${nf(dn.length)} completed`, '#1E8C5A'], ['In progress', nf(ip.length), 'being worked on'], ['To do', nf(nw.length), 'not started'],
        ['Overdue', nf(od.length), 'past due date, not done', od.length ? C.bad : null]],
      vt: 'Status by project', mini: el => hbarC(el, byP.map(([p, o]) => ({ label: p, v: d3.sum(SC, ([n]) => o[n]), lab: `${o.Done}/${d3.sum(SC, ([n]) => o[n])} done`, color: C.navy, tip: [p, ...SC.map(([n]) => `${n}: ${o[n]}`)] })), { fmt: nf, lw: 120, lc: 20 }),
      detail: [
        { t: 'Activities by project and status', lg: SC.map(([n, c]) => [n, c]), draw: el => colC(el, byP.map(d => d[0]), SC.map(([n, c]) => ({ name: n, color: c })), (p, s) => new Map(byP).get(p)[s.name], { stack: 1, h: 260, fmt: nf, yFmt: nf, cFmt: p => p.length > 26 ? p.slice(0, 25) + '…' : p }) },
        { t: 'Open activities by owner (red = overdue)', draw: el => hbarC(el, own.map(([a, o]) => ({ label: a, v: o.n, lab: `${o.n}${o.o ? ' · ' + o.o + ' overdue' : ''}`, color: o.o ? C.bad : C.navy })), { fmt: nf, h: 280, lw: 150, lc: 24 }) },
        { t: 'Created vs completed per week', lg: [['Created', C.blue], ['Completed', '#1E8C5A']], draw: el => colC(el, wks, [{ name: 'Created', color: C.blue }, { name: 'Completed', color: '#1E8C5A' }], (w, s) => s.name === 'Created' ? J.filter(r => r.created && wk(r.created) === w).length : dn.filter(r => r.resolved && wk(r.resolved.slice(0, 10)) === w).length, { h: 240, fmt: nf, yFmt: nf, cFmt: dlab }) },
        { t: 'Overdue activities (longest first)', draw: el => hbarC(el, od.map(r => ({ label: `${r.key} ${r.summary}`, v: (new Date(today) - new Date(r.due)) / 864e5, color: C.bad, lab: Math.round((new Date(today) - new Date(r.due)) / 864e5) + ' days', tip: [r.key + ' · ' + r.summary, `Due ${r.due} · ${r.status}`, r.assignee || 'Unassigned', r.project_name] })).sort((a, b) => b.v - a.v).slice(0, 12), { fmt: v => f0(v) + ' d', h: 280, lw: 210, lc: 34, empty: 'Nothing overdue' }) }],
      foot: 'Jira (read only).' }; };

  M.savings = (P, F0) => { const F = F0 || {}, A = D('cr_ideas').filter(r => inSh(SHf(P), r, 'dash_shop', 'shop') && (!F.model || r.model === F.model) && (!F.part || r.part === F.part)), R = A.filter(r => !r.fin_only), keys = rs_ => new Set(rs_.map(r => r.key)).size;
    const ann = rs_ => d3.sum(rs_, r => +r.annual_pkr || 0), mon_ = rs_ => d3.sum(rs_, r => +r.monthly_pkr || 0);
    const done = R.filter(r => r.status === 'Completed'), ip = R.filter(r => r.status === 'In Progress'), pend = R.filter(r => r.status === 'Pending' || r.status === 'Proposal');
    const STC = [['Completed', '#1E8C5A'], ['In Progress', '#E0A100'], ['Pending', '#8E9AA6'], ['Proposal', '#C9D1D9']];
    const byS = d3.rollups(R, v => Object.fromEntries(STC.map(([s]) => [s, ann(v.filter(r => r.status === s))])), r => r.dash_shop || r.shop).sort((a, b) => d3.sum(STC, ([s]) => b[1][s]) - d3.sum(STC, ([s]) => a[1][s]));
    const byC = d3.rollups(R, v => ann(v), r => r.category || '—').sort((a, b) => b[1] - a[1]);
    const top = d3.rollups(R, v => ({ a: ann(v), st: v[0].status, shop: v[0].shop, item: v[0].item }), r => r.key).sort((a, b) => b[1].a - a[1].a).slice(0, 12);
    const T = ann(R);
    /* 15 Nov 17:42 (Umair): card = achieved run-rate vs plan by target month (landing line), shops by stage, overdue ideas */
    const cm = (P && P.month) || new Date().toISOString().slice(0, 7), fy0 = +cm.slice(5, 7) >= 7 ? +cm.slice(0, 4) : +cm.slice(0, 4) - 1;
    const FM = d3.range(12).map(i => { const mm = 7 + i; return `${fy0 + (mm > 12 ? 1 : 0)}-${String((mm - 1) % 12 + 1).padStart(2, '0')}`; });
    const tgt = r => (r.target || r.fin_target || '').slice(0, 7);
    const planC = FM.map(m => ann(R.filter(r => tgt(r) && tgt(r) <= m))), doneC = FM.map(m => m > cm ? null : ann(done.filter(r => (tgt(r) && tgt(r) < cm ? tgt(r) : cm) <= m)));
    const ci_ = FM.indexOf(cm), planNow = ci_ >= 0 ? planC[ci_] : null, doneNow = ann(done), gap = planNow != null ? planNow - doneNow : null;
    const odL = d3.rollups(R.filter(r => r.status !== 'Completed' && tgt(r) && tgt(r) < cm), v => ({ a: ann(v), item: v[0].item, shop: v[0].dash_shop || v[0].shop, t: tgt(v[0]), st: v[0].status }), r => r.key).sort((a, b) => b[1].a - a[1].a);
    const odV = d3.sum(odL, d => d[1].a), gp = planNow ? gap / planNow * 100 : null;
    const sv = { FM, cm, planC, doneC, planNow, doneNow, gap, T, od: odL, odV,
      shops: byS.map(([k, o]) => ({ k, c: o.Completed || 0, p: o['In Progress'] || 0, q: (o.Pending || 0) + (o.Proposal || 0) })) };
    return { title: 'Cost reduction ideas', st: band(gp, 5, 15, false), sv,
      kh: [['Achieved', [rs(doneNow), `${T ? f0(doneNow / T * 100) : 0}%`], `Annual saving of the ${nf(keys(done))} completed ideas, ${T ? f0(doneNow / T * 100) : 0}% of the ${rs(T)} pipeline${gap != null ? ` · plan to ${mon(cm)}: ${rs(planNow)} (${gap > 0 ? rs(gap) + ' behind' : 'on plan'})` : ''}`, gp == null ? '#1E8C5A' : gp > 15 ? C.bad : gp > 5 ? '#9A6B00' : '#1E8C5A'],
        ['Overdue', [rs(odV), `${nf(odL.length)} idea${odL.length === 1 ? '' : 's'}`], 'Ideas not completed whose target month has passed', odL.length ? C.bad : '#1E8C5A']],
      kpis: [['Ideas', nf(keys(R)), `${nf(keys(A.filter(r => r.fin_only)))} more on the finance list`], ['Total potential', rs(T), 'run-rate if all are done'], ['Achieved', rs(ann(done)), `${nf(keys(done))} completed · ${rs(mon_(done))}/month`, '#1E8C5A'],
        ['In progress', rs(ann(ip)), `${nf(keys(ip))} ideas`, '#B07D00'], ['Pending + proposals', rs(ann(pend)), `${nf(keys(pend))} ideas`]],
      vt: 'Annual saving by shop and status', mini: el => colC(el, byS.map(d => d[0]), STC.map(([n, c]) => ({ name: n, color: c })), (s, x) => new Map(byS).get(s)[x.name], { stack: 1, fmt: rs, yFmt: kf, rot: 1, ml: 32 }),
      detail: [
        { t: 'Annual saving by shop and status', lg: STC, draw: el => colC(el, byS.map(d => d[0]), STC.map(([n, c]) => ({ name: n, color: c })), (s, x) => new Map(byS).get(s)[x.name], { stack: 1, h: 270, fmt: rs, rot: 1 }) },
        { t: 'Annual saving by status', draw: el => donutC(el, STC.map(([s, c]) => ({ label: s, v: ann(R.filter(r => r.status === s)), color: c })), { h: 250, fmt: rs, center: rs(T) }) },
        { t: 'Annual saving by category', draw: el => hbarC(el, byC.map(([c, v], i) => ({ label: c, v, lab: rs(v), color: PAL[i % PAL.length] })), { fmt: rs, h: 250, lw: 130 }) },
        { t: 'Largest ideas (annual saving)', draw: el => hbarC(el, top.map(([k, o]) => ({ label: `${k} ${o.item}`, v: o.a, lab: rs(o.a), color: (STC.find(([s]) => s === o.st) || [, C.navy])[1], tip: [`${k} · ${o.item}`, o.shop, o.st, rs(o.a) + ' a year'] })), { fmt: rs, h: 290, lw: 190, lc: 30 }) }],
      foot: 'VA/CR ideas register; annual saving is the run-rate once an idea is in place.' }; };

  /* ---------- page ---------- */
  function sec() { return document.getElementById('summary'); }
  let last = {};
  let hvBase, hvT, hvLock = '', hvSh = '';   /* hover preview: shop selected before the hover, the delay timer, and the shop locked by a click */
  /* 14 Nov 12:11: card header with the flipping KPI (Production, Vendor Supply) */
  const mvF = (id, x) => id === 'cost' ? esc(x).replace(/ MoM$/, '<small class="ovmom">MoM</small>') : esc(x);
  const hdrF = (id, name, K, o) => `<div class="hd"><span class="ic">${ico(id)}</span><h3 class="ovh3">${esc(name)}</h3><div class="ovkh"><div class="ovfl${K.some(k => Array.isArray(k[1])) ? ' q4' : ''}" title="${esc(K.map(([l, v, sb]) => [].concat(l).join(' / ') + ' ' + [].concat(v).join(' / ') + (sb ? ' (' + sb + ')' : '')).join(' · '))}"><div class="ovfi">${K.slice(0, 2).map(([l, v, sb, c], i) =>
        `<div class="ovff${i ? ' bk' : ''}" style="border-left-color:${c || '#051C2C'}">${Array.isArray(l) ? `<span class="hv"><i><i>${esc(l[0])}</i><i>${esc(l[1])}</i></i></span>` : `<span>${esc(l)}</span>`}${Array.isArray(v) ? `<b class="hv"${c ? ` style="color:${c}"` : ''}><i><i>${mvF(id, v[0])}</i><i>${mvF(id, v[1])}</i></i></b>` : `<b${c ? ` style="color:${c}"` : ''}>${mvF(id, v)}</b>`}</div>`).join('')}</div></div></div>${pill(o.st)}</div>`;
  /* ticker strip used at the foot of the Production and Vendor Supply cards: still when 2 names or fewer, scrolling right to left above that */
  const tickS = (lab, items, cls, tt) => { if (!items.length) return ''; const it = items.join(' · ');
    if (items.length <= 2) return `<div class="ovbh ${cls}" title="${tt}"><b>${lab}</b> ${it}</div>`;
    return `<div class="ovbh ${cls} tk" title="${tt}"><b>${lab}</b><div class="tkw"><div class="tkt" style="animation-duration:${Math.max(10, items.length * 4)}s"><span class="tkg">${it}&nbsp;&nbsp;·&nbsp;&nbsp;</span><span class="tkg" aria-hidden="true">${it}&nbsp;&nbsp;·&nbsp;&nbsp;</span></div></div></div>`; };
  const okc = v => v < 80 ? C.bad : v < 100 ? '#9A6B00' : '#1E8C5A';
  if (!window.__ovFL) window.__ovFL = setInterval(() => document.querySelectorAll('#summary svg.ovflp').forEach(v => { if (v.matches(':hover')) return; const on = v.getAttribute('data-on'); v.setAttribute('data-on', v.dataset.n === '3' ? (on === 'a' ? 'b' : on === 'b' ? 'c' : 'a') : (on === 'a' ? 'b' : 'a')); }), 8000);
  if (!window.__ovWL) window.__ovWL = setInterval(() => document.querySelectorAll('#summary .ovwl').forEach(w => { if (w.dataset.hold || w.matches(':hover')) return; w.dataset.on = w.dataset.on === 'v' ? 'p' : 'v'; }), 7000);
  const vpOvH = () => { const pop = document.getElementById('vpop'); if (pop) { pop.style.display = 'none'; pop.dataset.code = ''; } };
  const vpOv = (ev, cd, part, anc) => { const VP = window.__vendPanel; if (!VP || !cd) return;
    let pop = document.getElementById('vpop'); if (!pop) { pop = document.createElement('div'); pop.id = 'vpop'; pop.className = 'vpop'; pop.style.display = 'none'; (document.getElementById('ael') || document.body).appendChild(pop); }
    if (pop.dataset.code !== 'ov' + cd) { pop.dataset.code = 'ov' + cd; pop.replaceChildren(); const p = window.__P(), keys = (window.__VHOV || {})[cd];
      const add = (title, VC, IH) => { const box = document.createElement('div'); box.className = 'vsk'; pop.appendChild(box); VP(box, VC, IH, p, true); const hd = box.querySelector('.vh'); if (hd) hd.textContent = title + ' · MTD vs month plan'; };
      if (keys) keys.forEach(k => { const [t, VC, IH] = window.__VPAN[k]; add(t, VC, IH); });
      else { const ih = (D('atlas_parts_daily') || []).some(r => String(r.code) === cd && r.date.startsWith(p.month) && ((+r.prod_plan || 0) + (+r.prod_actual || 0)) > 0); add(part || cd, cd, ih ? { own: cd } : null); }
      const rh = window.__rwHTML && window.__rwHTML(cd, part); if (rh) { const b = document.createElement('div'); b.className = 'rwpop ovrw'; b.innerHTML = rh; pop.appendChild(b); } }
    pop.style.display = 'flex'; const w = pop.offsetWidth, h = pop.offsetHeight; let x = ev.clientX + 16, y = ev.clientY + 12;
    if (anc) { const a = anc.getBoundingClientRect(); x = a.left - w - 14; y = a.top + a.height / 2 - h / 2; if (x < 8) x = Math.min(innerWidth - w - 8, a.right + 14); y = Math.max(8, Math.min(y, innerHeight - h - 8)); }
    else { if (x + w > innerWidth - 8) x = Math.max(8, ev.clientX - w - 16); if (y + h > innerHeight - 8) y = Math.max(8, innerHeight - h - 8); }
    pop.style.left = x + 'px'; pop.style.top = y + 'px'; };
  const wRowH = (x, vf) => { const c = x.col || (x.v == null ? '#1E8C5A' : okc(x.v)), w = x.w != null ? x.w : x.v == null ? 100 : Math.min(100, x.v / 1.5), mk = x.days != null ? x.mk : 66.7;
        return `<div class="wr${x.full && vf === x.full ? ' sel' : ''}"${x.days != null ? ` data-c="${esc(x.code)}"` : ` title="${esc(x.tip)}"`}${x.full ? ` data-v="${esc(x.full)}"` : ''}><span class="wn">${esc(x.k)}${x.sub ? `<i>${esc(x.sub)}</i>` : ''}</span><span class="wb"><span style="width:${Math.max(w, 2)}%;background:${c}"></span>${mk != null ? `<em style="left:${mk}%"></em>` : ''}</span><b style="color:${c}">${x.v == null || x.days != null ? esc(x.lab || '✓') : pc(x.v)}</b></div>`; };
  function card(id, name, P) { const el = document.createElement('div'); el.className = 'ovc'; el.style.setProperty('--ac', ACC[id]); el.tabIndex = 0; el.setAttribute('role', 'button'); el.dataset.k = id;
    const can = !window.__PORTAL || window.__PORTAL.canTab(id), sts = NEED[id].map(ST);
    if (!can || sts.includes('denied')) { el.innerHTML = `<div class="hd"><span class="ic">${ico(id)}</span><h3>${esc(name)}</h3></div><div class="ovl">🔒 You do not have access to this tab</div>`; el.style.cursor = 'default'; el.removeAttribute('role'); return el; }
    if (sts.includes('error')) { el.innerHTML = `<div class="hd"><span class="ic">${ico(id)}</span><h3>${esc(name)}</h3></div><div class="ovl">● Failed to load</div>`; return el; }
    if (sts.some(s => s !== 'ok')) { el.innerHTML = `<div class="hd"><span class="ic">${ico(id)}</span><h3>${esc(name)}</h3></div><div class="ovl">Loading…</div>`; return el; }
    let o; try { o = M[id](P); } catch (e) { console.error('overview', id, e); el.innerHTML = `<div class="hd"><span class="ic">${ico(id)}</span><h3>${esc(name)}</h3></div><div class="ovl">Could not summarise this tab</div>`; return el; }
    last[id] = o;
    const K = (PICK[id] || [0, 1, 2, 3]).map(i => o.kpis[i]).filter(Boolean), [h0, ...rest] = K;
    /* 14 Nov 06:36 (Umair): Production card - FG production and Dispatch side by side above a full-width, shorter chart, in the Overtime While Absent KPI style */
    if (id === 'vendor' && !o.none && o.watch) K.splice(0, K.length, ['Compliance', ...o.kpis[0].slice(1)], o.kpis[4]);   /* 14 Nov 13:01 (Umair): 'Compliance', not 'Supply compliance' */
    if (id === 'production' && !o.none) {   /* 14 Nov 11:09 (Umair): the flipping KPI sits right of the card title, on the same line */
      el.innerHTML = hdrF(id, name, K, o) + `<div class="ovb ovbc"><div class="ovv"><div class="vc"></div></div>${(() => { const b = o.behind; if (!b) return '';
          /* 14 Nov 10:41/10:45 (Umair): more than 2 names run as a ticker, right to left, without stopping (hover pauses it).
             Nobody below 95% -> 'Ahead:' with every shop (or model) and its %, in green */
          const bad = b.list.length > 0, L = bad ? b.list : b.ahead, lab = bad ? 'Behind:' : 'Ahead:';
          if (!L.length) return '';
          const it = L.map(x => `<span style="color:${!bad ? '#1E8C5A' : x.v < 80 ? C.bad : '#9A6B00'}">${esc(x.k)} ${bad && x.v >= 99.5 ? Math.min(99.9, Math.floor(x.v * 10) / 10).toFixed(1) + '%' : pc(x.v)}</span>`).join(' · ');   /* a shop one piece short never shows as 100% */
          const cls = 'ovbh' + (bad ? '' : ' ok'), tt = bad ? 'Short of plan to date' : `All ${b.what} at or above plan to date`;
          if (L.length <= 2) return `<div class="${cls}" title="${tt}"><b>${lab}</b> ${it}</div>`;
          return `<div class="${cls} tk" title="${tt}"><b>${lab}</b><div class="tkw"><div class="tkt" style="animation-duration:${Math.max(10, L.length * 4)}s"><span class="tkg">${it}&nbsp;&nbsp;·&nbsp;&nbsp;</span><span class="tkg" aria-hidden="true">${it}&nbsp;&nbsp;·&nbsp;&nbsp;</span></div></div></div>`; })()}</div>`;
    } else if (id === 'inventory' && !o.none && o.health) {   /* 14 Nov 19:29 (Umair): Inventory - 3-face flipping KPI and raw-material chip in the header, donut + values full width, stock health bar at the foot */
      const F = [o.kpis[0], o.kpis[1], o.kpis[2]], HV = d3.sum(o.health, d => d[1]);
      el.innerHTML = `<div class="hd"><button type="button" class="tg tgrm${exRM ? ' on' : ''}" aria-pressed="${exRM}" aria-label="Exclude raw material" title="${exRM ? 'Raw material, production parts and lubricants are left out - click to include them' : 'Raw material, production parts and lubricants are included - click to leave them out'}"><span>RM</span></button><h3 class="ovh3">${esc(name)}</h3><div class="ovkh"><div class="ovf3" title="${esc(F.map(([l, v, sb]) => l + ' ' + v + (sb ? ' (' + sb + ')' : '')).join(' · '))}">${F.map(([l, v, sb, c], i) =>
          `<div class="ovff f${i}" style="border-left-color:${c || '#051C2C'}"><span>${esc(l)}</span><b${c ? ` style="color:${c}"` : ''}>${esc(v)}</b></div>`).join('')}</div></div>
        ${pill(o.st)}</div>
        <div class="ovb ovbc"><div class="ovv ovvt"><div class="vc"></div></div>
        <div class="ovhb">${o.health.filter(d => d[1] > 0).map(([l, v, c]) => `<div style="flex:${v} 1 0" title="${esc(l)}: ${rs(v)} · ${pc(HV ? v / HV * 100 : 0)} of stock value"><i style="background:${c}">${HV && v / HV > 0.07 ? pc(v / HV * 100) : ''}</i>${HV && v / HV > 0.12 ? `<span>${esc(l)}</span><em>${rs(v)}</em>` : '<span>&nbsp;</span>'}</div>`).join('')}</div></div>`;
    } else if (id === 'projects' && !o.none && o.pj) {   /* 15 Nov 23:03 (Umair): Projects - 4-step KPI, 3-face chart (activities / sub-task burn-up / owners), action ticker */
      o.mini = el2 => pjFlip(el2, o.pj);
      el.innerHTML = hdrF(id, name, o.kh, o) + `<div class="ovb ovbc"><div class="ovv"><div class="vc"></div></div>
        ${o.pj.tk.length ? tickS('Act:', o.pj.tk.map(t => `<span style="color:${C.bad}">${t}</span>`), '', 'Activities behind plan or past due, and Jira not being updated') : tickS('On track:', ['every activity on plan'], 'ok', '')}</div>`;
    } else if (id === 'capacity' && !o.none && o.cp) {   /* 15 Nov 22:17 (Umair): Capacity - 4-step KPI, 3-face chart, action ticker */
      o.mini = el2 => capFlip(el2, o.cp);
      el.innerHTML = hdrF(id, name, o.kh, o) + `<div class="ovb ovbc"><div class="ovv"><div class="vc"></div></div>
        ${o.cp.tk.length ? tickS('Act:', o.cp.tk.map(t => `<span style="color:${C.bad}">${t}</span>`), '', 'What to do about over-loaded parts, machines down and parts with no plan') : tickS('On track:', ['every part within capacity'], 'ok', '')}</div>`;
    } else if (id === 'workforce' && !o.none && o.wf) {   /* 15 Nov 19:19 (Umair): Manpower - 4-step KPI, 3-face chart, act-on ticker */
      o.mini = el2 => wfFlip(el2, o.wf);
      el.innerHTML = hdrF(id, name, o.kh, o) + `<div class="ovb ovbc"><div class="ovv"><div class="vc"></div></div>
        ${o.wf.tk.length ? tickS(o.wf.both ? 'Absent + OT same week:' : 'Act on:', o.wf.tk.map(t => `<span style="color:${C.bad}">${t}</span>`), '', 'People who did overtime in a week they were also absent, and shops with high absence and overtime') : tickS('On track:', ['absence and overtime within limits'], 'ok', '')}</div>`;
    } else if (id === 'savings' && !o.none && o.sv) {   /* 15 Nov 17:42 (Umair): VA/CR - flipping KPI, landing line / shops, overdue ticker */
      const od = o.sv.od;
      o.mini = el2 => savFlip(el2, o.sv);
      el.innerHTML = hdrF(id, name, o.kh, o).replace(`<h3 class="ovh3">${esc(name)}</h3>`, '<h3 class="ovh3 two">VA/CR<br>Activities</h3>') + `<div class="ovb ovbc"><div class="ovv"><div class="vc"></div></div>
        ${od.length ? tickS('Overdue:', od.map(([k, x]) => `<span style="color:${C.bad}" title="${esc(k)} · ${esc(x.shop)} · due ${mon(x.t)} · ${esc(x.st)}">${esc(x.shop)}: ${esc(x.item)} ${kf(x.a)}</span>`), '', 'Ideas not completed whose target month has passed (annual saving)')
          : tickS('On time:', ['no idea is past its target month'], 'ok', '')}</div>`;
    } else if (id === 'cost' && !o.none && o.cv) {   /* 15 Nov 11:29 (Umair): Cost of Production - flipping KPI, flipping chart (conversion by month / shop ranking), cost-up ticker */
      const S = o.cv.shops, up = S.filter(d => d.v > 0), dn = S.filter(d => d.v <= 0).sort((a, b) => a.v - b.v);
      o.mini = el2 => costFlip(el2, o.cv);
      el.innerHTML = hdrF(id, name, o.kh, o).replace(`<h3 class="ovh3">${esc(name)}</h3>`, '<h3 class="ovh3 two">Cost of<br>Production</h3>') + `<div class="ovb ovbc"><div class="ovv"><div class="vc"></div></div>
        ${up.length ? tickS('Cost/part up:', up.map(x => `<span style="color:${x.v > 5 ? C.bad : '#9A6B00'}">${esc(x.k)} +${f0(x.v)}%</span>`), '', `Conversion cost per part, ${mon(o.cv.cur)} vs ${o.cv.prev ? mon(o.cv.prev) : '—'}`)
          : tickS('Cost/part down:', dn.map(x => `<span style="color:#1E8C5A">${esc(x.k)} ${f0(x.v)}%</span>`), 'ok', `Every shop at or below last month's conversion cost per part`)}</div>`;
    } else if (id === 'vendor' && !o.none && o.watch) { /* 14 Nov 12:11 (Umair): Vendor Supply - flipping KPI, watch list (critical vendors / critical parts, alternating) and an under-80% ticker */
      const W = o.watch, row = wRowH;
      const pane = (k, L, empty) => `<div class="wp" data-p="${k}">${L.length ? L.map(row).join('') : `<div class="we">${empty}</div>`}</div>`;
      el.innerHTML = hdrF(id, name, K, o).replace(`<h3 class="ovh3">${esc(name)}</h3>`, '<h3 class="ovh3 two">Supply<br>Watch</h3>') + `<div class="ovb ovbc"><div class="ovwl" data-on="v"><div class="wh" role="tablist"><button type="button" role="tab" data-k="v" title="Weakest vendors against schedule to date">Vendors</button><button type="button" role="tab" data-k="p" title="Vendor parts that run out soonest at this month's plan (tick = next expected delivery)">Parts</button></div>
        <div class="wps">${pane('v', W.vendors, 'No vendor short of schedule')}${pane('p', W.parts, 'No vendor part in use this month')}</div></div>
        ${o.tick.bad.length ? tickS('Under 80%:', o.tick.bad.map(x => `<span style="color:${C.bad}">${esc(x.k)} ${pc(x.v)}</span>`), '', 'Vendors under 80% of schedule to date')
          : tickS('All vendors 80%+:', o.tick.all.map(x => `<span style="color:${okc(x.v)}">${esc(x.k)} ${pc(x.v)}</span>`), 'ok', 'Every scheduled vendor at 80%+ of schedule to date')}</div>`;
      /* 14 Nov 14:05 (Umair): hovering a part opens the vendor panel (vendors + in-house production, MTD vs month plan) with its run-out beside it */
      el.querySelectorAll('.wp[data-p="p"] .wr[data-c]').forEach(r => { r.addEventListener('mousemove', ev => vpOv(ev, r.dataset.c, (W.parts.find(x => x.code === r.dataset.c) || {}).k)); r.addEventListener('mouseleave', vpOvH); });
      const wl = el.querySelector('.ovwl'); wl.querySelectorAll('.wh button').forEach(bt => bt.addEventListener('click', ev => { ev.stopPropagation(); wl.dataset.on = bt.dataset.k; wl.dataset.hold = '1'; }));
    } else
    el.innerHTML = `<div class="hd"><span class="ic">${ico(id)}</span><h3>${esc(name)}</h3>${o.none ? '' : pill(o.st)}</div>${o.none ? `<div class="ovl">${esc(o.none)}</div>` : `<div class="ovb"><div class="ovk">
      <div class="hero" title="${esc(h0[2] || '')}"><div class="l">${esc(h0[0])}</div><div class="v"${h0[3] ? ` style="color:${h0[3]}"` : ''}>${esc(h0[1])}</div><div class="s">${esc(h0[2] || '')}</div></div>
      <div class="rows">${rest.map(([l, v, sb, c]) => `<div class="r" title="${esc(l + (sb ? ' · ' + sb : ''))}"><span>${esc(SHORT[l] || l)}</span><b${c ? ` style="color:${c}"` : ''}>${esc(v)}</b></div>`).join('')}</div></div>
      <div class="ovv"><div class="vt">${id === 'inventory' ? `<button type="button" class="tg${exRM ? ' on' : ''}" aria-pressed="${exRM}" title="Leave out Raw Material, Production parts and Lubricants">Exclude Raw Material</button>` : ''}${id === 'inventory' ? '' : `<span class="vtt" title="${esc(o.vt || '')}">${esc(o.vt || '')}</span>`}</div><div class="vc"></div></div></div>`}`;
    const tg = el.querySelector('.tg'); if (tg) { tg.addEventListener('click', ev => { ev.stopPropagation(); exRM = !exRM; render(); }); tg.addEventListener('keydown', ev => ev.stopPropagation()); }
    el.title = (o.title ? o.title + ' · ' : '') + 'click for details';
    el.addEventListener('click', () => openD(id, name)); el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openD(id, name); } });
    return el; }
  /* 13 Nov 19:39 (Umair): shop compliance strip beside the page title - one bar per shop, finished-goods production month to date
     against plan to date (as the Production card), greener as compliance rises above 100%, yellow then red below it.
     Shops in the Production tab's order; click a bar to filter the dashboard to that shop, click it again to clear. */
  /* 14 Nov 01:01 (Umair): heat-map greens - from 100% the green gets steadily darker as compliance rises (100% pale, 300%+ darkest) */
  const stRed = d3.scaleLinear([80, 90, 100], ['#D0312D', '#E8A33A', '#C7E9C0']).clamp(true);
  const stCol = v => v < 100 ? stRed(v) : d3.interpolateGreens(0.3 + 0.7 * Math.min(1, Math.log(v / 100) / Math.log(3)));
  function shopStrip(s, P) {
    const box = s.querySelector('.ovhd > div:first-child'); if (!box) return; let st = box.querySelector('.ovst');
    if (!st) { st = document.createElement('div'); st.className = 'ovst'; st.setAttribute('aria-label', 'Production compliance by shop'); box.appendChild(st); }
    if (!st.__hv) { st.__hv = 1; st.addEventListener('mouseleave', () => { clearTimeout(hvT); hvSh = ''; st.querySelectorAll('button.hv').forEach(x => x.classList.remove('hv')); if (hvLock) { hvBase = undefined; return; } hvT = setTimeout(() => { if (hvBase === undefined) { const sm_ = box.querySelector('.ovsum'); if (sm_ && sm_.__base) sm_.__base(); return; }
      const b = hvBase; hvBase = undefined; if ((SHf(window.__P()) || 'All') !== b) dash.setParams({ shop: b, sf: 0, pf: 0 }); else { const sm_ = s.querySelector('.ovsum'); if (sm_ && sm_.__base) sm_.__base(); } }, 160); }); }
    const pa_ = D('atlas_parts'), pd_ = D('atlas_parts_daily'); if (!pa_ || !pd_) { st.replaceChildren(); return; }
    const end = P.actEnd, pEnd = window.__planTo ? window.__planTo({ day: 0 }, end) : end, parts = new Map(pa_.filter(r => r.type === 'Finished').map(r => [String(r.code), r]));
    const rows = pd_.filter(r => r.date >= P.start && r.date <= end && parts.has(String(r.code)));
    const by = d3.rollups(rows, v => ({ p: d3.sum(v.filter(r => r.date <= pEnd), r => +r.prod_plan || 0), a: d3.sum(v, r => +r.prod_actual || 0) }), r => parts.get(String(r.code)).shop || '?')
      .filter(([sh, o]) => o.p > 0 && sh !== '?').map(([sh, o]) => ({ sh, ...o, v: o.a / o.p * 100 }))
      .sort((x, y) => { const SEQ = ['Clutch', 'Drum Gear', 'Ignition Coil', 'Hubs', 'Carb Child Parts', 'Carburetor', 'CIF Machining', 'Bridge Fork Top', 'HPDC / Die Cast', 'Piston', 'Polymer'], ix = z => { const i = SEQ.indexOf(z.sh); return i < 0 ? SEQ.length : i; }; return ix(x) - ix(y) || x.sh.localeCompare(y.sh); });   /* 13 Nov 19:44 (Umair): same shop order as Production Plan Vs Actual - By Shop */
    const cur = SHf(P); if (hvLock && cur !== hvLock) hvLock = '';   /* shop changed elsewhere (Clear filter, Shop list): unlock */
    st.style.width = (by.length * 13 + 1) + 'px';   /* room for one bar at 1.5x, split both sides */
    /* 13 Nov 19:42 (Umair): thin bars, no names or percentages on them (hover shows both) */
    /* 14 Nov 05:29 (Umair): the bars are kept and updated in place when the dashboard redraws. Before, a hover filter redrew the strip with new
       buttons, so the hovered bar grew, snapped back and grew a second time. Listeners read the bar's current data from b.__o. */
    const old = new Map([...st.children].map(b => [b.__sh, b]));
    const bars = by.map(o => { let b = old.get(o.sh); const c = stCol(o.v);
      if (!b) { b = document.createElement('button'); b.type = 'button'; b.__sh = o.sh; const O = () => b.__o;
        b.addEventListener('mousemove', ev => tip.show(ev, [O().sh, `${kf(O().p)} / ${kf(O().a)}`])   /* 14 Nov 05:27 (Umair): bar tooltip shows the shop name, then plan / actual */);
        /* 14 Nov 01:17 (Umair): hovering shows the shop and its % in the label on the right; only a click filters */
        /* 14 Nov 05:12 (Umair): hovering a bar applies that shop's filter to the whole dashboard; leaving the strip puts back the shop that was
           selected before; a click keeps the shop (click the kept shop again to clear). A short delay stops a quick sweep across the bars from redrawing every shop. */
        /* 14 Nov 05:24 (Umair): a click locks that shop - hovering other bars then changes nothing until the Clear filter button (or the Shop list) changes the shop */
        /* 14 Nov 05:41 (Umair): the bar grows first (0.15 s); the filter, and with it the ring, comes in only once it is fully grown (0.2 s) */
        b.addEventListener('mouseenter', () => { hvSh = O().sh; st.querySelectorAll('button.hv').forEach(x => x !== b && x.classList.remove('hv')); b.classList.add('hv'); if (hvLock) return;
          clearTimeout(hvT); hvT = setTimeout(() => { const sm_ = box.querySelector('.ovsum'); if (sm_ && sm_.__show) sm_.__show(O().sh, O().v);   /* 14 Nov 05:44 (Umair): the name on the right changes together with the ring */
            if (hvBase === undefined) hvBase = SHf(window.__P()) || 'All'; if (SHf(window.__P()) !== O().sh) dash.setParams({ shop: O().sh, sf: 0, pf: 0 }); }, 200); });
        b.addEventListener('mouseleave', () => { tip.hide(); if (hvSh === O().sh) hvSh = ''; b.classList.remove('hv'); });
        b.addEventListener('click', ev => { ev.stopPropagation(); tip.hide(); clearTimeout(hvT); hvLock = O().sh; hvBase = undefined; if (SHf(window.__P()) !== O().sh) dash.setParams({ shop: O().sh, sf: 0, pf: 0 }); else render(); }); }
      const nw = !old.has(o.sh); b.__o = o; b.className = [cur === o.sh ? 'on' : '', hvSh === o.sh ? 'hv' : '', nw && hvSh === o.sh ? 'nt' : ''].filter(Boolean).join(' ');
      if (b.classList.contains('nt')) requestAnimationFrame(() => requestAnimationFrame(() => b.classList.remove('nt'))); b.style.background = c; b.setAttribute('aria-label', `${o.sh} ${d3.format('.0f')(o.v)}%`);
      return b; });
    if (bars.length !== st.children.length || bars.some((b, k) => st.children[k] !== b)) st.replaceChildren(...bars);
    /* 13 Nov 20:05 (Umair): 'All Shops' | overall compliance, in the page title's serif, right of the bars */
    let sm = box.querySelector('.ovsum'); if (!sm) { sm = document.createElement('div'); sm.className = 'ovsum'; box.appendChild(sm); }
    const sel = cur && by.find(o => o.sh === cur), tp = sel ? sel.p : d3.sum(by, o => o.p), ta = sel ? sel.a : d3.sum(by, o => o.a), tv = tp ? ta / tp * 100 : null;
    const pf = v => v == null ? '—' : (v >= 1000 ? d3.format(',.0f')(v) : d3.format('.0f')(v)) + '%';
    const show = (nm, v) => { sm.innerHTML = `<span class="t">${esc(nm)}</span><span class="ln"></span><span class="t">${pf(v)}</span>`; };
    sm.__show = show; sm.__base = () => by.length ? show(sel ? cur : 'All Shops', tv) : (sm.innerHTML = '');
    sm.innerHTML = by.length ? `<span class="t">${esc(sel ? cur : 'All Shops')}</span><span class="ln"></span><span class="t">${tv == null ? '—' : (tv >= 1000 ? d3.format(',.0f')(tv) : d3.format('.0f')(tv)) + '%'}</span>` : '';
    sm.title = tv == null ? '' : `${sel ? cur : 'All shops'}: finished goods ${kf(ta)} made of ${kf(tp)} planned to date (${d3.format('.1f')(tv)}%)`;
  }
  function render() { const s = sec(); if (!s || window.__page !== 'summary') return; const P = window.__P(); last = {};
    let g = s.querySelector('.ovg'); if (!g) { s.innerHTML = '<div class="ovhd"><div><h2>Overview</h2></div><div class="lgd"></div></div><div class="ovg"></div><p class="ovn"></p>'; g = s.querySelector('.ovg'); }
    /* 16 Nov 17:31 (Umair, option 4): the page title is the page switcher. "Overview ▾" opens the page list; the top bar then shows only
       "Operations Dashboard" on this page (filters.js hides "› Overview" there). To undo: set window.__OVTITLEMENU = false in filters.js. */
    { const h2 = s.querySelector('.ovhd h2');
      /* 16 Nov 17:34 (Umair): back to option 2 - plain 'Overview' title; the page list opens from the grid button. Set window.__OVTITLEMENU = true for option 4. */
      if (window.__OVTITLEMENU !== true) h2.textContent = 'Overview';
      else if (!h2.__menu) { h2.__menu = 1; h2.classList.add('ovpg'); h2.innerHTML = 'Overview<span class="car" aria-hidden="true">▾</span>'; h2.tabIndex = 0; h2.setAttribute('role', 'button');
        h2.setAttribute('aria-label', 'Overview. Choose another page'); h2.title = 'Choose another page';
        const N = () => window.__navMenu; h2.addEventListener('click', () => N() && N().hold(true)); h2.addEventListener('mouseenter', () => N() && N().hold(true));
        h2.addEventListener('mouseleave', () => N() && N().hold(false)); h2.addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && N()) { ev.preventDefault(); N().toggle(); } }); } }   // 14 Nov 00:58 (Umair): no shop-name chip; the strip and its label already show the shop   // 16 Nov 16:46 (Umair): title is just 'Overview'
    try { shopStrip(s, P); } catch (e) { console.error('ovstrip', e); }
    s.querySelector('.ovhd .lgd').innerHTML = ['good', 'watch', 'bad'].map(pill).join(''); s.querySelector('.ovhd .lgd').title = 'Production and Vendor Supply on track at 95%+, watch from 80%. Absenteeism on track up to 5%, watch to 8%. Inventory on track with excess under 10% of value. Projects watch above 5% overdue. VA/CR on track once half the annual saving is achieved.';
    /* 11 Nov 23:43 (Umair): fit the page to the window height so no scroll bar shows */
    const root = document.getElementById('ael'); if (root) root.classList.add('ovfit');
    if (window.innerWidth > 1000) { const top = g.getBoundingClientRect().top + window.scrollY, nh = 10;
      let hh = Math.max(460, Math.floor(window.innerHeight - top - nh - 6)); g.style.height = hh + 'px';
      const over = document.documentElement.scrollHeight - window.innerHeight; if (over > 0 && hh - over >= 460) g.style.height = (hh - over) + 'px'; } else g.style.height = '';
    g.replaceChildren(...CARDS.map(([id, n]) => card(id, n, P)));
    g.querySelectorAll('.ovc').forEach(el => { const o = last[el.dataset.k], vc = el.querySelector('.vc'); if (o && vc && o.mini) try { o.mini(vc); } catch (e) { console.error(e); } });
    }
  /* detail window */
  function closeD() { const m = document.querySelector('.ovm'); if (m) { const ae = document.activeElement; if (ae && m.contains(ae)) { m.classList.add('closing'); ae.blur(); } if (m.isConnected) m.remove(); } tip.hide(); document.removeEventListener('keydown', escK); }
  const escK = ev => { if (ev.key === 'Escape') closeD(); };
  function openD(id, name, F) { let o = last[id]; if (!o || o.none) return; const FCf = FC[id] || [], FW = FCf.length > 0;
    /* 17 Nov 09:51 (Umair): opening a filterable window from its card carries the main Shop / Model / Part filter into it; the window's own Clear filter clears only the window (F._own: the window ignores the main filter from then on) */
    if (FW && F === undefined) { const P0 = window.__P(), pc = P0.pf && FCf.includes('part') && id !== 'savings' ? String(P0.pf) : ''; F = { shop: SHf(P0), model: P0.model && P0.model !== 'All' && FCf.includes('model') ? P0.model : '', part: pc };
      if (pc) { const r = [...(D('atlas_parts') || []), ...(D('atlas_child_stock') || []), ...(D('atlas_bom') || [])].find(x => String(x.code) === pc); F.partName = r && r.part ? r.part : pc; } }
    F = typeof F === 'string' ? { vf: F } : (F || {}); if (FW) F._own = 1; const VF = F.vf || '', FON = !!(VF || F.shop || F.model || F.part);
    if (FW) { try { const P1 = window.__P(); o = M[id](id === 'production' || id === 'vendor' ? P1 : { ...P1, shop: F.shop || 'All' }, F); } catch (e) { console.error(e); o = last[id]; } }
    /* 17 Nov 10:26 (Umair): every Overview window drops its date line and footnote; the line under the title only shows an applied window filter */
    o = { ...o, foot: '', title: '' }; /* 19 Nov 11:36 (Umair): no 'shop: … · model: …' line under the window title; the red Clear filter button shows a filter is on */
    if (o.none) { const msg = o.none; o = { title: o.title, kpis: [], detail: [{ t: 'Nothing to show', draw: el => none(el, msg) }], foot: '' }; }
    const sy = (document.querySelector('.ovm .bx') || {}).scrollTop || 0, ly = [...document.querySelectorAll('.ovm .pc .ovwd')].map(x => x.scrollTop); closeD();
    const m = document.createElement('div'); m.className = 'ovm'; m.style.setProperty('--ac', ACC[id]); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', name + ' details');
    m.innerHTML = `<div class="bx"><div class="bh"><div><h2>${esc(name)}${pill(o.st)}</h2>${o.title ? `<div class="bs">${esc(o.title)}</div>` : ''}</div><div class="br">${id === 'inventory' ? `<button type="button" class="ivatd${window.__ATDMC ? ' on' : ''}" aria-pressed="${!!window.__ATDMC}" title="${window.__ATDMC ? 'ATDMC die making (SAP plant MDP) stock is included. Click to leave it out' : 'ATDMC die making (SAP plant MDP) stock is left out. Click to add it to Raw Material, Consumables, Tools and Spares'}">Include ATDMC Stock</button>` : ''}${FW ? `<button type="button" class="go">${esc(name)} Details</button>` : ''}${FON ? `<button class="fx" type="button" title="Show everything again">Clear filter</button>` : ''}${FW ? `<span class="fw"><button class="ff${F.shop || F.model || F.part ? ' on' : ''}" type="button" aria-label="Filter this window" title="Filter by shop, model or part" aria-expanded="false"><svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M1.5 2.5h13l-5 6v4.5l-3 1.5v-6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></button><div class="fpn" hidden></div></span>` : ''}<button class="x" type="button" aria-label="Close" title="Close">×</button></div></div>
      <div class="bk">${o.kpis.map(([l, v, s, c, b]) => `<div class="k"${b || c ? ` style="border-left-color:${b || c}"` : ''}><div class="l">${esc(l)}</div><div class="v"${c ? ` style="color:${c}"` : ''}>${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join('')}</div>
      <div class="bg">${o.detail.map((d, i) => `<div class="pn"><h4>${esc(d.t)}</h4>${d.lg ? `<div class="lg">${lg(d.lg)}</div>` : ''}<div class="pc" data-i="${i}"></div></div>`).join('')}</div>
      ${FW ? (o.foot ? `<div class="ft"><span>${esc(o.foot)}</span></div>` : '') : `<div class="ft"><span>${esc(o.foot || '')}</span><button type="button" class="go">Open ${esc(name)} tab</button></div>`}</div>`;   /* 17 Nov 10:11 (Umair): Production's button reads 'Production Details' and sits top right, left of Clear filter */
    (document.getElementById('ael') || document.body).appendChild(m);
    m.addEventListener('click', ev => { if (ev.target === m) closeD(); }); m.querySelector('.x').addEventListener('click', closeD);
    { const ab = m.querySelector('.br .ivatd'); if (ab) ab.addEventListener('click', ev => { ev.stopPropagation(); window.__ATDMC = !window.__ATDMC; window.__syncAtd && window.__syncAtd(); try { render(); } catch (e) {} openD(id, name, { ...F }); }); }
    m.querySelector('.go').addEventListener('click', () => { closeD(); const t = document.querySelector(`#tabs .tab[data-p="${id}"]`); if (t) t.click(); });
    document.addEventListener('keydown', escK); m.querySelector('.x').focus();
    /* 18 Nov 17:19 (Umair): a clickable shop in a window chart filters the whole window (part is dropped as it belongs to a shop); the same shop again clears it */
    window.__ovPick = (k, v) => { if (!m.isConnected || m.classList.contains('closing')) return; const G = { ...F }; delete G._open; G[k] = String(G[k] || '') === String(v) ? '' : v; if (k === 'shop') { G.part = ''; G.partName = ''; } openD(id, name, G); };
    m.querySelectorAll('.pc').forEach(el => { try { o.detail[+el.dataset.i].draw(el); } catch (e) { console.error(e); none(el, 'Could not draw this chart'); } });
    if (id === 'vendor') {   /* 16 Nov (Umair): click a vendor to filter the whole window to it; click it again, or Clear filter, for all vendors */
      m.querySelectorAll('.wr[data-v]').forEach(r => { r.classList.add('vpick'); r.title = (r.title ? r.title + ' · ' : '') + (r.dataset.v === VF ? 'Click to show all vendors' : 'Click to show only this vendor');
        r.addEventListener('click', () => openD(id, name, { ...F, vf: r.dataset.v === VF ? '' : r.dataset.v })); }); }
    if (FW) {
      const fx = m.querySelector('.fx'); if (fx) { fx.addEventListener('click', () => openD(id, name, {})); }
      /* filter panel: shop, model and part, applied as soon as one is picked */
      const ff = m.querySelector('.ff'), fp = m.querySelector('.fpn');
      if (ff && fp) { const P0 = window.__P(), ms0 = P0.start;
        const nmP = new Map([...(D('atlas_parts') || []), ...(D('atlas_child_stock') || []), ...(D('atlas_stock_critical') || []), ...(D('atlas_bom') || [])].map(r => [String(r.code), r.part]));
        let base;   /* rows {code, name, shop, mods} the lists are built from */
        const mk = (code, name, shop, mods) => ({ code: code == null ? '' : String(code), name: name || (code == null ? '' : String(code)), shop, mods: mods || new Set() });
        if (id === 'production') { const inM = new Set(D('atlas_parts_daily').filter(r => r.date >= ms0 && r.date <= P0.actEnd && (+r.prod_plan || +r.prod_actual || +r.disp_plan || +r.disp_actual)).map(r => String(r.code)));
          base = (D('atlas_parts') || []).filter(r => inM.has(String(r.code)) && (r.type === 'Finished' || r.type === 'In-house')).map(r => mk(r.code, nmP.get(String(r.code)) || r.part, r.shop, new Set(pModsOf(r)))); }
        else if (id === 'vendor') { const MOx = vModsOf(); base = D('atlas_vendor_supply').filter(r => r.date >= ms0 && r.date <= P0.actEnd).map(r => mk(r.code, nmP.get(String(r.code)), r.shop, MOx.get(String(r.code)))); }
        else if (id === 'inventory') base = SST().filter(r => r.code).map(r => mk(r.code, r.part, r.shop, new Set(pModsOf({ models: r.models }))));
        else if (id === 'savings') base = D('cr_ideas').map(r => mk(r.part, r.part, r.dash_shop || r.shop, new Set([r.model].filter(Boolean))));
        else if (id === 'workforce') base = D('sp_attendance').map(r => mk('', '', r.shop));
        else if (id === 'cost') base = D('cogm').map(r => mk('', '', r.shop));
        else if (id === 'capacity') base = [mk('', '', 'Clutch')];
        else base = (D('atlas_parts') || []).map(r => mk('', '', r.shop));
        const shops = [...new Set([...base.map(r => r.shop), F.shop].filter(x => x && x !== 'carb' && x !== '—' && x !== '?'))].sort();
        const models = id === 'production' || id === 'vendor' ? [...new Set((D('atlas_parts') || []).flatMap(pModsOf))].sort() : [...new Set(base.flatMap(r => [...r.mods]))].sort();
        const pm = new Map(); base.forEach(r => { if (r.code && (!F.shop || r.shop === F.shop) && (!F.model || r.mods.has(F.model)) && !pm.has(r.code)) pm.set(r.code, r.name); });
        const partsL = [...pm].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
        const opt = (L, v, all) => `<option value="">${all}</option>` + L.map(x => { const [k, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(k)}"${String(v || '') === String(k) ? ' selected' : ''}>${esc(t)}</option>`; }).join('');
        fp.innerHTML = `<label>Shop<select data-f="shop">${opt(shops, F.shop, 'All shops')}</select></label>${FCf.includes('model') ? `<label>Model<select data-f="model">${opt(models, F.model, 'All models')}</select></label>` : ''}
          ${FCf.includes('part') ? `<label>Part<input data-f="part" list="vfpl" placeholder="All parts (${partsL.length}) · type to search" value="${esc(F.part ? (F.partName || nmP.get(String(F.part)) || F.part) : '')}"><datalist id="vfpl">${partsL.map(([c, t]) => `<option value="${esc(t)}">${c === t ? '' : esc(c)}</option>`).join('')}</datalist></label>` : ''}
          <div class="fpb"><button type="button" class="fpc">Clear these</button><button type="button" class="fpd">Done</button></div>`;
        const show = v => { fp.hidden = !v; ff.setAttribute('aria-expanded', String(v)); };
        ff.addEventListener('click', ev => { ev.stopPropagation(); show(fp.hidden); }); fp.addEventListener('click', ev => ev.stopPropagation()); m.addEventListener('click', () => show(false));
        const go = G => { if (!m.isConnected || m.classList.contains('closing')) return; openD(id, name, { ...G, _open: 1 }); };   /* ignore a late change event after the window has closed */
        fp.querySelectorAll('select').forEach(sl => sl.addEventListener('change', () => { const G = { ...F, [sl.dataset.f]: sl.value }; if (sl.dataset.f !== 'part') { G.part = ''; G.partName = ''; } go(G); }));
        const pi = fp.querySelector('input'); if (pi) pi.addEventListener('change', () => { const t = pi.value.trim(); if (!t) return go({ ...F, part: '', partName: '' }); const hit = partsL.find(([c, n]) => n === t || c === t) || partsL.find(([c, n]) => String(n).toLowerCase().includes(t.toLowerCase())); if (hit) go({ ...F, part: hit[0], partName: hit[1] }); });
        fp.querySelector('.fpc').addEventListener('click', () => go(id === 'vendor' ? { vf: F.vf } : {})); fp.querySelector('.fpd').addEventListener('click', () => show(false));
        if (F._open) show(true); }
      if (sy) m.querySelector('.bx').scrollTop = sy; m.querySelectorAll('.pc .ovwd').forEach((x, i) => { if (ly[i] != null && i === 0) x.scrollTop = ly[i]; });
      if (VF) { const sel = m.querySelector('.wr.sel'); if (sel && !ly.length) sel.scrollIntoView({ block: 'nearest' }); } } }
  { const tb = document.getElementById('tabs'); if (tb) tb.addEventListener('click', ev => { const b = ev.target.closest('.tab'); if (b && b.dataset.p !== 'summary') { const r_ = document.getElementById('ael'); if (r_) r_.classList.remove('ovfit'); } }, true); }
  window.__ovRender = render;
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page !== 'summary') { const rt_ = document.getElementById('ael'); if (rt_) rt_.classList.remove('ovfit'); } if (window.__page === 'summary' && !wasOn) exRM = true; wasOn = window.__page === 'summary'; if (window.__page === 'summary') { try { render(); } catch (e) { console.error(e); } } return r; };
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (window.__page === 'summary') render(); }, 200); });
  try { if (window.__page === 'summary') render(); } catch (e) {}
})();
