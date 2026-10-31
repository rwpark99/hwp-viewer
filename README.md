# HWP 뷰어 / 심뷰 (하나의 코드베이스)

휴대폰에서 HWP·HWPX·PDF·Word 문서를 보는 PWA 두 가지를 이 저장소 하나에서 만듭니다.

| 앱 | 설정 | 주소 | 특징 |
|---|---|---|---|
| HWP 뷰어 | `apps/hwp-viewer.json` | https://hwp-viewer.rwpark-hwp.workers.dev/ | 자동 채우기 포함 (개인정보는 휴대폰에만 암호화 저장, 서버 전송 없음) |
| 심뷰 (심평원용) | `apps/simview.json` | https://simview.rwpark-hwp.workers.dev/ | 자동 채우기 코드 자체가 빌드에서 빠짐, 버전 1.0 |

## 빌드

```
npm install
node build-all.mjs all          # 둘 다
node build-all.mjs hwp-viewer   # HWP 뷰어만
node build-all.mjs simview      # 심뷰만
```

결과: `dist/<앱>/` (정적 파일) 과 `dist/<앱>.worker.js` (Cloudflare Worker 한 파일).

## 구조
- `src/` 공통 소스. `//#if AF … //#endif`, `<!--#if AF-->…<!--#endif-->` 구간은 `autofill: true` 앱에만 들어갑니다.
- `__NAME__`, `__PREFIX__`, `__CACHEV__` 등 자리표시자는 앱 설정 값으로 바뀝니다.
- `apps/<앱>/` 아이콘.

## 라이선스
MIT (`LICENSE`, © 2026 RW PARK · rwpark@mail.grokbot.com). 사용한 오픈소스 목록과 전문은 `src/THIRD_PARTY_NOTICES.txt` (앱 안 "오픈소스 라이선스"에서도 볼 수 있음).
