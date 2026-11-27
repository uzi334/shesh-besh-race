'use strict';
// מרוץ על לוח שש-בש – גרסת התנסות (Demo)
// הדביקו כאן את הקישור לעמוד הגרסה המלאה ב-itch.io:
const PRO_STORE_URL = 'https://ezradigital.itch.io/shesh-besh-race-pro';
const EDITION = 'demo';

// ===== לוגיקת המשחק =====
// נקודות 0..23 בסדר נגד כיוון השעון (מבט השחקן הלבן): 0 = ימין למעלה, 11 = שמאל למעלה,
// 12 = שמאל למטה, 23 = ימין למטה. לבן מתחיל ב-0 ובית שלו 18..23 (ימין למטה).
// שחור מתחיל ב-12 (הימין-למעלה שלו) ובית שלו 6..11 (הימין-למטה שלו).
const sg = pl => pl === 0 ? 1 : -1;
const prog = (pl, a) => pl === 0 ? a : (a + 12) % 24;
const absP = (pl, p) => pl === 0 ? p : (p + 12) % 24;
let memo = new Map();

function newPos() { const b = new Int8Array(24); b[0] = 15; b[12] = -15; return { b, off: [0, 0] }; }
function clonePos(p) { return { b: p.b.slice(), off: p.off.slice() }; }
function posKey(p) { return p.b.join(',') + '|' + p.off[0] + ',' + p.off[1]; }
function allHome(pos, pl) { const s = sg(pl); for (let a = 0; a < 24; a++) if (pos.b[a] * s > 0 && prog(pl, a) < 18) return false; return true; }
function hasHome(pos, pl) { if (pos.off[pl] > 0) return true; const s = sg(pl); for (let a = 0; a < 24; a++) if (pos.b[a] * s > 0 && prog(pl, a) >= 18) return true; return false; }

function singleMoves(pos, pl, die) {
  const res = [], s = sg(pl), home = allHome(pos, pl);
  let minProg = 99;
  if (home) for (let a = 0; a < 24; a++) if (pos.b[a] * s > 0) minProg = Math.min(minProg, prog(pl, a));
  // פתיחה: טבליה בודדה אחת רצה עד שהיא נכנסת לבית; עד אז הראש נעול
  const head = absP(pl, 0), lone = !hasHome(pos, pl), headN = pos.b[head] * s;
  for (let a = 0; a < 24; a++) {
    if (pos.b[a] * s <= 0) continue;
    if (lone && headN < 15 && a === head) continue;
    const p = prog(pl, a), t = p + die;
    if (t < 24) {
      const ta = absP(pl, t);
      if (pos.b[ta] * s < 0) continue;
      const m = { from: a, to: ta, die };
      // חסימה של 6 ברצף מותרת רק למי שיש לו שתי נקודות צמודות בבית
      if (pos.b[ta] === 0) { const nb = applyM(pos, pl, m); if (runAt(nb, pl, t) >= 6 && !adjHome(nb, pl)) continue; }
      res.push(m);
    }
    else if (home && (t === 24 || p === minProg)) res.push({ from: a, to: -1, die });
  }
  return res;
}
function occ(pos, pl, p) { return pos.b[absP(pl, p)] * sg(pl) > 0; }
function runAt(pos, pl, t) { let n = 1; for (let p = t - 1; p >= 0 && occ(pos, pl, p); p--) n++; for (let p = t + 1; p < 24 && occ(pos, pl, p); p++) n++; return n; }
function adjHome(pos, pl) { for (let p = 18; p < 23; p++) if (occ(pos, pl, p) && occ(pos, pl, p + 1)) return true; return false; }
function applyM(pos, pl, m) { const b = pos.b.slice(), off = pos.off.slice(), s = sg(pl); b[m.from] -= s; if (m.to >= 0) b[m.to] += s; else off[pl]++; return { b, off }; }
function rmDie(d, v) { const r = d.slice(); r.splice(r.indexOf(v), 1); return r; }
const uniq = d => [...new Set(d)];

