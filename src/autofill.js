// 자동 채우기 — 값은 이 휴대폰의 localStorage 에만 저장 (서버 전송 없음)
const KEY = 'hwpview-autofill';
const F = [
  ['org', '소속', /^(소속|소속기관|기관|기관명|직장|근무처)$/],
  ['name', '성명', /^(성명|이름|성함)$/],
  ['rrn', '주민등록번호', /^(주민등록번호|주민번호)$/],
  ['addr', '주소', /^(주소|주소지|현주소)$/],
  ['bank', '은행', /^(은행|은행명|거래은행|급여거래은행)$/],
  ['acct', '계좌번호', /^(계좌번호|계좌)$/],
  ['date', '날짜', /^(날짜|일자|작성일|작성일자)$/],
];
const norm = s => s.replace(/[\s\u00a0\u2003\u2007:：()（）*※]/g, '');
const fieldOf = s => { const n = norm(s); const f = F.find(f => f[2].test(n)); return f && f[0]; };
const OLD = KEY, ENC = 'hwpview-autofill-enc', ITER = 310000;
const SENS = ['rrn', 'acct', 'addr'];
let KEYC = null, SALT = null, DATA = null; const SESS = {};
const b64 = u => btoa(String.fromCharCode(...new Uint8Array(u)));
const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function derive(pin, salt) { const m = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, m, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
async function encSave(obj) { const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, KEYC, new TextEncoder().encode(JSON.stringify(obj)));
  localStorage.setItem(ENC, JSON.stringify({ v: 1, iter: ITER, salt: b64(SALT), iv: b64(iv), ct: b64(ct) })); localStorage.removeItem(OLD); }
async function unlock(pin) { const e = JSON.parse(localStorage.getItem(ENC)); const salt = ub64(e.salt); const k = await derive(pin, salt);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(e.iv) }, k, ub64(e.ct)); KEYC = k; SALT = salt; DATA = JSON.parse(new TextDecoder().decode(pt)); }
async function setPin(pin) { SALT = crypto.getRandomValues(new Uint8Array(16)); KEYC = await derive(pin, SALT); }
export const wipe = () => { localStorage.removeItem(ENC); localStorage.removeItem(OLD); KEYC = SALT = DATA = null; for (const k in SESS) delete SESS[k]; };
export const __state = () => ({ unlocked: !!KEYC, DATA, SESS });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const ymd = iso => { const [y, m, d] = (iso || today()).split('-').map(Number); return { y, m, d }; };
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const span = v => `<span class="af" contenteditable="true">${esc(v)}</span>`;

