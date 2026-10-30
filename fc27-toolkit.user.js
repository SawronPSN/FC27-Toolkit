// ==UserScript==
// @name         FC Toolkit (Data / Buy / Sell / Glitch)
// @namespace    ron-fc-toolkit
// @version      0.1.0
// @description  Helper for the FC web app: Excel / LevelledUp / Sold / Bid-but-lost lists, quick search fills, listing, duplicate swap. Unofficial - it automates EA's web app, use at your own risk.
// @author       Ron
// @homepageURL  https://github.com/SawronPSN/FC27-Toolkit
// @supportURL   https://github.com/SawronPSN/FC27-Toolkit/issues
// @updateURL    https://raw.githubusercontent.com/SawronPSN/FC27-Toolkit/main/fc27-toolkit.user.js
// @downloadURL  https://raw.githubusercontent.com/SawronPSN/FC27-Toolkit/main/fc27-toolkit.user.js
// @match        https://www.ea.com/*ultimate-team/web-app/*
// @match        https://www.levelledupgaming.com/*
// @match        https://levelledupgaming.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// ==/UserScript==
(() => {
  'use strict';

  // page objects (services, repositories, ItemPile) live in the page, not in the Tampermonkey sandbox
  const UW = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || '';

  // ================= LEVELLEDUP WEBSITE: scrape box (runs only on levelledupgaming.com) =================
  const LUG_KEY = 'fct_lug_v1';
  const readLug = () => { try { return JSON.parse(GM_getValue(LUG_KEY, 'null')); } catch { return null; } };
  const ago = t => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 2880 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago';
  };
  function lugPage() {
    const POS_KEY = 'fct_lug_pos';
    const txt = e => (e ? e.textContent.trim() : '');
    const bin = (r, c) => parseInt(txt(r.querySelector(`.lug-price-cell.${c} .lug-bin-value`)).replace(/[^\d]/g, ''), 10) || 0;
    const rows = () => document.querySelectorAll('.lug-desktop-record');
    // list name = the closest heading above the table (e.g. "600k OP List"); fallbacks: first h1, page title
    const listName = () => {
      const sec = document.querySelector('.lug-v6');
      let name = '';
      if (sec) for (const h of document.querySelectorAll('h2')) {
        if (h.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING) name = txt(h);   // h2 comes before the table; keep the last one
      }
      return name || txt(document.querySelector('h1')) || document.title.split(/[|–-]/)[0].trim();
    };
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;background:#000d;color:#fff;font:bold 15px sans-serif;' +
      'padding:8px 10px;border-radius:8px;display:none;min-width:210px;box-sizing:border-box';
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div>Ron’s FC27 Toolkit' +
      `<i style="font-size:12px;font-weight:normal;margin-left:8px">v${VERSION}</i></div>` +
      '<span title="Drag to move" style="cursor:move;user-select:none;touch-action:none;font-size:16px;line-height:1;padding:2px">☰</span></div>' +
      '<button style="margin:6px 0;width:100%;padding:4px;font:bold 15px sans-serif;cursor:pointer">Scrape</button>' +
      '<div style="font-size:13px;color:#bbb;line-height:1.35"></div>';
    const btn = el.querySelector('button'), st = el.lastChild, drag = el.querySelector('span');
    const when = t => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const showSaved = () => {
      const d = readLug();
      st.textContent = d ? `${d.listName || 'List'}\nScraped ${when(d.savedAt)} (${ago(d.savedAt)})\n${d.players.length} players` : 'Nothing scraped yet';
      st.style.whiteSpace = 'pre-line'; st.style.color = '#bbb';
    };
    btn.onclick = () => {
      const players = [...rows()].map(r => ({
        name: txt(r.querySelector('.lug-player-link')),
        rating: txt(r.querySelector('.lug-meta-badge')),
        ps: bin(r, 'ps'), pc: bin(r, 'pc'),            // BIN prices only: Console + PC
      })).filter(p => p.name);
      if (!players.length) { st.textContent = 'No players found - is the list loaded?'; st.style.color = '#ff8a80'; return; }
      GM_setValue(LUG_KEY, JSON.stringify({ savedAt: Date.now(), listName: listName(), siteUpdated: txt(document.getElementById('last-updated-text')), players }));
      showSaved();
    };
    // movable, position remembered
    const place = (l, t) => {
      const maxL = Math.max(4, window.innerWidth - el.offsetWidth - 4), maxT = Math.max(4, window.innerHeight - el.offsetHeight - 4);
      el.style.right = el.style.bottom = ''; el.style.left = Math.min(Math.max(4, l), maxL) + 'px'; el.style.top = Math.min(Math.max(4, t), maxT) + 'px';
    };
    drag.addEventListener('pointerdown', e => {
      e.preventDefault();
      const r = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
      const mv = e2 => place(r.left + e2.clientX - sx, r.top + e2.clientY - sy);
      const up = () => {
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
        try { localStorage.setItem(POS_KEY, JSON.stringify({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) })); } catch { /* ignore */ }
      };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    document.body.appendChild(el);
    showSaved();
    let placed = false;
    setInterval(() => {
      const on = rows().length > 0;
      el.style.display = on ? '' : 'none';                       // show only on pages with the player table
      if (on && !placed) {
        placed = true;
        try { const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); if (p && Number.isFinite(p.left) && Number.isFinite(p.top)) place(p.left, p.top); } catch { /* ignore */ }
      }
    }, 1000);
    setInterval(() => { if (st.style.color !== 'rgb(255, 138, 128)') showSaved(); }, 30000);   // keep "x ago" fresh
  }
  if (location.hostname.endsWith('levelledupgaming.com')) { lugPage(); return; }

  // ================= CONFIG =================
  const KEY_FILL = '1', KEY_NEXT = '2', KEY_PREV = '3';   // Buy tab hotkeys
  const FLASH_MS = 350;                                    // red -> default -> red blink on every new 473
  const SWAP_CLEAR_AFTER = 50;                             // red signal clears once this many items were swapped in a run (or when Stop is clicked)
  const MAX_FLOOR = 200;                                   // Normal Mode Max boxes: blank or at least this
  const STEP = 100;                                        // +/- button step (Buy fixed prices, Sell prices)
  const OPEN_LABELS = ['list on transfer market', 're-list item'];   // ONLY these two labels may open the listing panel
  const SELL_FILL_KEY = '1', SELL_LIST_KEY = '2', SELL_OPEN_KEY = '3';          // Sell tab hotkeys
  const BID_IDX = 3;                                       // number box on the Search page: Max Bid = #4
  const KEYS_WHEN_MINIMIZED = false;
  const SWAP_BATCH = 50;                                   // max swaps per click
  const SWAP_DELAYS = [500, 750, 1000];                    // random pause between swaps (ms)
  const P = 'fct';                                         // localStorage prefix

  const TABS = [['data', 'Data'], ['buy', 'Buy'], ['sell', 'Sell'], ['glitch', 'Glitch']];
  const LISTS = [
    { id: 'selected', label: 'Excel List',
      actions: [{ act: 'load', btn: '📂 Load' }] },
    { id: 'lug', label: 'LevelledUp Web', actions: [] },          // filled from the website scrape; Console / PC toggle
    { id: 'sold', label: 'Sold',
      actions: [{ act: 'update', btn: 'Refresh', src: ['Sold Items', 'Transfer List'] }] },
    { id: 'lost', label: 'Bid but Lost',
      actions: [{ act: 'update', btn: 'Refresh', src: ['Expired Items', 'Transfer Targets'] }] },
  ];
  const TYPING = 'input:not([type=radio]):not([type=checkbox]):not([type=file]),textarea,select,[contenteditable]';

  // ================= STATE =================
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(P + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  const data = ls.get('Data', {});
  LISTS.forEach(l => {
    const ok = data[l.id] && Array.isArray(data[l.id].items);
    const d = data[l.id] = ok ? data[l.id] : { items: [], file: '', pos: 0 };
    d.pos = Math.max(0, Math.min(d.pos || 0, d.items.length - 1));
  });
  delete data.selling;                                         // Currently Selling list was removed
  const cfg = Object.assign(
    { tab: 'data', min: false, active: 'selected', src: 'selected', lugPlat: 'ps', sellBid: '', sellBuy: '',
      buyMode: 'op', nmUseList: true, nmMinBid: '', nmMaxBid: '', nmMinBuy: '', nmMaxBuy: '' },
    ls.get('Cfg', {}));
  if (!TABS.some(t => t[0] === cfg.tab)) cfg.tab = 'data';
  if (cfg.src !== 'lug') cfg.src = 'selected';                 // last price source used: Excel List or LevelledUp Web
  if (cfg.lugPlat !== 'pc') cfg.lugPlat = 'ps';
  if (!LISTS.some(l => l.id === cfg.active)) cfg.active = 'selected';
  if (cfg.buyMode !== 'op' && cfg.buyMode !== 'normal') cfg.buyMode = 'op';
  cfg.nmUseList = cfg.nmUseList !== false;
  const saveData = () => ls.set('Data', data);
  const saveCfg = () => ls.set('Cfg', cfg);

  let busy = false, lastMsg = '';
  let lastWb = null, lastFileName = '';
  let swapRunning = false, stopFlag = false;
  let pending = false;                          // Swap button enabled (a 473 happened / duplicates still left)
  let alertOn = false, hits473 = 0, flashTok = 0;   // red signal, 473 counter, flash race guard

  const L = () => data[cfg.active];
  const setActive = id => { cfg.active = id; if (id === 'selected' || id === 'lug') cfg.src = id; };
  // LevelledUp Web list = last website scrape (Tampermonkey storage), BIN price of the chosen platform
  function refreshLug() {
    const d = readLug(), lg = data.lug;
    if (!d || !Array.isArray(d.players)) { lg.items = []; lg.name = ''; lg.file = 'Nothing scraped yet'; lg.stamp = 0; lg.pos = 0; return; }
    if (lg.stamp !== d.savedAt) lg.pos = 0;                    // a new scrape starts again at #1
    lg.stamp = d.savedAt;
    lg.items = d.players.map(x => ({ name: x.name, pick: String(x.rating || ''), price: x[cfg.lugPlat] || 0 }));
    lg.pos = Math.max(0, Math.min(lg.pos || 0, lg.items.length - 1));
    lg.name = d.listName || '';
    lg.file = `${lg.name ? lg.name + ' · ' : ''}Scraped ${ago(d.savedAt)} (${cfg.lugPlat === 'pc' ? 'PC' : 'Console'})`;
  }
  const listLabel = id => id === 'lug' && data.lug.name ? 'LUG: ' + data.lug.name : LISTS.find(x => x.id === id).label;

  // ================= HELPERS =================
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const num = v => parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10) || 0;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/ı/g, 'i').replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/đ/g, 'd');
  const toks = s => norm(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  const nameMatch = (a, b) => {
    const x = toks(a), y = toks(b);
    return x.length && y.length && (x.every(t => y.includes(t)) || y.every(t => x.includes(t)));
  };
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const setVal = (el, v, blur) => {
    el.focus(); el.value = v;
    ['input', 'keyup', 'change'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
    if (blur) el.blur();
  };
  const mouseEv = t => { try { return new MouseEvent(t, { bubbles: true, cancelable: true, view: window }); }
    catch { return new MouseEvent(t, { bubbles: true, cancelable: true }); } };
  const clickEl = el => ['mousedown', 'mouseup', 'click'].forEach(t => el.dispatchEvent(mouseEv(t)));

  // OP Mode: the price typed into Max Bid is always the list item's price
  const priceFor = it => it?.price || 0;
  const boxIdx = () => BID_IDX;
  const boxName = () => 'Max Bid';

  // ================= UI =================
  // [-] [input] [+] group; k = key in KEYMAP (sellbid / sellbuy / Normal Mode boxes)
  const stepper = (k, ph) =>
    `<span class="fct-stepper"><button class="fct-b" data-step="-1" data-k="${k}">−</button>` +
    `<input type="text" inputmode="numeric" class="fct-in" data-k="${k}" placeholder="${ph}">` +
    `<button class="fct-b" data-step="1" data-k="${k}">+</button></span>`;

  const box = document.createElement('div');
  box.className = 'fct-box';
  box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:#000d;color:#fff;font:bold 18px sans-serif;padding:10px 12px;border-radius:8px';
  box.innerHTML =
    '<style>' +
    '.fct-box{width:430px;max-width:92vw;box-sizing:border-box}' +
    '.fct-box.fct-min{width:auto}' +
    '.fct-box.fct-min .fct-body,.fct-box.fct-min .fct-drag{display:none}' +
    '.fct-body{margin-top:8px}' +
    '.fct-b{background:#444;color:#fff;border:1px solid #aaa;border-radius:6px;font:bold 16px sans-serif;padding:2px 10px;cursor:pointer;white-space:nowrap}' +
    '.fct-b:disabled{opacity:.4;cursor:default}' +
    '.fct-header{display:flex;align-items:center;justify-content:space-between;gap:10px;border-radius:6px}' +
    '.fct-box.fct-red .fct-header{background:#b71c1c;padding:2px 6px}' +
    '.fct-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.fct-hright{display:flex;align-items:center;gap:8px;flex-shrink:0}' +
    '.fct-drag{cursor:move;user-select:none;touch-action:none;font-size:16px;line-height:1;padding:2px}' +
    '.fct-alert{display:none;background:#b71c1c;border-radius:5px;padding:3px 8px;margin-bottom:6px;font-size:15px}' +
    '.fct-alert.fct-flash{background:transparent}' +
    '.fct-tabs{display:flex;gap:4px;margin-bottom:8px}' +
    '.fct-tab{flex:1;padding:3px 4px;font-size:15px}' +
    '.fct-tab.fct-on{background:#2e7d32;border-color:#8bc34a}' +
    '.fct-box.fct-red .fct-tab[data-tab=glitch]{background:#b71c1c;border-color:#ff8a80}' +
    '.fct-panes{display:grid}' +
    '.fct-pane{grid-area:1/1;visibility:hidden}' +
    '.fct-pane.fct-on{visibility:visible}' +
    '.fct-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:5px 0;flex-wrap:nowrap}' +
    '.fct-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;text-align:left}' +
    '.fct-acts{display:flex;gap:6px;flex-shrink:0}' +
    '.fct-pl{padding:2px 8px}' +
    '.fct-pl.fct-on{background:#2e7d32;border-color:#8bc34a}' +
    '.fct-line{display:flex;align-items:center;gap:6px;margin:6px 0;font-size:16px}' +
    '.fct-line .fct-v{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.fct-sheet{flex:1 1 auto;min-width:0;font:bold 15px sans-serif}' +
    '.fct-radios{display:flex;gap:12px;margin:4px 0;font-size:16px;flex-wrap:wrap}' +
    '.fct-radios label,.fct-lr{display:flex;align-items:center;gap:5px;cursor:pointer}' +
    '.fct-box input[type=radio]{accent-color:#4caf50;width:16px;height:16px;cursor:pointer;margin:0}' +
    '.fct-priceRow{display:flex;align-items:center;gap:8px;margin:4px 0;font-size:16px}' +
    '.fct-in{flex:1 1 0;min-width:0;background:#222;color:#fff;border:1px solid #666;border-radius:5px;padding:3px 8px;font:bold 15px sans-serif;box-sizing:border-box}' +
    '.fct-filePrice{flex:1 1 auto}' +
    '.fct-stepper{display:flex;flex:1 1 auto;min-width:0;align-items:center;gap:4px}' +
    '.fct-stepper .fct-b{padding:2px 12px;flex:0 0 auto}' +
    '.fct-lab{flex:0 0 165px;white-space:nowrap}' +
    '.fct-lists2{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;margin:3px 0;font-size:15px}' +
    '.fct-cur{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:4px}' +
    '.fct-sep{border-top:1px solid #555;margin:4px 0}' +
    '.fct-bmodes{display:flex;gap:6px;margin-bottom:4px}' +
    '.fct-bmodes .fct-b{flex:1}' +
    '.fct-bm.fct-on{background:#2e7d32;border-color:#8bc34a}' +
    '.fct-bstack{display:grid}' +
    '.fct-bstack>div{grid-area:1/1;visibility:hidden}' +
    '.fct-bstack>div.fct-on{visibility:inherit}' +
    '.fct-cap{flex:0 0 70px;font-size:15px}' +
    '.fct-nm .fct-stepper .fct-b{padding:2px 9px}' +
    '.fct-nmr{font-size:15px}' +
    '.fct-hint{font-size:14px;color:#bbb;margin-top:6px}' +
    '.fct-g3{display:flex;gap:6px;margin:4px 0 8px}' +
    '.fct-g3 .fct-b{flex:1}' +
    '.fct-gstatus{font-size:20px;height:28px;overflow:hidden}' +
    '.fct-ginfo{font-size:14px;color:#bbb;height:2.6em;line-height:1.3;overflow:hidden}' +
    '.fct-s{white-space:pre-line;line-height:1.3;min-height:1.3em;margin-top:8px;border-top:1px solid #555;padding-top:6px}' +
    '</style>' +
    '<div class="fct-header"><span class="fct-title">Ron’s FC27 Toolkit<i style="font-size:11px;font-weight:normal;margin-left:8px">v' + VERSION + '</i></span>' +
    '<span class="fct-hright"><span class="fct-drag" title="Drag to move">☰</span>' +
    '<button class="fct-b fct-mb" data-a="min" style="margin:0"></button></span></div>' +
    '<div class="fct-body">' +
    '<div class="fct-alert"></div>' +
    '<div class="fct-tabs">' + TABS.map(([id, l]) => `<button class="fct-b fct-tab" data-tab="${id}">${l}</button>`).join('') + '</div>' +

    '<div class="fct-panes">' +
    // ---- Data ----
    '<div class="fct-pane" data-pane="data">' +
    '<input type="file" accept=".xlsx,.xls,.csv" style="display:none">' +
    '<div class="fct-lists"></div>' +
    '<div class="fct-line">File: <span class="fct-v fct-file"></span></div>' +
    '<div class="fct-line">Sheet: <select class="fct-sheet"></select></div>' +
    '</div>' +

    // ---- Buy ----
    '<div class="fct-pane" data-pane="buy">' +
    '<div class="fct-bmodes"><button class="fct-b fct-bm" data-bm="op">OP Mode</button>' +
    '<button class="fct-b fct-bm" data-bm="normal">Normal Mode</button></div>' +
    '<div class="fct-bstack">' +
    // OP mode: price part + list part
    '<div class="fct-op">' +
    '<div class="fct-priceRow"><span class="fct-filePrice"></span></div>' +
    '<div class="fct-sep"></div>' +
    '<div class="fct-lists2"></div>' +
    '</div>' +
    // Normal mode: min/max boxes + List / No list
    '<div class="fct-nm">' +
    '<div class="fct-priceRow"><span class="fct-cap">Bid</span>' + stepper('nmminbid', 'min') + stepper('nmmaxbid', 'max') + '</div>' +
    '<div class="fct-priceRow"><span class="fct-cap">Buy Now</span>' + stepper('nmminbuy', 'min') + stepper('nmmaxbuy', 'max') + '</div>' +
    '<div class="fct-sep"></div>' +
    '<div class="fct-radios fct-nmr">' +
    '<label><input type="radio" name="fctNm" value="list"> <span class="fct-nmln">List</span></label>' +
    '<label><input type="radio" name="fctNm" value="none"> No list</label></div>' +
    '</div>' +
    '</div>' +
    // selected player part (both modes)
    '<div class="fct-sep"></div>' +
    '<div class="fct-cur"></div>' +
    '<div><button class="fct-b" data-d="-10">«</button> <button class="fct-b" data-d="-1">▼</button> <button class="fct-b" data-d="1">▲</button> <button class="fct-b" data-d="10">»</button></div>' +
    '</div>' +

    // ---- Sell ----
    '<div class="fct-pane" data-pane="sell">' +
    '<div class="fct-priceRow"><span class="fct-lab">Minimum Bid Price</span>' + stepper('sellbid', 'start price') + '</div>' +
    '<div class="fct-priceRow"><span class="fct-lab">Buy Now Price</span>' + stepper('sellbuy', 'buy now') + '</div>' +
    '<div class="fct-hint">Key 1 = open panel + fill prices<br>Key 2 = List for Transfer, key 3 = open panel only</div>' +
    '</div>' +

    // ---- Glitch ----
    '<div class="fct-pane" data-pane="glitch">' +
    '<div class="fct-g3"><button class="fct-b" data-a="clear">Clear cache</button>' +
    '<button class="fct-b" data-a="swap">Swap</button>' +
    '<button class="fct-b" data-a="stop">Stop</button></div>' +
    '<div class="fct-gstatus"></div><div class="fct-ginfo"></div>' +
    '</div>' +

    '</div>' +
    '<div class="fct-s"></div>' +
    '</div>';
  document.body.appendChild(box);

  const $ = s => box.querySelector(s);
  const fileIn = $('input[type=file]'), out = $('.fct-s'), alertEl = $('.fct-alert');
  const minBtn = $('.fct-mb'), dragEl = $('.fct-drag');
  const listsEl = $('.fct-lists'), fileEl = $('.fct-file'), sheetSel = $('.fct-sheet');
  const filePriceEl = $('.fct-filePrice');
  const lists2El = $('.fct-lists2'), curEl = $('.fct-cur');
  const opEl = $('.fct-op'), nmEl = $('.fct-nm'), nmListName = $('.fct-nmln');
  const nmRadios = [...box.querySelectorAll('input[name=fctNm]')];
  const NM_INPUTS = {};
  ['nmminbid', 'nmmaxbid', 'nmminbuy', 'nmmaxbuy'].forEach(k => { NM_INPUTS[k] = $(`input[data-k=${k}]`); });
  const inSellBid = $('input[data-k=sellbid]'), inSellBuy = $('input[data-k=sellbuy]');
  const clearBtn = $('[data-a=clear]'), swapBtn = $('[data-a=swap]'), stopBtn = $('[data-a=stop]');
  const gStatusEl = $('.fct-gstatus'), gInfoEl = $('.fct-ginfo');
  inSellBid.value = cfg.sellBid; inSellBuy.value = cfg.sellBuy;
  swapBtn.disabled = true; stopBtn.disabled = true;

  const say = t => { out.textContent = t; };
  const gStatus = (t, c = '#fff') => { gStatusEl.textContent = t; gStatusEl.style.color = c; };

  // ---------- position: draggable while expanded, fixed bottom-left while minimized ----------
  function applyPos() {
    if (cfg.min) { box.style.left = '8px'; box.style.bottom = '8px'; box.style.top = ''; return; }
    const p = ls.get('Pos', null);
    if (p && Number.isFinite(p.left) && Number.isFinite(p.top)) {
      box.style.left = p.left + 'px'; box.style.top = p.top + 'px'; box.style.bottom = '';
    } else { box.style.left = '8px'; box.style.bottom = '8px'; box.style.top = ''; }
  }
  const applyMin = () => { box.classList.toggle('fct-min', cfg.min); minBtn.textContent = cfg.min ? '+' : '–'; applyPos(); };

  dragEl.addEventListener('pointerdown', e => {
    if (cfg.min) return;
    e.preventDefault();
    const rect = box.getBoundingClientRect();
    box.style.bottom = ''; box.style.left = rect.left + 'px'; box.style.top = rect.top + 'px';
    const sx = e.clientX, sy = e.clientY, sl = rect.left, st = rect.top;
    const onMove = e2 => {
      const bw = box.offsetWidth || 430, bh = box.offsetHeight || 40;
      const maxL = Math.max(4, window.innerWidth - bw - 4), maxT = Math.max(4, window.innerHeight - bh - 4);
      box.style.left = Math.min(Math.max(4, sl + (e2.clientX - sx)), maxL) + 'px';
      box.style.top = Math.min(Math.max(4, st + (e2.clientY - sy)), maxT) + 'px';
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      ls.set('Pos', { left: parseFloat(box.style.left), top: parseFloat(box.style.top) });
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });

  // ---------- rendering ----------
  function applyTab() {
    box.querySelectorAll('.fct-tab').forEach(b => b.classList.toggle('fct-on', b.dataset.tab === cfg.tab));
    box.querySelectorAll('.fct-pane').forEach(p => p.classList.toggle('fct-on', p.dataset.pane === cfg.tab));
  }

  function renderSheet() {
    if (cfg.active === 'lug') { sheetSel.innerHTML = '<option value="">-</option>'; sheetSel.disabled = true; return; }
    const sel = data.selected;
    const names = lastWb ? lastWb.SheetNames : (sel.sheet ? [sel.sheet] : []);
    sheetSel.innerHTML = names.length ? names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('') : '<option value="">-</option>';
    sheetSel.value = sel.sheet || '';
    sheetSel.disabled = names.length < 2;
  }

  function renderData() {
    refreshLug();
    listsEl.innerHTML = LISTS.map(x => {
      const acts = x.id === 'lug'
        ? ['ps', 'pc'].map(p => `<button class="fct-b fct-pl${cfg.lugPlat === p ? ' fct-on' : ''}" data-pl="${p}">${p === 'ps' ? 'Console' : 'PC'}</button>`).join('')
        : x.actions.map(a => `<button class="fct-b" data-a="${a.act}" data-id="${x.id}">${a.btn}</button>`).join('');
      return '<div class="fct-row">' +
        `<span class="fct-label" data-id="${x.id}">${x.id === cfg.active ? '●' : '○'} ${listLabel(x.id)} (${data[x.id].items.length})</span>` +
        `<span class="fct-acts">${acts}</span></div>`;
    }).join('');
    const f = cfg.active === 'lug' ? data.lug : data.selected;
    fileEl.textContent = f.file || '-';
    fileEl.title = f.file || '';
    renderSheet();
  }

  function renderBuy() {
    const normal = cfg.buyMode === 'normal';
    box.querySelectorAll('.fct-bm').forEach(b => b.classList.toggle('fct-on', b.dataset.bm === cfg.buyMode));
    opEl.classList.toggle('fct-on', !normal);
    nmEl.classList.toggle('fct-on', normal);
    nmRadios.forEach(r => { r.checked = (r.value === 'list') === cfg.nmUseList; });
    const l = L(), it = l.items[l.pos];
    nmListName.textContent = `List: ${listLabel(cfg.active)} (${l.items.length})`;
    filePriceEl.textContent = it ? (it.price ? `File price: ${it.price}` : 'File price: none') : 'File price: -';
    lists2El.innerHTML = LISTS.map(x =>
      `<label class="fct-lr"><input type="radio" name="fctList" value="${x.id}"${x.id === cfg.active ? ' checked' : ''}> ${listLabel(x.id)} (${data[x.id].items.length})</label>`).join('');
    const dim = normal && !cfg.nmUseList;                      // Normal Mode + No list: player part is inactive
    curEl.style.opacity = dim ? '.4' : '';
    box.querySelectorAll('[data-d]').forEach(b => { b.disabled = dim; });
    if (l.items.length) {
      curEl.textContent = normal
        ? `#${l.pos + 1}/${l.items.length}  ${it.name} ${it.pick}`
        : `#${l.pos + 1}/${l.items.length}  ${it.name} ${it.pick} @ ${priceFor(it) || '-'}`;
    } else {
      curEl.textContent = `${listLabel(cfg.active)} is empty - see the Data tab`;
    }
  }

  function renderAll() { renderData(); renderBuy(); applyTab(); }

  const updateSwapBtn = () => { swapBtn.disabled = swapRunning || !pending; };
  function paintAlert() {
    box.classList.toggle('fct-red', alertOn);
    alertEl.classList.remove('fct-flash');
    alertEl.style.display = alertOn ? 'block' : 'none';
    alertEl.textContent = hits473 > 0
      ? `⚠ 473 ×${hits473} - unassigned pile full → Glitch tab`
      : '⚠ Unassigned pile needs swapping → Glitch tab';
  }
  // steady red on/off (off also resets the 473 counter)
  function setAlert(on) {
    flashTok++;
    alertOn = on;
    if (!on) hits473 = 0;
    paintAlert();
  }
  // a new 473: counter + 1, signal drops to default for FLASH_MS, then turns red again
  function hit473() {
    hits473++;
    const tok = ++flashTok;
    alertOn = true;
    paintAlert();
    box.classList.remove('fct-red');
    alertEl.classList.add('fct-flash');
    setTimeout(() => { if (flashTok === tok && alertOn) paintAlert(); }, FLASH_MS);
  }

  // ---------- events ----------
  box.addEventListener('click', e => {
    const t = e.target.closest?.('[data-a],[data-d],[data-id],[data-tab],[data-step],[data-bm],[data-pl]');
    if (!t || !box.contains(t)) return;
    if (t.tagName === 'BUTTON') t.blur();
    const { a, d, id, tab, step, k, bm, pl } = t.dataset;
    if (step !== undefined) return stepValue(k, Number(step));
    if (pl) { cfg.lugPlat = pl; saveCfg(); refreshLug(); saveData(); return renderAll(); }
    if (bm) { cfg.buyMode = bm; saveCfg(); return renderBuy(); }
    if (tab) { cfg.tab = tab; saveCfg(); return applyTab(); }
    if (a === 'min') { cfg.min = !cfg.min; saveCfg(); return applyMin(); }
    if (a === 'load') return fileIn.click();
    if (a === 'update') {
      const act = LISTS.find(x => x.id === id).actions.find(x => x.act === 'update');
      return updateFrom(id, act.src[0], act.src[1]);
    }
    if (a === 'clear') return clearCache();
    if (a === 'swap') return runSwap();
    if (a === 'stop') { stopFlag = true; if (swapRunning) setAlert(false); return; }
    if (d !== undefined) {
      const l = L(); if (!l.items.length) return;
      l.pos = Math.min(l.items.length - 1, Math.max(0, l.pos + Number(d)));
      saveData(); return renderBuy();
    }
    if (id) { setActive(id); saveCfg(); renderAll(); }
  });

  box.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'fctList') { setActive(t.value); saveCfg(); renderAll(); }
    else if (t.name === 'fctNm') { cfg.nmUseList = t.value === 'list'; saveCfg(); renderBuy(); }
    else if (t === sheetSel) { if (lastWb && sheetSel.value) loadSheet(sheetSel.value); }
    else if (t.dataset?.k && t.dataset.k.startsWith('sell')) { enforceSell(); saveCfg(); syncInputs(); }
    else if (t.dataset?.k && NM_PAIRS[t.dataset.k]) { enforceNm(NM_PAIRS[t.dataset.k]); saveCfg(); syncInputs(); }
    if (t.type === 'radio' || t.tagName === 'SELECT') t.blur();   // so hotkeys keep working
  });

  const KEYMAP = { sellbid: 'sellBid', sellbuy: 'sellBuy',
    nmminbid: 'nmMinBid', nmmaxbid: 'nmMaxBid', nmminbuy: 'nmMinBuy', nmmaxbuy: 'nmMaxBuy' };
  // Normal Mode: [low, high] pairs. Bid pair and Buy pair never affect each other.
  const BID_PAIR = ['nmMinBid', 'nmMaxBid'], BUY_PAIR = ['nmMinBuy', 'nmMaxBuy'];
  const NM_PAIRS = { nmminbid: BID_PAIR, nmmaxbid: BID_PAIR, nmminbuy: BUY_PAIR, nmmaxbuy: BUY_PAIR };
  // Normal Mode page boxes: [cfg key, 0-based number box on the Search page, label] = boxes 3, 4, 5, 6
  const NM_BOXES = [['nmMinBid', 2, 'Min Bid'], ['nmMaxBid', 3, 'Max Bid'], ['nmMinBuy', 4, 'Min Buy'], ['nmMaxBuy', 5, 'Max Buy']];
  box.addEventListener('input', e => {
    const k = KEYMAP[e.target.dataset?.k];
    if (!k) return;
    cfg[k] = e.target.value; saveCfg();
    if (cfg.tab === 'buy') renderBuy();
  });
  box.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches?.('.fct-in')) e.target.blur();   // so hotkeys work right after typing
  });

  // keep Sell prices valid: if Min bid >= Min buy, Min buy goes to bid + STEP
  function enforceSell() {
    const bid = num(cfg.sellBid), buy = num(cfg.sellBuy);
    if (bid && buy <= bid) { cfg.sellBuy = String(bid + STEP); return true; }
    return false;
  }
  function syncInputs() {
    inSellBid.value = cfg.sellBid; inSellBuy.value = cfg.sellBuy;
    Object.keys(NM_INPUTS).forEach(k => { NM_INPUTS[k].value = cfg[KEYMAP[k]]; });
  }
  // Normal Mode relation, only when BOTH boxes of a pair are filled: if high <= low, high = low + STEP
  function enforceNm(pair) {
    let changed = false;
    const lo = num(cfg[pair[0]]); let hi = num(cfg[pair[1]]);
    if (hi && hi < MAX_FLOOR) { hi = MAX_FLOOR; cfg[pair[1]] = String(hi); changed = true; }       // Max: blank or >= 200
    if (lo && hi && hi <= lo) { cfg[pair[1]] = String(Math.max(MAX_FLOOR, lo + STEP)); changed = true; }
    return changed;
  }
  // +/- buttons: change the value by STEP (min 0; empty counts as 0)
  //  - Minimum Bid up (or typed above buy now) -> Buy Now is pushed up to bid + STEP (enforceSell)
  //  - "-" on Buy Now never gets stuck: if it would reach the bid, the bid goes down by STEP too
  //  - typing a Buy Now at/below the bid does NOT lower the bid; Buy Now becomes bid + STEP (enforceSell)
  function stepValue(k, dir) {
    const key = KEYMAP[k]; if (!key) return;
    const pair = NM_PAIRS[k];
    if (pair) {                                           // Normal Mode boxes
      const isHigh = k === 'nmmaxbid' || k === 'nmmaxbuy';
      if (isHigh && dir < 0) {
        const hi = num(cfg[pair[1]]); if (!hi || hi <= MAX_FLOOR) return;      // Max never goes below 200 (and never to blank by "-")
        const nh = Math.max(MAX_FLOOR, hi - STEP), lo = num(cfg[pair[0]]);
        cfg[pair[1]] = String(nh);
        if (lo && lo >= nh) { const nl = nh - STEP; cfg[pair[0]] = nl > 0 ? String(nl) : ''; }   // pushes Min down with it (never blank here)
      } else {
        let v = Math.max(0, num(cfg[key]) + dir * STEP);
        if (isHigh && v < MAX_FLOOR) v = MAX_FLOOR;                            // "+" on a blank Max jumps to 200
        cfg[key] = v ? String(v) : '';
        enforceNm(pair);
      }
      saveCfg(); syncInputs(); return;
    }
    if (k === 'sellbuy' && dir < 0) {
      const buy = num(cfg.sellBuy);
      if (!buy) return;                                   // nothing to lower
      const nb = Math.max(STEP, buy - STEP);              // Buy Now never goes below STEP
      cfg.sellBuy = String(nb);
      const bid = num(cfg.sellBid);
      if (bid && bid >= nb) { const nbid = nb - STEP; cfg.sellBid = nbid > 0 ? String(nbid) : ''; }
    } else {
      const v = Math.max(0, num(cfg[key]) + dir * STEP);
      cfg[key] = v ? String(v) : '';
      if (k === 'sellbid' || k === 'sellbuy') enforceSell();   // Buy tab fixed prices stay independent
    }
    saveCfg(); syncInputs();
    if (cfg.tab === 'buy') renderBuy();
  }

  // ================= EXCEL LOAD (header row always skipped; A=name, B=rating, C=price) =================
  function loadRows(rows, fileName, sheetName) {
    const items = rows.slice(1).map(r => ({
      name: String(r[0] ?? '').trim(),
      pick: String(r[1] ?? '').trim(),
      price: num(r[2]),
    })).filter(x => x.name);
    data.selected = { items, file: fileName, sheet: sheetName || '', pos: 0 };
    setActive('selected');
    saveData(); saveCfg(); renderAll();
    say(`✔ Loaded ${items.length} rows${sheetName ? ' from ' + sheetName : ''}`);
  }
  function loadSheet(name) {
    const rows = XLSX.utils.sheet_to_json(lastWb.Sheets[name], { header: 1, defval: '' });
    loadRows(rows, lastFileName, name);
  }
  fileIn.onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (typeof XLSX === 'undefined') {
        if (!/\.csv$/i.test(f.name)) throw new Error('Excel reader not loaded - refresh the page or save as .csv');
        lastWb = null;
        loadRows((await f.text()).split(/\r?\n/).map(x => x.split(/[,;\t]/)), f.name);
      } else {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        lastWb = wb; lastFileName = f.name;
        loadSheet(wb.SheetNames[0]);
      }
    } catch (err) { say('✖ Load failed: ' + err.message); }
    e.target.value = '';
  };

  // ================= SCRAPE Transfer List / Targets, match against Excel List =================
  function readSection(title) {
    const sec = [...document.querySelectorAll('section.ut-sectioned-item-list-view')]
      .find(s => (s.querySelector('h2.title')?.textContent ?? '').trim().toLowerCase() === title.toLowerCase());
    if (!sec) return null;
    return [...sec.querySelectorAll('li.listFUTItem')].map(li => ({
      name: (li.querySelector('.entityContainer > .name') ?? li.querySelector('.name:not(.main-view)'))?.textContent.trim() ?? '',
      rating: li.querySelector('.rating')?.textContent.trim() ?? ''
    })).filter(c => c.name && c.rating);
  }

  function updateFrom(id, title, page) {
    const cards = readSection(title);
    if (cards === null) return say(`✖ No "${title}" section - open the ${page} page first`);
    refreshLug();
    const sid = cfg.src, src = data[sid].items;                 // match against the last used source (Excel List or LevelledUp Web)
    if (!src.length) return say(sid === 'lug' ? '✖ LevelledUp Web list is empty - scrape on levelledupgaming.com first' : '✖ Excel List is empty - load it first');
    const hits = new Map(), missed = [];
    for (const c of cards) {
      const i = src.findIndex(r => (!r.pick || r.pick === c.rating) && nameMatch(r.name, c.name));
      if (i < 0) { missed.push(`${c.name} ${c.rating}`); continue; }
      const h = hits.get(i) ?? { n: 0, rating: c.rating };
      h.n++; hits.set(i, h);
    }
    const items = [...hits.entries()].sort((a, b) => a[0] - b[0])
      .map(([i, h]) => ({ name: src[i].name, pick: src[i].pick || h.rating, price: src[i].price || 0, qty: h.n }));
    data[id] = { items, file: `${title} @ ${new Date().toLocaleTimeString()} (matched to ${listLabel(sid)})`, pos: 0 };
    cfg.active = id; saveData(); saveCfg(); renderAll();
    if (missed.length) console.log(`FC Toolkit - in "${title}" but not in your file:`, missed);
    return say(cards.length
      ? `✔ ${cards.length - missed.length}/${cards.length} cards matched -> ${items.length} players (${listLabel(sid)})`
      : `✔ "${title}" has no players`);
  }

  // ================= BUY: fill search + price box =================
  function findRow(p) {
    const words = norm(p.name).split(/\s+/).filter(Boolean);
    return [...document.querySelectorAll('.playerResultsList button')].find(b => {
      const n = norm(b.querySelector('.btn-text')?.textContent ?? '');
      const r = (b.querySelector('.btn-subtext')?.textContent ?? '').trim();
      return words.every(w => n.includes(w)) && (!p.pick || r === p.pick);
    });
  }

  async function setNum(el, v) {
    const s = String(v), has = () => /\d/.test(el.value);
    el.focus(); el.click(); el.select?.();
    nativeSet.call(el, s);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: s }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(120); el.blur(); await sleep(150);
    if (!has()) {
      el.focus(); nativeSet.call(el, '');
      for (const ch of s) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
        nativeSet.call(el, el.value + ch);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));
        await sleep(40);
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(120); el.blur(); await sleep(150);
    }
    return has() ? el.value : '';
  }

  // types the player name into the search box and clicks the matching result; returns an error text, or '' when done
  async function pickPlayer(p) {
    const nameIn = document.querySelector('input[placeholder="Type Player Name"]');
    if (!nameIn) return 'Open Transfer Market > Search first';
    say(`Filling ${p.name}...`);
    nameIn.focus();
    nameIn.value = ''; nameIn.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(200);
    setVal(nameIn, p.name, false);
    await sleep(400);
    let btn;
    for (let t = 0; t < 30 && !btn; t++) { btn = findRow(p); if (!btn) await sleep(150); }
    if (!btn) return `No match (${document.querySelectorAll('.playerResultsList button').length} rows): ${p.name} ${p.pick}`;
    clickEl(btn);
    await sleep(250);
    if (btn.isConnected && btn.offsetParent) btn.click();
    await sleep(200);
    return '';
  }

  // OP Mode: player from the list + one price (file price / fixed bid / fixed buy now)
  async function fill(i) {
    const p = L().items[i];
    const fail = m => { lastMsg = '✖ ' + m; return false; };
    const price = priceFor(p);
    if (!price) return fail(`No price for ${p.name} ${p.pick} in ${listLabel(cfg.active)}`);
    const err = await pickPlayer(p);
    if (err) return fail(err);
    const priceIn = document.querySelectorAll('input.ut-number-input-control')[boxIdx()];
    if (!priceIn) return fail(`${boxName()} box (number box #${boxIdx() + 1}) not found`);
    const shown = await setNum(priceIn, price);
    if (!shown) return fail(`${boxName()} box stayed empty: ${p.name}`);
    lastMsg = `✔ ${p.name} ${p.pick}: ${boxName()} = ${shown}`;
    return true;
  }

  // empties a page number box (same event sequence as typing, with a backspace fallback)
  async function clearNum(el) {
    const has = () => /\d/.test(el.value);
    el.focus(); el.click(); el.select?.();
    nativeSet.call(el, '');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(120); el.blur(); await sleep(150);
    if (has()) {
      el.focus();
      for (let n = 0; n < 12 && has(); n++) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
        nativeSet.call(el, el.value.slice(0, -1));
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true }));
        await sleep(40);
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(120); el.blur(); await sleep(150);
    }
    return !has();
  }

  // Normal Mode boxes -> Search page boxes 3-6.
  // all four empty -> empties the four page boxes; some filled -> fills only those; all filled -> fills all four
  async function fillNmBoxes() {
    const vals = NM_BOXES.map(([key, idx, name]) => ({ idx, name, v: num(cfg[key]) }));
    const anyFilled = vals.some(x => x.v);
    if (document.querySelectorAll('input.ut-number-input-control').length < 6)
      return { err: 'Price boxes #3-#6 not found - open the Search page' };
    const done = [];
    for (const x of (anyFilled ? vals.filter(y => y.v) : vals)) {
      const el = document.querySelectorAll('input.ut-number-input-control')[x.idx];
      if (!el) return { err: `${x.name} box (number box #${x.idx + 1}) not found` };
      if (anyFilled) {
        const shown = await setNum(el, x.v);
        if (!shown) return { err: `${x.name} box stayed empty` };
        done.push(`${x.name} ${shown}`);
      } else if (!(await clearNum(el))) return { err: `${x.name} box could not be emptied` };
    }
    return { msg: anyFilled ? done.join(', ') : 'all four price boxes emptied' };
  }

  // Normal Mode: i = list index (List option: name is typed first) or null (No list: prices only)
  async function fillNormal(i) {
    const fail = m => { lastMsg = '✖ ' + m; return false; };
    let who = '';
    if (i !== null) {
      const p = L().items[i];
      const err = await pickPlayer(p);
      if (err) return fail(err);
      who = `${p.name} ${p.pick}: `;
    }
    const r = await fillNmBoxes();
    if (r.err) return fail(r.err);
    lastMsg = `✔ ${who}${r.msg}`;
    return true;
  }

  // ================= SELL: fill listing panel + click "List for Transfer" =================
  const sellPanel = () => document.querySelector('.panelActions.open');
  const sellBoxes = panel => [...panel.querySelectorAll('.ut-numeric-input-spinner-control input.ut-number-input-control')];

  // opens the "List on Transfer Market" accordion if it is closed; returns the open panel (or null + status message)
  async function openSell() {
    let panel = sellPanel();
    if (panel) return panel;
    const acc = [...document.querySelectorAll('.ut-quick-list-panel-view .ut-button-group > button.accordian')]
      .find(b => b.offsetParent &&
        OPEN_LABELS.includes(((b.querySelector('.btn-text') ?? b).textContent || '').trim().toLowerCase()));
    if (!acc) { say('✖ No "List on Transfer Market" / "Re-list Item" button on screen - select a player first'); return null; }
    clickEl(acc);
    for (let t = 0; t < 20 && !panel; t++) { await sleep(100); panel = sellPanel(); }
    if (!panel) { say('✖ The listing panel did not open'); return null; }
    await sleep(250);
    return panel;
  }

  async function sellFill() {
    if (enforceSell()) { saveCfg(); syncInputs(); }
    const bid = num(cfg.sellBid), buy = num(cfg.sellBuy);
    if (!bid || !buy) return say('✖ Enter Minimum Bid Price and Buy Now Price on the Sell tab first');
    const panel = await openSell();
    if (!panel) return;
    const ins = sellBoxes(panel);
    if (ins.length < 2) return say('✖ Start Price / Buy Now boxes not found');
    say('Filling sell prices...');
    await setNum(ins[0], bid);
    await setNum(ins[1], buy);
    await sleep(200);
    if (num(ins[0].value) !== bid) await setNum(ins[0], bid);   // EA sometimes rewrites start price after buy now changes
    await sleep(150);
    const a = num(ins[0].value), b = num(ins[1].value);
    const ok = a === bid && b === buy;
    say(`${ok ? '✔' : '⚠'} Start ${ins[0].value || '-'} / Buy now ${ins[1].value || '-'}` +
      (ok ? '' : `\n(wanted ${bid} / ${buy} - price steps or limits?)`));
  }

  async function sellList() {
    const panel = sellPanel();
    if (!panel) return say('✖ Open "List on Transfer Market" for a player first');
    const ins = sellBoxes(panel);
    if (ins.length < 2 || !num(ins[0].value) || !num(ins[1].value)) return say('✖ Price boxes are empty - press 1 first');
    const btn = [...panel.querySelectorAll(':scope > button.btn-standard.primary')]
      .find(b => !b.classList.contains('mini') && /list for transfer/i.test(b.textContent));
    if (!btn || btn.disabled) return say('✖ "List for Transfer" button not found / disabled');
    const start = ins[0].value, buyNow = ins[1].value;
    clickEl(btn);
    say(`✔ List for Transfer clicked: ${start} / ${buyNow}`);
  }

  // ================= HOTKEYS =================
  document.addEventListener('keydown', async e => {
    if (busy || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    if (cfg.min && !KEYS_WHEN_MINIMIZED) return;
    if (e.target.matches?.(TYPING)) return;
    if (cfg.tab === 'buy') {
      const d = e.key === KEY_FILL ? 0 : e.key === KEY_NEXT ? 1 : e.key === KEY_PREV ? -1 : null;
      if (d === null) return;
      const normal = cfg.buyMode === 'normal';
      if (normal && !cfg.nmUseList) {                       // Normal Mode, No list: key 1 = prices only
        if (d !== 0) return say('No list: only key 1 is used');
        busy = true;
        try { await fillNormal(null); say(lastMsg); } finally { busy = false; }
        return;
      }
      const l = L();
      if (!l.items.length) return say('This list is empty');
      const t = l.pos + d;
      if (t < 0) return say('Already at the first player');
      if (t >= l.items.length) return say('Already at the last player');
      busy = true;
      try { l.pos = t; saveData(); renderBuy(); await (normal ? fillNormal(t) : fill(t)); say(lastMsg); renderBuy(); }
      finally { busy = false; }
    } else if (cfg.tab === 'sell') {
      if (![SELL_FILL_KEY, SELL_LIST_KEY, SELL_OPEN_KEY].includes(e.key)) return;
      busy = true;
      try {
        if (e.key === SELL_FILL_KEY) await sellFill();
        else if (e.key === SELL_LIST_KEY) await sellList();
        else { const p = await openSell(); if (p) say('✔ Listing panel open'); }
      } finally { busy = false; }
    }
  });

  // ================= GLITCH: unassigned duplicates swap + 473 watcher =================
  const scope = {};
  const toPromise = obs => new Promise(res => obs.observe(scope, (sender, r) => {
    sender.unobserve(scope);
    res({ success: r.success, code: r.error?.code, data: r.response ?? r.data });
  }));
  const dups = () => UW.repositories.Item.getUnassignedItems().filter(i => i.isDuplicate());

  async function clearCache() {
    if (swapRunning) return;
    clearBtn.disabled = true;
    gStatus('Clearing...', '#ffd');
    try {
      UW.repositories.Item.unassigned.reset();
      await toPromise(UW.services.Item.requestUnassignedItems());
      await sleep(1000);
      const all = UW.repositories.Item.getUnassignedItems().length;
      gStatus('Cache cleared', '#66bb6a');
      gInfoEl.textContent = `${all} unassigned, ${dups().length} duplicates.`;
    } catch (e) {
      gStatus('Error', '#ff5252');
      gInfoEl.textContent = e.message;
    }
    clearBtn.disabled = false;
  }

  async function runSwap() {
    if (swapRunning) return;
    swapRunning = true; stopFlag = false;
    swapBtn.disabled = true; clearBtn.disabled = true; stopBtn.disabled = false;
    let swapped = 0, total = 0, err = '';
    try {
      gStatus('Loading...', '#ffd');
      UW.repositories.Item.unassigned.reset();
      await toPromise(UW.services.Item.requestUnassignedItems());
      await sleep(1000);
      total = dups().length;
      const target = Math.min(SWAP_BATCH, total);
      for (let k = total - 1; swapped < target && k >= 0 && !stopFlag; k--) {
        const item = dups()[k];
        if (!item) break;
        gStatus(`Swapping ${swapped + 1}/${target}`, '#ffd');
        const { success, code } = await toPromise(UW.services.Item.move(item, UW.ItemPile.CLUB));
        if (!success) { err = `Move failed (code ${code}), stopped.`; break; }
        swapped++;
        if (swapped === SWAP_CLEAR_AFTER) setAlert(false);
        await sleep(rnd(SWAP_DELAYS));
      }
    } catch (e) { err = 'Error: ' + e.message; }
    const left = Math.max(total - swapped, 0);
    gStatus(`Swapped ${swapped}`, '#66bb6a');
    gInfoEl.textContent = `${left} duplicates left.` + (stopFlag ? ' Stopped by you.' : '') + (err ? ' ' + err : '');
    swapRunning = false;
    stopBtn.disabled = true; clearBtn.disabled = false;
    pending = left > 0;
    setAlert(left > 0 && swapped < SWAP_CLEAR_AFTER && !stopFlag);
    updateSwapBtn();
  }

  function hookBid() {
    const orig = UW.services.Item.bid;
    UW.services.Item.bid = function (item, amount) {
      const obs = orig.call(this, item, amount);
      obs.observe(scope, (sender, r) => {
        sender.unobserve(scope);
        if (r.success || swapRunning) return;
        const code = r.error?.code;
        console.warn('[bid failed] code:', code, 'status:', r.status, r.error);
        if (code === 473) {
          let n = '?'; try { n = dups().length; } catch (e) { /* ignore */ }
          pending = true;
          hit473();
          updateSwapBtn();
          gStatus(`473 hit ×${hits473}`, '#ff5252');
          gInfoEl.textContent = `Unassigned pile full. ${n} duplicates in unassigned.`;
        } else {
          gInfoEl.textContent = `Last bid failed: code ${code}`;
        }
      });
      return obs;
    };
  }

  // ================= INIT =================
  refreshLug(); saveData();
  if (typeof GM_addValueChangeListener === 'function')
    GM_addValueChangeListener(LUG_KEY, (n, o, v, remote) => { if (remote) { refreshLug(); saveData(); renderAll(); } });
  syncInputs();
  renderAll();
  applyMin();
  setAlert(false);
  updateSwapBtn();
  gStatus('Idle');
  gInfoEl.textContent = 'Watching bids / buy now...';
  const hookTimer = setInterval(() => {
    if (UW.services?.Item?.bid && UW.ItemPile) {
      clearInterval(hookTimer);
      hookBid();
    }
  }, 500);
})();