function maxUse(pos, pl, dice) {
  if (!dice.length || pos.off[pl] === 15) return 0;
  const k = pl + '#' + posKey(pos) + '#' + dice.slice().sort().join('');
  const c = memo.get(k); if (c !== undefined) return c;
  let best = 0;
  outer: for (const d of uniq(dice)) for (const m of singleMoves(pos, pl, d)) {
    const r = 1 + maxUse(applyM(pos, pl, m), pl, rmDie(dice, d));
    if (r > best) { best = r; if (best === dice.length) break outer; }
  }
  if (memo.size > 300000) memo.clear();
  memo.set(k, best); return best;
}
// מהלכים חוקיים: חובה לנצל כמה שיותר קוביות; אם רק אחת אפשרית – הגבוהה
function legalMoves(pos, pl, dice) {
  if (!dice.length || pos.off[pl] === 15) return [];
  let all = [];
  for (const d of uniq(dice)) for (const m of singleMoves(pos, pl, d)) { m.score = 1 + maxUse(applyM(pos, pl, m), pl, rmDie(dice, d)); all.push(m); }
  if (!all.length) return [];
  const M = Math.max(...all.map(m => m.score));
  all = all.filter(m => m.score === M);
  if (M === 1 && dice.length === 2 && dice[0] !== dice[1]) { const big = Math.max(...all.map(m => m.die)); all = all.filter(m => m.die === big); }
  return all;
}

// ===== בינה מלאכותית =====
// קל (מתחיל): מהלכים אקראיים, לפעמים המהלך שמתקדם הכי רחוק
function aiEasyMove(pos, pl, dice) {
  const lm = legalMoves(pos, pl, dice);
  if (Math.random() < 0.35) {
    const far = m => m.to < 0 ? 99 : prog(pl, m.to);
    return lm.reduce((a, b) => far(b) > far(a) ? b : a);
  }
  return lm[Math.floor(Math.random() * lm.length)];
}
function aiEasyChoose(pos, pl, opts) { return Math.random() < 0.6 ? opts.length - 1 : Math.floor(Math.random() * opts.length); }
const AI = { easy: { move: aiEasyMove, choose: aiEasyChoose } };

