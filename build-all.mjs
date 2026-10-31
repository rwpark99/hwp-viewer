// 사용법: node build-all.mjs [hwp-viewer|simview|all]
// 결과: dist/<app>/ (웹앱 파일), dist/<app>.worker.js (Cloudflare 배포용 코드)
import fs from 'node:fs'; import zlib from 'node:zlib'; import { execFileSync } from 'node:child_process';
const want = process.argv[2] || 'all';
const apps = want === 'all' ? ['hwp-viewer', 'simview'] : [want];
const ifAF = (s, on, js) => js
  ? s.replace(/\/\/#if AF\n([\s\S]*?)\/\/#endif\n/g, (m, b) => on ? b : '')
  : s.replace(/<!--#if AF-->\n?([\s\S]*?)<!--#endif-->\n?/g, (m, b) => on ? b : '');
for (const a of apps) {
  let C = JSON.parse(fs.readFileSync(`apps/${a}.json`, 'utf8'));
  if (process.argv.includes('--release')) { // bump display version + cache for a new release
    if (/^v\d+$/.test(C.version)) { C.version = 'v' + (+C.version.slice(1) + 1); C.cache = `${C.prefix}-${C.version}`; }
    else { const [M, m] = C.version.split('.').map(Number); C.version = `${M}.${m + 1}`; C.cache = `${C.prefix}-v${C.version}.0`; }
    fs.writeFileSync(`apps/${a}.json`, JSON.stringify(C, null, 2) + '\n');
  } const D = `dist/${a}`;
  fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(D, { recursive: true });
  const sub = s => s.split('__PREFIX__').join(C.prefix).split('__CACHEV__').join(C.cache).split('__NAME__').join(C.short_name)
    .split('__WELCOME__').join(C.welcome).split('__APPV__').join(C.version).split('__NOTICES_TITLE__').join(C.notices_title);
  // app.js: 기능 플래그로 자동 채우기 코드를 빌드 단계에서 넣거나 뺌
  const tmp = `src/.app.${a}.js`; fs.writeFileSync(tmp, sub(ifAF(fs.readFileSync('src/app.js', 'utf8'), C.autofill, true)));
  try { execFileSync('node', ['build.mjs', tmp, `${D}/app.js`], { stdio: 'inherit' }); } finally { fs.rmSync(tmp); }
  const html = sub(ifAF(fs.readFileSync('src/index.html', 'utf8'), C.autofill, false));
  fs.writeFileSync(`${D}/index.html`, html.replace('<!--PWA-->', '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon-192.png"><link rel="apple-touch-icon" href="icon-192.png">').replace('<!--SCRIPT-->', `<script src="app.js?v=${C.version}"></script>`));
  fs.writeFileSync(`${D}/sw.js`, sub(fs.readFileSync('src/sw.js', 'utf8')));
  const mh = JSON.stringify({ ...(C.manifest.id ? { id: C.manifest.id } : {}), name: C.name, short_name: C.short_name, start_url: C.manifest.start_url, scope: C.manifest.scope }).slice(1, -1);
  fs.writeFileSync(`${D}/manifest.webmanifest`, fs.readFileSync('src/manifest.webmanifest', 'utf8').replace('__MANIFEST_HEAD__', mh));
  fs.writeFileSync(`${D}/THIRD_PARTY_NOTICES.txt`, sub(fs.readFileSync('src/THIRD_PARTY_NOTICES.txt', 'utf8')));
  fs.writeFileSync(`${D}/version.json`, JSON.stringify({ version: C.version }));
  for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) fs.copyFileSync('src/' + f, `${D}/${f}`);
  for (const f of ['icon-192.png', 'icon-512.png']) fs.copyFileSync(`${C.icons}/${f}`, `${D}/${f}`);
  // Cloudflare Worker 코드 (파일을 gzip 으로 담아 1개 스크립트로)
  const files = { '/index.html': 'text/html; charset=utf-8', '/app.js': 'application/javascript; charset=utf-8', '/sw.js': 'application/javascript; charset=utf-8', '/manifest.webmanifest': 'application/manifest+json', '/icon-192.png': 'image/png', '/icon-512.png': 'image/png', '/version.json': 'application/json', '/THIRD_PARTY_NOTICES.txt': 'text/plain; charset=utf-8', '/pdf.min.mjs': 'text/javascript; charset=utf-8', '/pdf.worker.min.mjs': 'text/javascript; charset=utf-8' };
  const F = Object.fromEntries(Object.entries(files).map(([p, ct]) => [p, [ct, zlib.gzipSync(fs.readFileSync(D + p), { level: 9 }).toString('base64')]]));
  const worker = `const F=${JSON.stringify(F)};const C={};
export default{async fetch(req){const u=new URL(req.url);let p=u.pathname;if(p==='/'||p==='')p='/index.html';
if(req.method==='POST'&&p==='/share')return new Response('Service worker not active yet. Open the app once, then share again.',{status:200,headers:{'content-type':'text/plain; charset=utf-8'}});
const f=F[p];if(!f)return new Response('Not found',{status:404});
if(!C[p]){const s=atob(f[1]);const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);C[p]=new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
return new Response(C[p],{headers:{'content-type':f[0],'cache-control':p==='/version.json'?'no-store':/\\.png$/.test(p)?'public, max-age=3600':'no-cache','x-content-type-options':'nosniff'}});}};`;
  const code = `async () => {
const W = ${JSON.stringify(worker)};
const name=${JSON.stringify(C.worker)}; const b='----F'+Date.now();
const meta={main_module:'worker.js',compatibility_date:'2026-10-01'};
const body=['--'+b,'Content-Disposition: form-data; name="metadata"','Content-Type: application/json','',JSON.stringify(meta),'--'+b,'Content-Disposition: form-data; name="worker.js"; filename="worker.js"','Content-Type: application/javascript+module','',W,'--'+b+'--',''].join('\\r\\n');
const up = await cloudflare.request({method:'PUT',path:\`/accounts/\${accountId}/workers/scripts/\${name}\`,body,contentType:'multipart/form-data; boundary='+b,rawBody:true});
const en = await cloudflare.request({method:'POST',path:\`/accounts/\${accountId}/workers/scripts/\${name}/subdomain\`,body:{enabled:true}}).catch(e=>String(e));
return {ok:up.success, name, en: en.success ?? en};
}`;
  fs.writeFileSync(`dist/${a}.worker.js`, code);
  console.log(a, C.version, 'autofill=' + C.autofill, '→', D, `dist/${a}.worker.js`, code.length);
}
