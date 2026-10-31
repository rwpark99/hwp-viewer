// "앱 공유": send this app's link (KakaoTalk/문자 via Web Share), copy it, or show a QR code. On-device only.
import qrcode from 'qrcode-generator';
export function initShare(cfg, $, toast) {
  const text = `[${cfg.title}] ${cfg.desc}`;
  const d = document.createElement('div'); d.id = 'sharedlg'; d.hidden = true;
  const qr = qrcode(0, 'M'); qr.addData(cfg.url); qr.make();
  d.innerHTML = `<div class="box"><h3>🔗 ${cfg.title} 공유</h3><p class="sd">${text}</p><div class="qr">${qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}</div><p class="sq">휴대폰 카메라로 QR을 찍으면 바로 열려요</p><p class="su">${cfg.url}</p>
<div class="btns"><button id="sharesend" class="ok">📤 카톡·문자로 보내기</button><button id="sharecopy" class="cancel">📋 링크 복사</button></div><button id="shareclose" class="cl">닫기</button></div>`;
  document.body.appendChild(d);
  const open = () => { d.hidden = false; }, close = () => { d.hidden = true; };
  const copy = async () => { const all = text + '\n' + cfg.url;
    try { await navigator.clipboard.writeText(all); } catch (e) { const t = document.createElement('textarea'); t.value = all; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e2) {} t.remove(); }
    toast('링크를 복사했어요. 카톡·문자 창에 붙여넣기 하세요', 3000); };
  $('#sharesend').onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: cfg.title, text, url: cfg.url }); close(); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    copy(); };
  $('#sharecopy').onclick = copy; $('#shareclose').onclick = close; d.onclick = e => { if (e.target === d) close(); };
  document.querySelectorAll('.sharebtn').forEach(b => b.onclick = open);
  window.__shareOpen = () => !d.hidden; window.__shareClose = close; window.__shareCopy = copy;
}
