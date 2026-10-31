// Images → view + single PDF, fully on-device. Self-written minimal PDF writer (JPEG/DCTDecode), no dependency.
export const IMG_RE = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export async function isImage(file) {
  if (IMG_RE.test(file.name || '') || /^image\//.test(file.type || '')) return true;
  try { const h = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (h[0] === 0xFF && h[1] === 0xD8) return true; if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E) return true;
    if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46) return true; if (h[0] === 0x42 && h[1] === 0x4D) return true;
    if (h[0] === 0x52 && h[1] === 0x49 && h[8] === 0x57 && h[9] === 0x45) return true;                // RIFF....WEBP
    if (String.fromCharCode(...h.slice(4, 8)) === 'ftyp' && /hei|mif|avi|hev/.test(String.fromCharCode(...h.slice(8, 12)))) return true;
  } catch (e) {}
  return false;
}
const heic = f => /\.(heic|heif)$/i.test(f.name || '') || /heic|heif/.test(f.type || '');
// decode with EXIF orientation applied (browsers honour EXIF by default; imageOrientation makes it explicit)
async function decode(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { const u = URL.createObjectURL(file); try { const im = new Image(); im.src = u; await im.decode(); return im; } finally { setTimeout(() => URL.revokeObjectURL(u), 5000); } }
}
const MAXPX = 2000, Q = 0.82;  // ~240 dpi on A4 — sharp for documents, small files
async function toJpeg(file) {
  const b = await decode(file); const w0 = b.width, h0 = b.height, s = Math.min(1, MAXPX / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(b, 0, 0, w, h); if (b.close) b.close();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', Q)); return { w, h, data: new Uint8Array(await blob.arrayBuffer()) };
}
export function buildPdf(imgs) {   // imgs: [{w,h,data}] → Uint8Array (A4 portrait, or landscape for wide images)
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const put = x => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; };
  const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put('\nendobj\n'); };
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'); const N = imgs.length, kids = [];
  for (let i = 0; i < N; i++) kids.push(`${3 + i * 3} 0 R`);
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put(`<< /Type /Pages /Count ${N} /Kids [${kids.join(' ')}] >>`));
  imgs.forEach((im, i) => {
    const p = 3 + i * 3, land = im.w > im.h * 1.15, PW = land ? 842 : 595, PH = land ? 595 : 842, M = 24;
    const s = Math.min((PW - 2 * M) / im.w, (PH - 2 * M) / im.h), dw = im.w * s, dh = im.h * s, dx = (PW - dw) / 2, dy = (PH - dh) / 2;
    const cs = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /Im0 Do Q`;
    obj(p, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`));
    obj(p + 1, () => put(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(p + 2, () => { put(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`); put(im.data); put('\nendstream'); });
  });
  const n = 3 + N * 3, xref = len; let x = `xref\n0 ${n}\n0000000000 65535 f \n`;
  for (let i = 1; i < n; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  put(x + `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len); let o = 0; for (const u of parts) { out.set(u, o); o += u.length; } return out;
}
let cur = [];
export async function showImages(files, ui) {   // ui: {$, status, toast, setTitle}
  const { $ } = ui; cur = files.slice(); const doc = $('#doc'); doc.classList.remove('pdf', 'word', 'docx'); doc.classList.add('imgs');
  const st = $('#status'); st.textContent = '그림 여는 중… ' + files.length + '개'; st.hidden = false;
  let html = `<p class="imgn">그림 ${files.length}개 · 고른 순서대로 PDF 한 파일로 저장할 수 있어요.</p><p><button id="img2pdf" class="imgpdf">📑 PDF로 저장 (${files.length}쪽)</button></p>`, bad = [];
  for (let i = 0; i < files.length; i++) { const f = files[i]; let ok = true;
    try { const b = await decode(f); if (b.close) b.close(); } catch (e) { ok = false; bad.push(f.name); }
    html += `<figure class="imgf" data-i="${i}"><figcaption>${i + 1}. ${esc(f.name)}</figcaption>` + (ok ? `<img alt="" src="${URL.createObjectURL(f)}">` : `<p class="imgbad">${heic(f) ? 'HEIC(아이폰 사진)는 이 기기 브라우저에서 열 수 없어요. 카메라 설정을 "호환성 우선(JPG)"으로 바꾸거나 JPG로 보내 주세요.' : '이 그림은 열 수 없어요.'}</p>`) + '</figure>'; }
  doc.innerHTML = html; st.hidden = true;
  const good = files.filter(f => !bad.includes(f.name)); cur = good;
  const btn = $('#img2pdf'); btn.hidden = !good.length; btn.textContent = `📑 PDF로 저장 (${good.length}쪽)`;
  btn.onclick = () => savePdf(good, ui);
  return { ok: good.length, bad };
}
export async function savePdf(files, ui) {
  const st = ui.$('#status'); const imgs = [];
  for (let i = 0; i < files.length; i++) { st.textContent = `PDF 만드는 중… ${i + 1}/${files.length}`; st.hidden = false; imgs.push(await toJpeg(files[i])); }
  const pdf = buildPdf(imgs); window.__lastPdf = pdf;
  const nm = (files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : '그림모음_' + new Date().toISOString().slice(0, 10)) + '.pdf';
  const blob = new Blob([pdf], { type: 'application/pdf' }); const f = new File([blob], nm, { type: 'application/pdf' });
  st.hidden = true;
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nm; document.body.appendChild(a); a.click(); a.remove();
  ui.toast(`${nm} 저장 (${files.length}쪽, ${(pdf.length / 1048576).toFixed(1)} MB) — 다운로드 폴더를 확인하세요`, 4500);
  return f;
}