// ===== הגדרות, עיצובים ושמירה =====
const DIFFS = [
  { id: 'easy', name: 'קל', sub: 'מתחיל' },
  { id: 'medium', name: 'בינוני', sub: 'טקטי' },
  { id: 'hard', name: 'קשה', sub: 'מומחה' }
];
const THEMES = [
  { id: 'classic', name: 'עץ ולבד', c: ['#6b3f1f', '#2b4a3a', '#c9a46b', '#8e2f22'] },
  { id: 'marble', name: 'שיש וזהב', c: ['#15151b', '#2c2b33', '#c9a227', '#e6e1d6'] },
  { id: 'desert', name: 'מדבר וטורקיז', c: ['#b98a55', '#e8cd98', '#1f9e98', '#b5622d'] },
  { id: 'neon', name: 'ניאון לילה', c: ['#05050a', '#00e5ff', '#ff2bd6', '#39ff14'] }
];
const OPEN = { diff: ['easy'], theme: ['classic'] };
const isOpen = (kind, id) => OPEN[kind].includes(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('sbr.' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sbr.' + k, v); } catch (e) { /* אחסון לא זמין */ } }
};
const prefs = {
  diff: store.get('diff', EDITION === 'pro' ? 'medium' : 'easy'),
  theme: store.get('theme', 'classic'),
  mode: store.get('mode', 'ai')
};
if (!DIFFS.some(d => d.id === prefs.diff) || !isOpen('diff', prefs.diff) || !AI[prefs.diff]) prefs.diff = 'easy';
if (!THEMES.some(t => t.id === prefs.theme) || !isOpen('theme', prefs.theme)) prefs.theme = 'classic';
if (prefs.mode !== 'ai' && prefs.mode !== 'pvp') prefs.mode = 'ai';

function applyTheme() {
  document.body.dataset.theme = prefs.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#14110f';
}
function segBtn(parent, html, on, locked, onClick) {
  const b = document.createElement('button'); b.type = 'button';
  b.innerHTML = html + (locked ? '<span class="pro-tag">🔒 PRO</span>' : '');
  if (on) b.classList.add('on');
  if (locked) { b.classList.add('locked'); b.setAttribute('aria-label', b.textContent + ' – נעול'); }
  b.onclick = onClick; parent.appendChild(b); return b;
}
function renderSettings() {
  const ms = $('#modeSeg'); ms.innerHTML = '';
  [['ai', '🤖 נגד המחשב'], ['pvp', '👥 שני שחקנים']].forEach(([id, t]) =>
    segBtn(ms, t, prefs.mode === id, false, () => { if (prefs.mode === id) return; prefs.mode = id; store.set('mode', id); renderSettings(); newGame(); }));
  const ds = $('#diffSeg'); ds.innerHTML = ''; ds.classList.toggle('dim', prefs.mode !== 'ai');
  DIFFS.forEach(d => {
    const locked = !isOpen('diff', d.id) || !AI[d.id];
    segBtn(ds, `${d.name}<small>${d.sub}</small>`, prefs.diff === d.id, locked, () => {
      if (locked) return showPro(`רמת הקושי ${d.name} (${d.sub})`);
      prefs.diff = d.id; store.set('diff', d.id); S.plan = null; renderSettings();
    });
  });
  const ts = $('#themeSeg'); ts.innerHTML = '';
  THEMES.forEach(t => {
    const locked = !isOpen('theme', t.id);
    segBtn(ts, `<span class="sw">${t.c.map(c => `<i style="background:${c}"></i>`).join('')}</span>${t.name}`, prefs.theme === t.id, locked, () => {
      if (locked) return showPro(`עיצוב הלוח ${t.name}`);
      prefs.theme = t.id; store.set('theme', t.id); applyTheme(); renderSettings();
    });
  });
}

// ===== חלונות (Modal) =====
let lastFocus = null;
function openModal(id) {
  const m = document.getElementById(id); if (!m) return;
  lastFocus = document.activeElement; m.hidden = false;
  const f = m.querySelector('.main,.buy,button'); if (f) f.focus();
}
function closeModals() {
  document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
function initModals() {
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) closeModals(); });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModals(); });
  $('#rulesBtn').onclick = () => openModal('rulesModal');
  $('#buyLink').href = PRO_STORE_URL;
  $('#upgradeBtn').onclick = () => showPro('');
}
function showPro(what) {
  $('#proWhat').textContent = what ? `${what} זמין רק בגרסה המלאה.` : 'כל רמות הקושי וכל עיצובי הלוח – בגרסה המלאה.';
  openModal('proModal');
}

// ===== ממשק המשחק =====
const NAMES = ['לבן', 'שחור'];
const $ = s => document.querySelector(s);
const r6 = () => 1 + Math.floor(Math.random() * 6);
let S, aiT = null; const ptEls = [];

function build() {
  const bd = $('#board');
  for (let a = 0; a < 24; a++) {
    const el = document.createElement('div');
    const top = a < 12;
    el.style.gridRow = top ? 1 : 3;
    el.style.gridColumn = top ? (a <= 5 ? 13 - a : 12 - a) : (a <= 17 ? a - 11 : a - 10);
    el.innerHTML = '<span class="mark"></span>';
    el.onclick = () => clickPoint(a);
    bd.appendChild(el); ptEls[a] = el;
  }
  bd.insertAdjacentHTML('beforeend', '<div class="bar"></div><div class="strip" id="stripL" dir="rtl"></div><div class="strip" id="stripR"></div><div class="tray" id="trayB"><span>שחור</span><span class="n" id="offB">0</span><span>יצאו</span></div><div class="trayMid"></div><div class="tray" id="trayW"><span>לבן</span><span class="n" id="offW">0</span><span>יצאו</span></div>');
  $('#trayB').onclick = () => clickPoint(-1); $('#trayW').onclick = () => clickPoint(-1);
  $('#newBtn').onclick = newGame;
  window.addEventListener('resize', fit); fit();
}
function fit() {
  const w = Math.min(document.documentElement.clientWidth - 16, 640) - 16;
  const col = (w - 14 - 34) / 12;
  document.documentElement.style.setProperty('--col', col + 'px');
  document.documentElement.style.setProperty('--c', Math.floor(Math.min(col * .94, 44)) + 'px');
}
const human = pl => S.mode === 'pvp' || pl === 0;

