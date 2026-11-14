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
  const CARDS = [['production', 'Production'], ['vendor', 'Vendor Supply'], ['inventory', 'Inventory'], ['workforce', 'Manpower'],
    ['cost', 'Cost of Production'], ['capacity', 'Capacity'], ['projects', 'Projects'], ['savings', 'VA/CR Activities']];
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
.ovm .ft button{border:1px solid #051C2C;background:#051C2C;color:#fff;border-radius:4px;padding:5px 12px;font-size:12px;cursor:pointer}
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
.ael #summary .ovwl .we{font-size:12px;color:#1E8C5A;text-align:center}
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
    const y = d3.scaleLinear().domain([0, (d3.max(cats, tot) || 1) * 1.06]).nice().range([h - mb, mt]), x = d3.scaleBand().domain(d3.range(cats.length)).range([ml, w - 4]).padding(cats.length > 12 ? 0.18 : 0.14);
    const x1 = d3.scaleBand().domain(S.map(s => s.name)).range([0, x.bandwidth()]).padding(0.05);
    axisY(svg, y, ml, w - 4, o.yFmt || kf, o.h && o.h > 200 ? 5 : 3);
    cats.forEach((c, i) => { let y0 = 0; const L = [o.cFmt ? o.cFmt(c) : c, ...S.map(s => `${s.name}: ${(o.fmt || kf)(get(c, s) || 0)}`)];
      S.forEach(s => { const v = Math.max(0, get(c, s) || 0); const bx = o.stack ? x(i) : x(i) + x1(s.name), bw = o.stack ? x.bandwidth() : x1.bandwidth();
        svg.append('rect').attr('x', bx).attr('y', y(y0 + v)).attr('width', bw).attr('height', Math.max(0, y(y0) - y(y0 + v))).attr('fill', s.color)
          .on('mousemove', ev => tip.show(ev, L)).on('mouseleave', tip.hide); if (o.stack) y0 += v; });
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
      svg.append('text').attr('x', lw - 6).attr('y', y + bh / 2 + 3.5).attr('text-anchor', 'end').attr('font-size', o.fs || 11).attr('fill', '#051C2C').text(d.label.length > (o.lc || 20) ? d.label.slice(0, (o.lc || 20) - 1) + '…' : d.label).append('title').text(d.label);
      if (d.plan != null) svg.append('rect').attr('x', lw).attr('y', y).attr('width', Math.max(0, x(d.plan) - lw)).attr('height', bh).attr('fill', '#E6E9EC');
      svg.append('rect').attr('x', lw).attr('y', y + (d.plan != null ? bh * 0.2 : 0)).attr('width', Math.max(0.5, x(Math.min(mx * 1.05, Math.max(0, d.v || 0))) - lw)).attr('height', d.plan != null ? bh * 0.6 : bh).attr('fill', d.color || C.navy)
        .on('mousemove', ev => tip.show(ev, d.tip || [d.label, (o.fmt || kf)(d.v)])).on('mouseleave', tip.hide);
      svg.append('text').attr('x', Math.min(w - 44, x(Math.min(mx * 1.05, Math.max(d.v || 0, d.plan || 0))) + 4)).attr('y', y + bh / 2 + 3.5).attr('font-size', 10.5).attr('font-weight', 600).attr('fill', '#33414B').text(d.lab ?? (o.fmt || kf)(d.v)); });
    if (o.ref != null) svg.append('line').attr('x1', x(o.ref)).attr('x2', x(o.ref)).attr('y1', 0).attr('y2', h - 14).attr('stroke', '#8A949E').attr('stroke-dasharray', '3 3');
    svg.append('line').attr('x1', lw).attr('x2', lw).attr('y1', 0).attr('y2', h - 14).attr('stroke', '#051C2C'); }
  /* donut: items [{label, v, color}] */
  function donutC(el, items, o = {}) { items = items.filter(d => d.v > 0); if (!items.length) return none(el, 'No data'); const { svg, w, h } = mk(el, o.h);
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
  M.production = P => { const ms = P.start, end = P.actEnd, pEnd = window.__planTo ? window.__planTo({ day: 0 }, end) : end;
    const SH = SHf(P), parts = new Map(D('atlas_parts').filter(r => inSh(SH, r, 'shop', 'shops')).map(r => [String(r.code), r])), rows = D('atlas_parts_daily').filter(r => r.date >= ms && r.date <= end && parts.has(String(r.code)));
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
    const ihShop = agg(ih, r => (parts.get(String(r.code)) || {}).shop || '?').filter(([, o]) => o.p).map(([s, o]) => ({ label: s, v: o.a / o.p * 100, tip: [s, `In-house parts ${pc(o.a / o.p * 100)}`, `${kf(o.a)} of ${kf(o.p)} plan`], color: col(o.a / o.p * 100) || C.navy })).sort((a, b) => a.v - b.v);
    /* 14 Nov 10:34 (Umair): shops short of plan to date, named at the foot of the card (filtered to one shop: its models instead) */
    const all_ = (SH ? byModel : byShop).filter(([k, o]) => o.p > 0 && k !== '?' && k !== '—').map(([k, o]) => ({ k, v: o.a / o.p * 100, a: o.a, p: o.p }));
    const bh = all_.filter(x => x.a < x.p).sort((a, b) => a.v - b.v), ah = all_.filter(x => x.a >= x.p).sort((a, b) => b.v - a.v);   /* 14 Nov 10:59 (Umair): behind = even one piece short of plan to date */   /* 14 Nov 10:45: none behind - list everyone as 'Ahead' */
    return { title: `Finished goods ${mon(P.month)} to ${dlab(end)}`, st: band(pp ? pa / pp * 100 : null, 95, 80), behind: { what: SH ? 'models' : 'shops', list: bh, ahead: ah },
      kpis: [['FG production', pc(pp ? pa / pp * 100 : null), `${kf(pa)} of ${kf(pp)} plan`, col(pp ? pa / pp * 100 : null)], ['Dispatch', pc(dp ? da / dp * 100 : null), `${kf(da)} of ${kf(dp)} plan`, col(dp ? da / dp * 100 : null)],
        ['In-house parts', pc(ip ? ia / ip * 100 : null), `${kf(ia)} of ${kf(ip)} plan`, col(ip ? ia / ip * 100 : null)], ['Month plan (FG)', kf(mp), `${pc(mp ? pa / mp * 100 : null)} done so far`], ['Short to plan', kf(Math.max(0, pp - pa)), 'plan less actual']],
      vt: '', /* 14 Nov 06:32 (Umair): no chart title on the Production card */ mini: el => lineC(el, ds, [{ name: 'Plan', color: '#B9C1C9', values: cP, dash: '4 3' }, { name: 'Actual', color: C.navy, values: cA }], { xFmt: d => +d.slice(8), ml: 34 }),
      detail: [
        { t: 'Cumulative production and dispatch (finished goods)', lg: [['Production plan', '#B9C1C9'], ['Production', C.navy], ['Dispatch', C.cyan]], draw: el => lineC(el, ds, [{ name: 'Production plan', color: '#B9C1C9', values: cP, dash: '4 3' }, { name: 'Production', color: C.navy, values: cA }, { name: 'Dispatch', color: C.cyan, values: cD }], { h: 260, xFmt: dlab }) },
        { t: 'Production compliance by shop (finished goods)', draw: el => hbarC(el, byShop.map(([s, o]) => ({ label: s, v: o.p ? o.a / o.p * 100 : 0, lab: pc(o.p ? o.a / o.p * 100 : null), color: col(o.p ? o.a / o.p * 100 : null) || C.navy, tip: [s, `Production ${pc(o.p ? o.a / o.p * 100 : null)}`, `${kf(o.a)} of ${kf(o.p)} plan`, `Dispatch ${kf(o.da)} of ${kf(o.dp)}`] })), { fmt: pc, ref: 100, h: 260, lw: 130, cap: 250 }) },
        { t: 'Production and dispatch by model, plan vs actual', lg: [['Prod plan', '#C9D1D9'], ['Produced', C.navy], ['Disp plan', '#AAE6F0'], ['Dispatched', C.cyan]], draw: el => colC(el, byModel.map(d => d[0]), [{ name: 'Prod plan', color: '#C9D1D9' }, { name: 'Produced', color: C.navy }, { name: 'Disp plan', color: '#AAE6F0' }, { name: 'Dispatched', color: C.cyan }], (c, s) => { const o = new Map(byModel).get(c); return { 'Prod plan': o.p, Produced: o.a, 'Disp plan': o.dp, Dispatched: o.da }[s.name]; }, { h: 260 }) },
        { t: 'In-house parts compliance by shop', draw: el => hbarC(el, ihShop, { fmt: pc, ref: 100, h: 260, lw: 130, cap: 250 }) }],
      foot: 'Atlas plan vs actual. Plan counts to yesterday while the month is running; actuals to the latest Atlas day. Bars are cut at 250%; the label shows the true figure.' }; };

  M.vendor = P => { const ms = P.start, end = P.actEnd, pEnd = window.__planTo ? window.__planTo({ day: 0 }, end) : end;
    const SH = SHf(P), rows = D('atlas_vendor_supply').filter(r => r.date >= ms && r.date <= end && inSh(SH, r, 'shop'));
    const sc = d3.sum(rows.filter(r => r.date <= pEnd), r => +r.scheduled || 0), rc = d3.sum(rows, r => +r.received || 0);
    if (SH && !sc && !rc) return { title: SH, kpis: [], none: `No vendor schedule or receipts for ${SH} this month` };
    const byV = d3.rollups(rows, v => ({ s: d3.sum(v.filter(r => r.date <= pEnd), r => +r.scheduled || 0), r: d3.sum(v, r => +r.received || 0), n: new Set(v.map(r => r.code)).size }), r => r.vendor).filter(([, o]) => o.s > 0);
    const low = byV.filter(([, o]) => o.r / o.s < 0.8), short = d3.sum(rows.filter(r => r.date <= pEnd), r => 0) + d3.sum(byV, ([, o]) => Math.max(0, o.s - o.r));
    const ds = days(ms, end), byD = d3.rollup(rows, v => ({ s: d3.sum(v, r => +r.scheduled || 0), r: d3.sum(v, r => +r.received || 0) }), r => r.date);
    const byS = d3.rollups(rows, v => ({ s: d3.sum(v.filter(r => r.date <= pEnd), r => +r.scheduled || 0), r: d3.sum(v, r => +r.received || 0) }), r => r.shop || '—').filter(([, o]) => o.s > 0);
    const c = sc ? rc / sc * 100 : null, col = v => v < 70 ? C.bad : v < 85 ? C.warn : C.navy;
    let cs = 0, cr = 0; const cS = ds.map(d => (cs += d <= pEnd ? (byD.get(d) || {}).s || 0 : 0)), cR = ds.map(d => (cr += (byD.get(d) || {}).r || 0));
    /* 14 Nov 12:11 (Umair): watch list - the 4 weakest vendors against schedule to date, and the 4 critical vendor-supplied parts lowest against safety stock (shop filter applies) */
    const sn = v => String(v).replace(/\s*\((PVT|PRIVATE)\b.*$/i, '').replace(/\s+(\(?PVT\)?|PRIVATE|LIMITED|LIMIT|LTD\.?|LT|CO\.?)\s*$/i, '').replace(/\s+/g, ' ').trim();
    const vRows = byV.map(([v, o]) => ({ k: sn(v), v: o.r / o.s * 100, tip: `${v}: ${kf(o.r)} received of ${kf(o.s)} scheduled to date · ${o.n} parts` }));
    const wVend = vRows.slice().sort((a, b) => a.v - b.v).slice(0, 4);   /* green (100%+) ones fill in when fewer are behind */   /* 14 Nov 13:08 (Umair): always 4, lowest first and upwards */
    const vOf = d3.rollup(D('atlas_vendor_supply').filter(r => r.date >= ms && inSh(SH, r, 'shop')), v => d3.greatest(d3.rollups(v, w => d3.sum(w, r => (+r.received || 0) + (+r.scheduled || 0)), r => r.vendor), x => x[1])?.[0], r => String(r.code));
    const wPart = (D('atlas_stock_critical') || []).filter(r => inSh(SH, r, 'shop') && vOf.has(String(r.code)) && +r.safety_stock > 0)
      .map(r => ({ code: String(r.code), k: r.part, sub: sn(vOf.get(String(r.code)) || ''), v: (+r.stock || 0) / +r.safety_stock * 100, tip: `${r.part} (${r.code}) · ${r.shop}: stock ${nf(+r.stock || 0)} of ${nf(+r.safety_stock)} safety stock${+r.vendor_stock ? ` · ${nf(+r.vendor_stock)} at vendor` : ''} · vendor ${vOf.get(String(r.code))}` }))
      .sort((a, b) => a.v - b.v);
    /* 14 Nov 13:15 (Umair): fewer than 4 critical parts -> carry on with this shop's vendor parts that are at or above safety stock (green), lowest first */
    if (wPart.length < 4) { const have = new Set(wPart.map(x => x.code)), nm = new Map([...(D('atlas_parts') || []), ...(D('atlas_child_stock') || []), ...(D('atlas_stock_critical') || [])].map(r => [String(r.code), r.part]));
      (D('atlas_part_stock') || []).filter(r => vOf.has(String(r.code)) && !have.has(String(r.code)) && +r.safety > 0 && nm.has(String(r.code)))
        .map(r => ({ code: String(r.code), k: nm.get(String(r.code)), sub: sn(vOf.get(String(r.code)) || ''), v: (+r.stock || 0) / +r.safety * 100, tip: `${nm.get(String(r.code))} (${r.code}): stock ${nf(+r.stock || 0)} of ${nf(+r.safety)} safety stock · vendor ${vOf.get(String(r.code))}` }))
        .sort((a, b) => a.v - b.v).forEach(x => { if (wPart.length < 4) wPart.push(x); }); }
    if (wPart.length < 4) { const have = new Set(wPart.map(x => x.code)), nm = new Map([...(D('atlas_parts') || []), ...(D('atlas_child_stock') || []), ...(D('atlas_stock_critical') || [])].map(r => [String(r.code), r.part]));
      d3.rollups(rows, v => ({ s: d3.sum(v.filter(r => r.date <= pEnd), r => +r.scheduled || 0), r: d3.sum(v, r => +r.received || 0), vd: v[0].vendor }), r => String(r.code))
        .filter(([cd, o]) => !have.has(cd) && (o.s > 0 || o.r > 0)).map(([cd, o]) => ({ code: cd, k: nm.get(cd) || cd, sub: sn(o.vd), v: o.s ? o.r / o.s * 100 : null, lab: o.s ? null : '+' + kf(o.r), tip: `${nm.get(cd) || cd} (${cd}): ${kf(o.r)} received of ${kf(o.s)} scheduled to date · vendor ${o.vd}` }))
        .sort((a, b) => (a.v == null) - (b.v == null) || (b.v >= 100) - (a.v >= 100) || a.v - b.v).forEach(x => { if (wPart.length < 4) wPart.push(x); }); }
    wPart.splice(4);
    /* vendors: fewer than 4 with a schedule -> add the shop's vendors that delivered with nothing scheduled yet */
    if (wVend.length < 4) d3.rollups(rows, v => d3.sum(v, r => +r.received || 0), r => r.vendor).filter(([v, q]) => q > 0 && !byV.some(([w]) => w === v)).sort((a, b) => b[1] - a[1])
      .forEach(([v, q]) => { if (wVend.length < 4) wVend.push({ k: sn(v), v: null, lab: '+' + kf(q), tip: `${v}: ${kf(q)} received, nothing scheduled to date` }); });
    return { title: `${mon(P.month)} to ${dlab(end)}`, st: band(c, 95, 80), watch: { vendors: wVend, parts: wPart },
      tick: { bad: vRows.filter(x => x.v < 80).sort((a, b) => a.v - b.v), all: vRows.slice().sort((a, b) => b.v - a.v) },
      kpis: [['Supply compliance', pc(c), 'received vs schedule', c != null && c < 80 ? C.bad : c < 95 ? C.warn : null], ['Received', kf(rc), 'pieces, month to date'], ['Scheduled', kf(sc), 'pieces due to date'],
        ['Vendors scheduled', nf(byV.length), `${nf(new Set(rows.filter(r => +r.scheduled > 0).map(r => r.code)).size)} parts`], ['Vendors under 80%', nf(low.length), `${pc(byV.length ? low.length / byV.length * 100 : null)} of vendors`, low.length ? C.bad : null]],
      vt: 'Daily receipts vs schedule', mini: el => colC(el, ds.filter(d => (byD.get(d) || {}).s || (byD.get(d) || {}).r), [{ name: 'Schedule', color: '#C9D1D9' }, { name: 'Received', color: C.navy }], (d, s) => (byD.get(d) || {})[s.name === 'Schedule' ? 's' : 'r'], { cFmt: d => +d.slice(8), ml: 34 }),
      detail: [
        { t: 'Cumulative receipts vs schedule', lg: [['Schedule', '#B9C1C9'], ['Received', C.navy]], draw: el => lineC(el, ds, [{ name: 'Schedule', color: '#B9C1C9', values: cS, dash: '4 3' }, { name: 'Received', color: C.navy, values: cR }], { h: 260, xFmt: dlab }) },
        { t: 'Weakest 12 vendors (compliance, month to date)', draw: el => hbarC(el, byV.map(([v, o]) => ({ label: v, v: o.r / o.s * 100 })).sort((a, b) => a.v - b.v).slice(0, 12).map(d => { const o = new Map(byV).get(d.label); return { ...d, lab: pc(d.v), color: col(d.v), tip: [d.label, `Compliance ${pc(d.v)}`, `${kf(o.r)} received of ${kf(o.s)} scheduled`, `${o.n} parts`] }; }), { fmt: pc, ref: 100, h: 270, lw: 170, lc: 26 }) },
        { t: 'Compliance by shop', draw: el => hbarC(el, byS.map(([s, o]) => ({ label: s, v: o.r / o.s * 100, lab: pc(o.r / o.s * 100), color: col(o.r / o.s * 100), tip: [s, `${kf(o.r)} received of ${kf(o.s)} scheduled`] })).sort((a, b) => a.v - b.v), { fmt: pc, ref: 100, h: 260, lw: 130 }) },
        { t: 'Daily receipts vs schedule', lg: [['Schedule', '#C9D1D9'], ['Received', C.navy]], draw: el => colC(el, ds, [{ name: 'Schedule', color: '#C9D1D9' }, { name: 'Received', color: C.navy }], (d, s) => (byD.get(d) || {})[s.name === 'Schedule' ? 's' : 'r'], { h: 260, cFmt: d => +d.slice(8) }) }],
      foot: `Atlas vendor schedule and receipts. Short against schedule to date: ${kf(short)} pieces.` }; };

  /* 12 Nov 00:34 (Umair): 'Exclude Raw Material' toggle leaves out Raw Material, Production parts and Lubricants */
  const CATC = { 'Raw Material': '#051C2C', 'Production parts': '#2251FF', Lubricants: '#00A9F4', Tools: '#1F9E89', Consumables: '#E0A100', Spares: '#8C6BD8' };
  const EXC = ['Raw Material', 'Production parts', 'Lubricants'];
  let exRM = true, wasOn = false;   /* on by default every time the Overview is opened (Umair, 12 Nov 00:46) */
  M.inventory = P => { const SH = SHf(P), S = D('sap_stock').filter(r => r.code && inSh(SH, r, 'shop') && !(exRM && EXC.includes(r.category))), V = d3.sum(S, r => +r.value_pkr || 0), EX = d3.sum(S, r => +r.excess_pkr || 0);
    const dead = S.filter(r => r.move_bucket === 'No movement since Jan 2024' || r.move_bucket === 'Over 1 year'), DV = d3.sum(dead, r => +r.value_pkr || 0);
    const low = S.filter(r => r.cover_bucket === 'Under 15 days' || r.cover_bucket === 'Out of stock');
    const cat = d3.rollups(S, v => d3.sum(v, r => +r.value_pkr || 0), r => r.category || '—').sort((a, b) => b[1] - a[1]);
    const mv = ['Moved in last 90 days', '91–365 days', 'Over 1 year', 'No movement since Jan 2024'].map(b => [b, d3.sum(S.filter(r => r.move_bucket === b), r => +r.value_pkr || 0)]);
    const stg = d3.rollups(S, v => d3.sum(v, r => +r.value_pkr || 0), r => r.stage || 'Not classed').sort((a, b) => b[1] - a[1]);
    const top = S.filter(r => +r.excess_pkr > 0).sort((a, b) => b.excess_pkr - a.excess_pkr).slice(0, 12);
    const asof = (S.find(r => r.asof) || {}).asof || '';
    return { title: `SAP stock${asof ? ' as of ' + dlab(asof) : ''}${exRM ? ' · excl. raw material, production parts, lubricants' : ''}`, st: band(V ? EX / V * 100 : null, 10, 25, false),
      kpis: [['Stock value', rs(V), `${nf(S.length)} materials`], ['Excess stock', rs(EX), `${pc(V ? EX / V * 100 : null)} of value`, C.warn], ['Slow moving', rs(DV), 'no issue for over a year', C.bad],
        ['Low cover', nf(low.length), 'under 15 days or out of stock', low.length ? C.bad : null], ['Moved in 90 days', rs(mv[0][1]), `${pc(V ? mv[0][1] / V * 100 : null)} of value`]],
      vt: 'Stock value by category', mini: el => donutC(el, cat.map(([c, v]) => ({ label: c, v, color: CATC[c] || '#8A949E' })), { fmt: rs, center: rs(V).replace('Rs ', ''), legend: 'bottom' }),
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
    return { title: `${mon(P.month)} to ${dlab(last)}`, st: band(ap, 5, 8, false),
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
    return { title: `COGM ${mon(m)}${m === asof.slice(0, 7) ? ' to ' + dlab(asof) : ''}`,
      kpis: [['COGM', rs(T), SHf(P) && V.get(SHf(P)) ? `Rs ${f0(d3.sum(cur.filter(r => !r.spd), r => r.value_pkr) / V.get(SHf(P)))} per OEM unit` : `${byS.length} shops`], ...EL.map(([n, c]) => [n, rs(e(n)), pc(T ? e(n) / T * 100 : null) + ' of COGM', null, c]), ['SPD share', rs(spd), 'SPD parts made in-house']].slice(0, 6),
      vt: 'COGM by month', mini: el => colC(el, byM.map(d => d.m), EL.map(([n, c]) => ({ name: n, color: c })), (mm, s) => byM.find(d => d.m === mm)[s.name], { stack: 1, cFmt: mon, yFmt: v => v >= 1e9 ? d3.format(',.1f')(v / 1e9) + 'B' : f0(v / 1e6) + 'M', fmt: rs, ml: 38 }),
      detail: [
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
    return { title: 'Clutch area · time studies', st: over.length ? 'bad' : hi && hi.u > 85 ? 'watch' : 'good',
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
    return { title: `Jira${asof ? ' as of ' + dlab(asof) : ''}`, st: band(J.length ? od.length / J.length * 100 : null, 5, 15, false),
      kpis: [['Activities', nf(J.length), `${byP.length} projects`], ['Done', pc(J.length ? dn.length / J.length * 100 : null), `${nf(dn.length)} completed`, '#1E8C5A'], ['In progress', nf(ip.length), 'being worked on'], ['To do', nf(nw.length), 'not started'],
        ['Overdue', nf(od.length), 'past due date, not done', od.length ? C.bad : null]],
      vt: 'Status by project', mini: el => hbarC(el, byP.map(([p, o]) => ({ label: p, v: d3.sum(SC, ([n]) => o[n]), lab: `${o.Done}/${d3.sum(SC, ([n]) => o[n])} done`, color: C.navy, tip: [p, ...SC.map(([n]) => `${n}: ${o[n]}`)] })), { fmt: nf, lw: 120, lc: 20 }),
      detail: [
        { t: 'Activities by project and status', lg: SC.map(([n, c]) => [n, c]), draw: el => colC(el, byP.map(d => d[0]), SC.map(([n, c]) => ({ name: n, color: c })), (p, s) => new Map(byP).get(p)[s.name], { stack: 1, h: 260, fmt: nf, yFmt: nf, cFmt: p => p.length > 26 ? p.slice(0, 25) + '…' : p }) },
        { t: 'Open activities by owner (red = overdue)', draw: el => hbarC(el, own.map(([a, o]) => ({ label: a, v: o.n, lab: `${o.n}${o.o ? ' · ' + o.o + ' overdue' : ''}`, color: o.o ? C.bad : C.navy })), { fmt: nf, h: 280, lw: 150, lc: 24 }) },
        { t: 'Created vs completed per week', lg: [['Created', C.blue], ['Completed', '#1E8C5A']], draw: el => colC(el, wks, [{ name: 'Created', color: C.blue }, { name: 'Completed', color: '#1E8C5A' }], (w, s) => s.name === 'Created' ? J.filter(r => r.created && wk(r.created) === w).length : dn.filter(r => r.resolved && wk(r.resolved.slice(0, 10)) === w).length, { h: 240, fmt: nf, yFmt: nf, cFmt: dlab }) },
        { t: 'Overdue activities (longest first)', draw: el => hbarC(el, od.map(r => ({ label: `${r.key} ${r.summary}`, v: (new Date(today) - new Date(r.due)) / 864e5, color: C.bad, lab: Math.round((new Date(today) - new Date(r.due)) / 864e5) + ' days', tip: [r.key + ' · ' + r.summary, `Due ${r.due} · ${r.status}`, r.assignee || 'Unassigned', r.project_name] })).sort((a, b) => b.v - a.v).slice(0, 12), { fmt: v => f0(v) + ' d', h: 280, lw: 210, lc: 34, empty: 'Nothing overdue' }) }],
      foot: 'Jira (read only).' }; };

  M.savings = P => { const A = D('cr_ideas').filter(r => inSh(SHf(P), r, 'dash_shop', 'shop')), R = A.filter(r => !r.fin_only), keys = rs_ => new Set(rs_.map(r => r.key)).size;
    const ann = rs_ => d3.sum(rs_, r => +r.annual_pkr || 0), mon_ = rs_ => d3.sum(rs_, r => +r.monthly_pkr || 0);
    const done = R.filter(r => r.status === 'Completed'), ip = R.filter(r => r.status === 'In Progress'), pend = R.filter(r => r.status === 'Pending' || r.status === 'Proposal');
    const STC = [['Completed', '#1E8C5A'], ['In Progress', '#E0A100'], ['Pending', '#8E9AA6'], ['Proposal', '#C9D1D9']];
    const byS = d3.rollups(R, v => Object.fromEntries(STC.map(([s]) => [s, ann(v.filter(r => r.status === s))])), r => r.dash_shop || r.shop).sort((a, b) => d3.sum(STC, ([s]) => b[1][s]) - d3.sum(STC, ([s]) => a[1][s]));
    const byC = d3.rollups(R, v => ann(v), r => r.category || '—').sort((a, b) => b[1] - a[1]);
    const top = d3.rollups(R, v => ({ a: ann(v), st: v[0].status, shop: v[0].shop, item: v[0].item }), r => r.key).sort((a, b) => b[1].a - a[1].a).slice(0, 12);
    const T = ann(R);
    return { title: 'Cost reduction ideas', st: band(T ? ann(done) / T * 100 : null, 50, 25),
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
  const hdrF = (id, name, K, o) => `<div class="hd"><span class="ic">${ico(id)}</span><h3 class="ovh3">${esc(name)}</h3><div class="ovkh"><div class="ovfl" title="${esc(K.map(([l, v, sb]) => l + ' ' + v + (sb ? ' (' + sb + ')' : '')).join(' · '))}"><div class="ovfi">${K.slice(0, 2).map(([l, v, sb, c], i) =>
        `<div class="ovff${i ? ' bk' : ''}" style="border-left-color:${c || '#051C2C'}"><span>${esc(l)}</span><b${c ? ` style="color:${c}"` : ''}>${esc(v)}</b></div>`).join('')}</div></div></div>${pill(o.st)}</div>`;
  /* ticker strip used at the foot of the Production and Vendor Supply cards: still when 2 names or fewer, scrolling right to left above that */
  const tickS = (lab, items, cls, tt) => { if (!items.length) return ''; const it = items.join(' · ');
    if (items.length <= 2) return `<div class="ovbh ${cls}" title="${tt}"><b>${lab}</b> ${it}</div>`;
    return `<div class="ovbh ${cls} tk" title="${tt}"><b>${lab}</b><div class="tkw"><div class="tkt" style="animation-duration:${Math.max(10, items.length * 4)}s"><span class="tkg">${it}&nbsp;&nbsp;·&nbsp;&nbsp;</span><span class="tkg" aria-hidden="true">${it}&nbsp;&nbsp;·&nbsp;&nbsp;</span></div></div></div>`; };
  const okc = v => v < 80 ? C.bad : v < 100 ? '#9A6B00' : '#1E8C5A';
  if (!window.__ovWL) window.__ovWL = setInterval(() => document.querySelectorAll('#summary .ovwl').forEach(w => { if (w.dataset.hold || w.matches(':hover')) return; w.dataset.on = w.dataset.on === 'v' ? 'p' : 'v'; }), 7000);
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
    } else if (id === 'vendor' && !o.none && o.watch) {   /* 14 Nov 12:11 (Umair): Vendor Supply - flipping KPI, watch list (critical vendors / critical parts, alternating) and an under-80% ticker */
      const W = o.watch, row = x => { const c = x.v == null ? '#1E8C5A' : okc(x.v), w = x.v == null ? 100 : Math.min(100, x.v / 1.5);
        return `<div class="wr" title="${esc(x.tip)}"><span class="wn">${esc(x.k)}${x.sub ? `<i>${esc(x.sub)}</i>` : ''}</span><span class="wb"><span style="width:${w}%;background:${c}"></span><em></em></span><b style="color:${c}">${x.v == null ? esc(x.lab || '✓') : pc(x.v)}</b></div>`; };
      const pane = (k, L, empty) => `<div class="wp" data-p="${k}">${L.length ? L.map(row).join('') : `<div class="we">${empty}</div>`}</div>`;
      el.innerHTML = hdrF(id, name, K, o).replace(`<h3 class="ovh3">${esc(name)}</h3>`, '<h3 class="ovh3 two">Supply<br>Watch</h3>') + `<div class="ovb ovbc"><div class="ovwl" data-on="v"><div class="wh" role="tablist"><button type="button" role="tab" data-k="v" title="Weakest vendors against schedule to date">Vendors</button><button type="button" role="tab" data-k="p" title="Critical vendor parts lowest against safety stock">Parts</button></div>
        <div class="wps">${pane('v', W.vendors, 'No vendor short of schedule')}${pane('p', W.parts, 'No critical part below safety stock')}</div></div>
        ${o.tick.bad.length ? tickS('Under 80%:', o.tick.bad.map(x => `<span style="color:${C.bad}">${esc(x.k)} ${pc(x.v)}</span>`), '', 'Vendors under 80% of schedule to date')
          : tickS('All vendors 80%+:', o.tick.all.map(x => `<span style="color:${okc(x.v)}">${esc(x.k)} ${pc(x.v)}</span>`), 'ok', 'Every scheduled vendor at 80%+ of schedule to date')}</div>`;
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
    let g = s.querySelector('.ovg'); if (!g) { s.innerHTML = '<div class="ovhd"><div><h2>Operations Overview</h2></div><div class="lgd"></div></div><div class="ovg"></div><p class="ovn"></p>'; g = s.querySelector('.ovg'); }
    { const h2 = s.querySelector('.ovhd h2'); h2.textContent = 'Operations Overview'; }   // 14 Nov 00:58 (Umair): no shop-name chip; the strip and its label already show the shop
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
  function closeD() { const m = document.querySelector('.ovm'); if (m) m.remove(); tip.hide(); document.removeEventListener('keydown', escK); }
  const escK = ev => { if (ev.key === 'Escape') closeD(); };
  function openD(id, name) { const o = last[id]; if (!o || o.none) return; closeD();
    const m = document.createElement('div'); m.className = 'ovm'; m.style.setProperty('--ac', ACC[id]); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', name + ' details');
    m.innerHTML = `<div class="bx"><div class="bh"><div><h2>${esc(name)}${pill(o.st)}</h2><div class="bs">${esc(o.title || '')}</div></div><button class="x" type="button" aria-label="Close" title="Close">×</button></div>
      <div class="bk">${o.kpis.map(([l, v, s, c, b]) => `<div class="k"${b || c ? ` style="border-left-color:${b || c}"` : ''}><div class="l">${esc(l)}</div><div class="v"${c ? ` style="color:${c}"` : ''}>${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join('')}</div>
      <div class="bg">${o.detail.map((d, i) => `<div class="pn"><h4>${esc(d.t)}</h4>${d.lg ? `<div class="lg">${lg(d.lg)}</div>` : ''}<div class="pc" data-i="${i}"></div></div>`).join('')}</div>
      <div class="ft"><span>${esc(o.foot || '')}</span><button type="button" class="go">Open ${esc(name)} tab</button></div></div>`;
    (document.getElementById('ael') || document.body).appendChild(m);
    m.addEventListener('click', ev => { if (ev.target === m) closeD(); }); m.querySelector('.x').addEventListener('click', closeD);
    m.querySelector('.go').addEventListener('click', () => { closeD(); const t = document.querySelector(`#tabs .tab[data-p="${id}"]`); if (t) t.click(); });
    document.addEventListener('keydown', escK); m.querySelector('.x').focus();
    m.querySelectorAll('.pc').forEach(el => { try { o.detail[+el.dataset.i].draw(el); } catch (e) { console.error(e); none(el, 'Could not draw this chart'); } }); }
  { const tb = document.getElementById('tabs'); if (tb) tb.addEventListener('click', ev => { const b = ev.target.closest('.tab'); if (b && b.dataset.p !== 'summary') { const r_ = document.getElementById('ael'); if (r_) r_.classList.remove('ovfit'); } }, true); }
  window.__ovRender = render;
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page !== 'summary') { const rt_ = document.getElementById('ael'); if (rt_) rt_.classList.remove('ovfit'); } if (window.__page === 'summary' && !wasOn) exRM = true; wasOn = window.__page === 'summary'; if (window.__page === 'summary') { try { render(); } catch (e) { console.error(e); } } return r; };
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (window.__page === 'summary') render(); }, 200); });
  try { if (window.__page === 'summary') render(); } catch (e) {}
})();