export function fill(root, d) {
  const val = k => k === 'date' ? (({ y, m, d: dd }) => `${y}. ${m}. ${dd}.`)(ymd(d.date)) : (d[k] || '').trim();
  const done = new Set(); let n = 0;
  // 1) 표: 라벨 칸 아래/오른쪽 빈 칸
  root.querySelectorAll('table').forEach(t => {
    const grid = []; const rows = [...t.rows];
    rows.forEach((r, ri) => { grid[ri] = grid[ri] || []; let ci = 0;
      for (const c of r.cells) { while (grid[ri][ci]) ci++; const rs = c.rowSpan || 1, cs = c.colSpan || 1;
        for (let a = 0; a < rs; a++) for (let b = 0; b < cs; b++) { (grid[ri + a] = grid[ri + a] || [])[ci + b] = c; } ci += cs; } });
    const isEmpty = c => !c.querySelector('table,img') && !norm(c.textContent);
    const put = (c, k) => { const v = val(k); if (!v || c.dataset.af) return; c.innerHTML = span(v); c.dataset.af = k; c.classList.remove('emp'); done.add(k); n++; };
    grid.forEach((row, ri) => row.forEach((c, ci) => {
      if (!c || !isEmpty(c) || c.dataset.af) return;
      for (let up = ri - 1; up >= 0; up--) { const l = grid[up][ci]; if (!l || l === c) continue; if (isEmpty(l)) continue; const k = fieldOf(l.textContent); if (k) put(c, k); break; }
      if (!c.dataset.af && ci > 0) { const l = row[ci - 1]; if (l && l !== c && !isEmpty(l) && l.children.length < 2) { const k = fieldOf(l.textContent); if (k) put(c, k); } }
    }));
  });
  // 2) 본문 줄: "성 명 :", "년 월 일", "20 . . .", "(성명)"
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
  const lab = '(소\\s*속(?:\\s*기\\s*관)?|기\\s*관\\s*명?|성\\s*명|이\\s*름|주\\s*소|주\\s*민\\s*등\\s*록\\s*번\\s*호|은\\s*행\\s*명?|계\\s*좌\\s*번\\s*호|일\\s*자|날\\s*짜|작\\s*성\\s*일(?:\\s*자)?)';
  const reLab = new RegExp(`^(\\s*${lab}\\s*[:：])[\\s\\u00a0_]*((?:\\(?(?:인|서명[^)]*|날인)\\)?)?\\s*)$`);
  for (const t of nodes) {
    if (t.parentElement.closest('.af')) continue;
    const s = t.nodeValue; let h = null;
    let m = s.match(reLab);
    if (m) { const k = fieldOf(m[2]); const v = k && (k === 'date' ? (({ y, m: mm, d: dd }) => `${y}년 ${mm}월 ${dd}일`)(ymd(d.date)) : val(k)); if (v) { h = esc(m[1]) + ' ' + span(v) + (m[3].trim() ? '   ' + esc(m[3].trim()) : ''); done.add(k); } }
    else if (/^\s*(20\s*|19\s*)?년\s+월\s+일\s*$/.test(s)) { const { y, m: mm, d: dd } = ymd(d.date); h = span(`${y}년 ${mm}월 ${dd}일`); done.add('date'); }
    else if (/(^|\s)20\s*\.\s*\.\s*\.?\s*$/.test(s)) { h = esc(s.replace(/20\s*\.\s*\.\s*\.?\s*$/, '')) + span(val('date')); done.add('date'); }
    else if (/\(성\s*명\)/.test(s) && val('name')) { h = esc(s).replace(/\(성\s*명\)\s*/, m0 => m0.trimEnd() + ' ' + span(val('name')) + ' '); done.add('name'); }
    if (h != null) { const w = document.createElement('span'); w.innerHTML = h; t.replaceWith(...w.childNodes); n++; }
  }
  // 3) 문단 단위(Word: 글자 조각이 여러 span 으로 나뉜 경우)
  root.querySelectorAll('p, li').forEach(p => {
    if (p.querySelector('.af, table') || p.closest('.af')) return;
    const m = p.textContent.match(reLab); if (!m) return;
    const k = fieldOf(m[2]); const v = k && (k === 'date' ? (({ y, m: mm, d: dd }) => `${y}년 ${mm}월 ${dd}일`)(ymd(d.date)) : val(k)); if (!v) return;
    const ts = []; const w2 = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); while (w2.nextNode()) ts.push(w2.currentNode);
    let at = -1; for (let i = 0; i < ts.length; i++) if (/[:：]/.test(ts[i].nodeValue)) { at = i; break; } if (at < 0) return;
    const t0 = ts[at]; const ci = t0.nodeValue.search(/[:：]/);
    const after = t0.nodeValue.slice(ci + 1).replace(/[_\u00a0]+/g, ' ').replace(/^\s+/, ''); t0.nodeValue = t0.nodeValue.slice(0, ci + 1) + ' ';
    const sp = document.createElement('span'); sp.innerHTML = span(v); const el = sp.firstChild; t0.after(el);
    if (after) el.after(document.createTextNode(' ' + after));
    for (let i = at + 1; i < ts.length; i++) ts[i].nodeValue = ts[i].nodeValue.replace(/_+/g, ' ').replace(/^\s{2,}/, ' ');
    done.add(k); n++;
  });
  // 남은 밑줄 빈칸 지우기 (채운 문단 안)
  root.querySelectorAll('.af').forEach(a => { const p = a.closest('p, li, td, th'); if (!p) return; const w3 = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); const ts = []; while (w3.nextNode()) ts.push(w3.currentNode); ts.forEach(t => { if (!t.parentElement.closest('.af') && /_{3,}/.test(t.nodeValue)) t.nodeValue = t.nodeValue.replace(/_{3,}/g, ' '); }); });
  return { n, fields: [...done] };
}

function box(html) { let dlg = document.getElementById('afdlg');
  if (!dlg) { dlg = document.createElement('div'); dlg.id = 'afdlg'; document.body.appendChild(dlg); }
  dlg.innerHTML = `<div class="afbox">${html}</div>`; dlg.hidden = false; return dlg; }