function newGame() {
  clearTimeout(aiT);
  S = { mode: prefs.mode, pos: newPos(), cur: 0, phase: 'start', dice: [], diceAll: [], stolen: false, active: false, bonusFor: -1, pendingChoice: false, queue: null, sel: null, opts: null, snap: null, plan: null, last: null,
    msg: 'כל שחקן מטיל קובייה – הגבוה פותח' };
  memo.clear(); render();
}
function openingRoll() {
  let a, b; do { a = r6(); b = r6(); } while (a === b);
  S.cur = a > b ? 0 : 1; S.phase = 'roll'; S.diceAll = []; S.openDice = [a, b];
  S.msg = `פתיחה: לבן ${a} · שחור ${b} — ${NAMES[S.cur]} פותח`;
  render(); maybeAI();
}
function roll() {
  const d1 = r6(), d2 = r6(); S.openDice = null;
  let pre = '';
  if (!S.active && hasHome(S.pos, 0) && hasHome(S.pos, 1)) { S.active = true; pre = '⚡ שני השחקנים הגיעו הביתה – חוק הדאבל ההפוך פעיל! '; }
  if (S.active && d1 + d2 === 7 && (d1 === 4 || d1 === 3)) { S.pendingChoice = true; S.msg = pre + `${NAMES[S.cur]} הטיל 4-3 — קודם משחקים 4-3, אחר כך בוחרים דאבל`; setDice([d1, d2]); return; }
  if (S.active && d1 === d2) { const o = 7 - d1; S.msg = pre + `${NAMES[S.cur]} הטיל ${d1}-${d1} — קודם ${d1}-${d1}, אחר כך ההופכי ${o}-${o}`; S.queue = [o, o, o, o]; setDice([d1, d1, d1, d1]); return; }
  S.msg = pre + `${NAMES[S.cur]} הטיל ${d1}-${d2}`;
  setDice(d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]);
}
function chooseOpt(i) {
  const o = S.opts[i]; S.opts = null; S.bonusFor = S.cur;
  S.msg = `${NAMES[S.cur]} בחר ${o[0]}-${o[0]} — ובסיום יקבל זריקה נוספת`;
  setDice(o);
}
function setDice(d) {
  S.dice = d.slice(); S.diceAll = d.slice(); S.phase = 'move'; S.sel = null; S.plan = null;
  S.snap = { pos: clonePos(S.pos), dice: d.slice(), cur: S.cur, last: S.last };
  progress();
}
function progress() {
  for (const pl of [0, 1]) if (S.pos.off[pl] === 15) {
    S.phase = 'over'; S.winner = pl; S.mars = S.pos.off[1 - pl] === 0;
    S.msg = `🏆 ${NAMES[pl]} ניצח${S.mars ? ' – מרס!' : ''}`; render(); return;
  }
  if (!S.dice.length) {
    if (S.queue) { const q = S.queue; S.queue = null; S.msg = `${NAMES[S.cur]} סיים את הדאבל — עכשיו ההופכי ${q[0]}-${q[0]}`; setDice(q); return; }
    endTurn(); return;
  }
  if (!legalMoves(S.pos, S.cur, S.dice).length) { leftover(); return; }
  render(); maybeAI();
}
function leftover() {
  const left = S.dice.slice(), who = S.cur, other = 1 - who;
  const lostExtra = S.pendingChoice || S.bonusFor === who || !!S.queue; S.pendingChoice = false; S.queue = null; if (S.bonusFor === who) S.bonusFor = -1;
  const ex = lostExtra ? ' (שאר הרצף שלו מתבטל)' : '';
  if (!S.stolen) {
    if (legalMoves(S.pos, other, left).length) {
      S.msg = `${NAMES[who]} חסום עם ${left.join(', ')} — ${NAMES[other]} משחק אותן וממשיך בתור שלו${ex}`;
      S.cur = other; S.stolen = true; setDice(left); return;
    }
    S.dice = []; S.sel = null;
    S.cur = other; S.phase = 'roll'; S.msg = `${NAMES[who]} חסום עם ${left.join(', ')}, וגם ל${NAMES[other]} אין מהלך איתן — הקוביות אבדו. תור ${NAMES[other]}${ex}`; render(); maybeAI(); return;
  }
  S.dice = []; endTurn(`${NAMES[who]} לא יכול לנצל את שאר הקוביות שקיבל. `);
}
function endTurn(pre = '') {
  if (S.stolen) { S.stolen = false; S.msg = pre + `${NAMES[S.cur]} שיחק את הקוביות שקיבל — עכשיו ההטלה שלו`; }
  else if (S.pendingChoice) {
    S.pendingChoice = false; S.phase = 'choose'; S.opts = [1, 2, 3, 4, 5, 6].map(v => [v, v, v, v]); S.dice = []; S.sel = null;
    S.msg = `${NAMES[S.cur]} שיחק 4-3 — עכשיו בחר דאבל אחד (ואחריו זריקה נוספת)`; render(); maybeAI(); return;
  }
  else if (S.bonusFor === S.cur) { S.bonusFor = -1; S.msg = `🎁 ${NAMES[S.cur]} מקבל זריקה נוספת בזכות ה-4-3`; }
  else { S.cur = 1 - S.cur; S.msg = `תור ${NAMES[S.cur]}` + (human(S.cur) ? ' — הטל קוביות' : ''); }
  S.dice = []; S.phase = 'roll'; S.sel = null; render(); maybeAI();
}
function doMove(m) { S.pos = applyM(S.pos, S.cur, m); S.dice = rmDie(S.dice, m.die); S.sel = null; S.last = m.to; progress(); }
function undo() {
  if (!S.snap || S.phase !== 'move' || S.snap.cur !== S.cur) return;
  S.pos = clonePos(S.snap.pos); S.dice = S.snap.dice.slice(); S.last = S.snap.last; S.sel = null; render();
}
function clickPoint(a) {
  if (S.phase !== 'move' || !human(S.cur)) return;
  const lm = legalMoves(S.pos, S.cur, S.dice);
  if (S.sel !== null) {
    const ms = lm.filter(m => m.from === S.sel && m.to === a).sort((x, y) => x.die - y.die);
    if (ms.length) { doMove(ms[0]); return; }
  }
  S.sel = (a >= 0 && S.sel !== a && lm.some(m => m.from === a)) ? a : null; render();
}
function maybeAI() {
  clearTimeout(aiT);
  if (S.mode !== 'ai' || S.cur !== 1 || S.phase === 'over' || S.phase === 'start') return;
  aiT = setTimeout(aiStep, S.phase === 'move' ? 600 : 900);
}
function aiStep() {
  const lvl = AI[prefs.diff] || AI.easy;
  if (S.phase === 'roll') return roll();
  if (S.phase === 'choose') return chooseOpt(lvl.choose(S.pos, 1, S.opts));
  if (S.phase === 'move') return doMove(lvl.move(S.pos, 1, S.dice));
}
function dieHTML(v, cls) {
  const P = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[v];
  let h = ''; for (let i = 1; i <= 9; i++) h += P.includes(i) ? `<i style="grid-area:${Math.ceil(i / 3)}/${(i - 1) % 3 + 1}"></i>` : '';
  return `<div class="die ${cls}">${h}</div>`;
}
function render() {
  const isH = S.phase === 'move' && human(S.cur);
  const lm = isH ? legalMoves(S.pos, S.cur, S.dice) : [];
  const srcs = new Set(lm.map(m => m.from));
  const dsts = new Set(S.sel !== null ? lm.filter(m => m.from === S.sel).map(m => m.to) : []);
  for (let a = 0; a < 24; a++) {
    const el = ptEls[a], v = S.pos.b[a], n = Math.abs(v), top = a < 12;
    el.className = 'pt ' + (top ? 'top' : 'bot') + ' ' + (a % 2 ? 'c1' : 'c2') + (srcs.has(a) ? ' src' : '') + (S.sel === a ? ' sel' : '') + (dsts.has(a) ? ' dst' : '') + (S.last === a ? ' last' : '');
    el.style.backgroundPosition = (a % 12) * 20 + '% 0';
    let h = '<span class="mark"></span>';
    const shown = Math.min(n, 5);
    for (let i = 0; i < shown; i++) {
      const lbl = (i === shown - 1 && n > 5) ? n : '';
      h += `<div class="ck ${v > 0 ? 'w' : 'b'}${i === shown - 1 ? ' topk' : ''}" style="${top ? 'top' : 'bottom'}:calc(var(--c)*${i}*.98 + 2px)">${lbl}</div>`;
    }
    el.innerHTML = h;
  }
  $('#offW').textContent = S.pos.off[0]; $('#offB').textContent = S.pos.off[1];
  $('#trayW').className = 'tray' + (dsts.has(-1) && S.cur === 0 ? ' dst' : '');
  $('#trayB').className = 'tray' + (dsts.has(-1) && S.cur === 1 ? ' dst' : '');
  let dh = '';
  if (S.openDice) { dh = dieHTML(S.openDice[0], '') + '<span style="font-size:11px">לבן · שחור</span>' + dieHTML(S.openDice[1], 'b'); }
  else if (S.diceAll.length > 2 && S.phase === 'move') { for (const v of [...new Set(S.diceAll)]) { const k = S.dice.filter(x => x === v).length; dh += dieHTML(v, (S.cur ? 'b' : '') + (k ? '' : ' used')) + `<b style="font-size:15px;margin-inline-end:6px">×${k}</b>`; } }
  else { const rem = S.dice.slice(); for (const d of S.diceAll) { const i = rem.indexOf(d); const used = S.phase === 'move' && i < 0; if (i >= 0) rem.splice(i, 1); dh += dieHTML(d, (S.cur ? 'b' : '') + (used ? ' used' : '')); } }
  $('#stripR').innerHTML = dh;
  $('#stripL').innerHTML = S.phase === 'over' ? '' : `תור:&nbsp;<b>${NAMES[S.cur]}${S.stolen ? ' (קוביות גנובות)' : ''}</b>`;
  const pips = pl => { let t = 0; const s = pl ? -1 : 1; for (let a = 0; a < 24; a++) { const n = S.pos.b[a] * s; if (n > 0) t += n * (24 - prog(pl, a)); } return t; };
  const dn = (DIFFS.find(d => d.id === prefs.diff) || DIFFS[0]).name;
  $('#status').innerHTML = `<span class="chip"><span class="dot" style="background:var(--w)"></span>לבן${S.mode === 'ai' ? ' (אתה)' : ''} · ${pips(0)} צעדים</span>
   <span class="chip"><span class="dot" style="background:var(--bk)"></span>שחור${S.mode === 'ai' ? ` (מחשב · ${dn})` : ''} · ${pips(1)} צעדים</span>
   <span class="chip ${S.active ? 'on' : ''}">דאבל הפוך: ${S.active ? 'פעיל' : 'עוד לא'}</span>`;
  $('#msg').textContent = S.msg;
  const A = $('#actions'); A.innerHTML = '';
  const btn = (t, f, c) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = f; if (c) b.className = c; A.appendChild(b); return b; };
  if (S.phase === 'start') btn('🎲 הטלת פתיחה', openingRoll, 'main');
  else if (S.phase === 'roll' && human(S.cur)) btn(`🎲 הטל קוביות (${NAMES[S.cur]})`, roll, 'main');
  else if (S.phase === 'choose' && human(S.cur)) S.opts.forEach((o, i) => btn(`${o[0]}-${o[0]}`, () => chooseOpt(i), 'opt main'));
  else if (S.phase === 'move' && human(S.cur)) { const b = btn('↶ בטל מהלכים', undo); b.disabled = !S.snap || S.pos.b.join() === S.snap.pos.b.join() && S.pos.off.join() === S.snap.pos.off.join(); }
  else if (S.phase === 'over') btn('שחק שוב', newGame, 'main');
  const ov = $('#board .over'); if (ov) ov.remove();
  if (S.phase === 'over') $('#board').insertAdjacentHTML('beforeend', `<div class="over"><div>🏆 ${NAMES[S.winner]} ניצח${S.mars ? '<br>מרס!' : ''}</div></div>`);
}

applyTheme(); build(); initModals(); newGame(); renderSettings();
