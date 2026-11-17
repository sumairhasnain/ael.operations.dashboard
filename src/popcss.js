/* 8 Nov 2026: hover-popup styles (vendor panel .vsk, popup .vpop) moved out of dashboard.html to keep the page under the artifact size limit. */
(() => { const st = document.createElement('style'); st.textContent = `.ael .vsk{position:absolute;top:36px;right:14px;width:236px;z-index:2;background:#fff;border:1px solid var(--line);padding:7px 10px 8px;display:flex;flex-direction:column;gap:6px}\n.ael .vsk .vr.ih{padding-bottom:6px;border-bottom:1px solid var(--line)}\n.ael .vsk .vh{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}\n.ael .vsk .vr{display:grid;grid-template-columns:minmax(0,1fr) auto auto;column-gap:8px;align-items:baseline;cursor:default}\n.ael .vsk .vn{font-size:11.5px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ael .vsk .vv{font-size:11.5px;color:var(--mut);white-space:nowrap}\n.ael .vsk .vv b{font-family:var(--font-anthropic-serif);font-weight:400;font-size:14px;color:var(--navy)}\n.ael .vsk .vc{font-family:var(--font-anthropic-serif);font-size:14px;min-width:34px;text-align:right}\n.ael .vsk svg{grid-column:1/-1;display:block;width:100%;height:6px;margin-top:3px}\n.ael .vsk .vf{font-size:11px;color:var(--mut)}\n.ael .vpop{position:fixed;z-index:50;flex-direction:column;gap:8px;pointer-events:none}\n.ael .vpop .vsk{position:static;width:260px;box-shadow:0 6px 20px rgba(5,28,44,.18)}
/* 8 Nov (Umair): Part Compliance - Other Parts - the three dispatch columns sit past the right edge and come into view with the light grey horizontal scroll bar. */
.ael #c-p-parts2 .tbox{overflow-x:auto;scrollbar-width:thin;scrollbar-color:#CDD3DA #F3F5F8}
.ael #c-p-parts2 .tbox::-webkit-scrollbar{height:8px;width:8px} .ael #c-p-parts2 .tbox::-webkit-scrollbar-thumb{background:#CDD3DA;border-radius:4px} .ael #c-p-parts2 .tbox::-webkit-scrollbar-track{background:#F3F5F8;border-radius:4px}
.ael #tb-parts2{table-layout:fixed;width:calc(100% + 420px);min-width:1696px} /* 17 Nov 17:55: RCV % added; table width kept so every column up to Prod % fits the card without scrolling (only the dispatch columns sit past the edge) */ /* 17 Nov: Part 3 characters and Shop 2 characters narrower; VEN MTD and Received added (Umair) */
.ael #tb-parts2 th:nth-child(1){width:122px} .ael #tb-parts2 th:nth-child(3){width:114px} .ael #tb-parts2 th:nth-child(4){width:92px} .ael #tb-parts2 th:nth-child(5){width:22px} .ael #tb-parts2 th:nth-child(5),.ael #tb-parts2 td:nth-child(5){padding-left:2px;padding-right:2px} /* Level 4 characters narrower (header 'Lvl') */
.ael #tb-parts2 th:nth-child(6){width:80px} .ael #tb-parts2 th:nth-child(7){width:78px} .ael #tb-parts2 th:nth-child(8){width:84px} .ael #tb-parts2 th:nth-child(9){width:84px} .ael #tb-parts2 th:nth-child(10){width:84px} .ael #tb-parts2 th:nth-child(11){width:66px} .ael #tb-parts2 th:nth-child(12){width:80px} .ael #tb-parts2 th:nth-child(13){width:80px} .ael #tb-parts2 th:nth-child(14){width:80px} .ael #tb-parts2 th:nth-child(15){width:66px}
.ael #tb-parts2 th:nth-child(n+16){width:110px}
.ael #tb-parts2 td{overflow:hidden;text-overflow:ellipsis} .ael #tb-parts2 td:nth-child(2){white-space:normal;overflow-wrap:anywhere;line-height:1.3}`; (document.head || document.body).appendChild(st); })();

/* 17 Nov 2026 (Umair): Part Compliance - Other Parts - the Code column stays hidden. It slides in when the cursor reaches the table's
   left border and slides back out once the cursor leaves the Code column (or the table). */
(() => { const st = document.createElement('style'); st.textContent = `
.ael #tb-parts2{transition:width .25s ease,min-width .25s ease}
.ael #tb-parts2:not(.cdon){width:calc(100% + 298px);min-width:1574px}
.ael #tb-parts2 th:nth-child(1),.ael #tb-parts2 td:nth-child(1){transition:width .25s ease,padding .25s ease,opacity .2s ease}
.ael #tb-parts2:not(.cdon) th:nth-child(1){width:0;padding-left:0;padding-right:0}
.ael #tb-parts2:not(.cdon) th:nth-child(1),.ael #tb-parts2:not(.cdon) td:nth-child(1){padding-left:0;padding-right:0;opacity:0;white-space:nowrap;overflow:hidden;border-right:0}
`; (document.head || document.body).appendChild(st);
  const EDGE = 14, bind = () => { const box = document.querySelector('#c-p-parts2 .tbox'), tb = document.getElementById('tb-parts2'); if (!box || !tb || box.__cd) return; box.__cd = 1;
    const set = on => { tb.classList.toggle('cdon', on); box.classList.toggle('cdon', on); };
    box.addEventListener('mousemove', ev => { const r = box.getBoundingClientRect(), x = ev.clientX - r.left;
      if (!tb.classList.contains('cdon')) { if (x <= EDGE) set(true); return; }
      const th = tb.querySelector('thead th'), w = th ? th.getBoundingClientRect().right - r.left : 122; if (x > w + 2) set(false); });
    box.addEventListener('mouseleave', () => set(false)); };
  bind(); new MutationObserver(bind).observe(document.body, { childList: true, subtree: true }); })();