const close = () => { const d = document.getElementById('afdlg'); if (d) d.hidden = true; };
const INTRO = '<p class="afintro">✍️ <b>채우기</b>: 서식의 날짜·성명·소속·주소·주민등록번호·은행·계좌번호 칸을 이 폰에 저장한 내 정보로 자동으로 채워 줍니다. 정보는 이 폰에만 암호화되어 저장되고, PIN으로 열어 씁니다. 서버로 보내지 않습니다.</p>';
const NOTE = '<p class="afnote">🔒 정보는 <b>이 휴대폰에만</b> 저장되며 PIN 으로 암호화(AES-GCM)됩니다. 서버로 보내지 않습니다.</p>';
// PIN 입력/설정. mode: 'unlock' | 'set' | 'migrate'
function pinBox(mode, done) {
  const t = { unlock: '🔑 PIN 입력', set: '🔑 PIN 만들기 (숫자 4자리 이상)', migrate: '🔑 PIN 만들기 — 이전에 저장한 정보를 암호화합니다' }[mode];
  const dlg = box(`<h3>${t}</h3>${INTRO}<label>PIN<input id="afpin" type="password" inputmode="numeric" autocomplete="off"></label>
   ${mode !== 'unlock' ? '<label>PIN 확인<input id="afpin2" type="password" inputmode="numeric" autocomplete="off"></label>' : ''}
   <p id="aferr" class="aferr"></p>
   <div class="afbtns">${mode === 'unlock' ? '<button id="afreset">초기화</button>' : ''}<button id="afcancel">${mode === 'set' ? '저장 안 함' : '닫기'}</button><button id="afgo">확인</button></div>
   ${mode === 'unlock' ? '<p class="afnote">PIN 을 잊었으면 [초기화] — 저장된 정보가 모두 지워집니다.</p>' : ''}`);
  const err = m => dlg.querySelector('#aferr').textContent = m;
  dlg.querySelector('#afcancel').onclick = () => { close(); done(false); };
  const r = dlg.querySelector('#afreset'); if (r) r.onclick = () => { if (confirm('저장된 자동 채우기 정보를 모두 지울까요?')) { wipe(); close(); done('reset'); } };
  dlg.querySelector('#afgo').onclick = async () => {
    const p = dlg.querySelector('#afpin').value;
    if (!/^\d{4,}$/.test(p)) return err('숫자 4자리 이상을 입력하세요.');
    if (mode === 'unlock') { err('확인 중…'); try { await unlock(p); close(); done(true); } catch { err('PIN 이 틀렸습니다.'); } return; }
    if (p !== dlg.querySelector('#afpin2').value) return err('PIN 이 서로 다릅니다.');
    err('암호화 중…'); await setPin(p);
    if (mode === 'migrate') { let old = {}; try { old = JSON.parse(localStorage.getItem(OLD)) || {}; } catch {} delete old._dateFixed; DATA = { ...old, keep: { rrn: true, acct: true, addr: true } }; await encSave(DATA); }
    close(); done(true);
  };
  setTimeout(() => dlg.querySelector('#afpin').focus(), 50);
}
export function openSettings(onFill) {
  if (localStorage.getItem(OLD) && !localStorage.getItem(ENC)) return pinBox('migrate', ok => ok ? openSettings(onFill) : null);
  if (localStorage.getItem(ENC) && !KEYC) return pinBox('unlock', ok => ok ? openSettings(onFill) : null);
  const d = { ...(DATA || {}), ...SESS }; const keep = (DATA && DATA.keep) || {};
  const inp = (k, lab, ph = '', type = 'text') => `<label>${lab}${SENS.includes(k) ? `<span class="afkeep"><input type="checkbox" data-keep="${k}" ${keep[k] ? 'checked' : ''}> 이 폰에 저장</span>` : ''}<input data-k="${k}" type="${type}" placeholder="${ph}" value="${esc(k === 'date' ? today() : (d[k] || ''))}"></label>`;
  const dlg = box(`<h3>✍ 자동 채우기</h3>${INTRO}
  ${inp('date', '날짜', '', 'date')}${inp('name', '성명')}${inp('org', '소속')}${inp('addr', '주소')}${inp('rrn', '주민등록번호', '000000-0000000')}${inp('bank', '은행')}${inp('acct', '계좌번호')}
  <p class="afnote">‘이 폰에 저장’을 끈 항목은 앱을 닫으면 잊혀 다음에 다시 입력해야 합니다.</p>
  <div class="afbtns"><button id="afclear">초기화</button><button id="afcancel">닫기</button><button id="afgo">채우기</button></div>
  <p class="afnote">채운 글씨는 노란 표시로 보이며 눌러서 고칠 수 있습니다. 확인 후 📄 PDF 로 저장하세요.</p>`);
  dlg.querySelector('#afcancel').onclick = close;
  dlg.querySelector('#afclear').onclick = () => { if (confirm('저장된 자동 채우기 정보와 PIN 을 모두 지울까요?')) { wipe(); dlg.querySelectorAll('input[data-k]').forEach(i => { if (i.dataset.k !== 'date') i.value = ''; }); dlg.querySelectorAll('input[data-keep]').forEach(i => i.checked = false); } };
  dlg.querySelector('#afgo').onclick = () => {
    const o = {}; dlg.querySelectorAll('input[data-k]').forEach(i => o[i.dataset.k] = i.value.trim());
    const kp = {}; dlg.querySelectorAll('input[data-keep]').forEach(i => kp[i.dataset.keep] = i.checked);
    const store = { name: o.name, org: o.org, bank: o.bank, keep: kp }; SENS.forEach(k => { if (kp[k]) store[k] = o[k]; });
    SENS.forEach(k => { if (!kp[k]) SESS[k] = o[k]; else delete SESS[k]; });
    const go = async () => { if (KEYC) { DATA = store; await encSave(store); } close(); onFill(o); };
    if (KEYC) go(); else pinBox('set', ok => { if (ok) go(); else { Object.assign(SESS, o); delete SESS.date; onFill(o); } });
  };
}
