# HWP 뷰어

HWP·HWPX·PDF·DOC·DOCX·ZIP 파일을 폰 브라우저에서 바로 여는 웹앱(PWA)입니다.

- 바로 쓰기: https://hwp-viewer.rwpark-hwp.workers.dev/
- 파일은 기기 안에서만 변환합니다 (서버 전송 없음).
- PDF 저장, 앱 설치, 공유 메뉴로 열기를 지원합니다.
- 서식 자동 채우기: 날짜·성명·소속 등을 빈칸에 넣어 줍니다. 입력값은 폰에만 암호화해 저장합니다.

## 빌드
```
npm install
node build.mjs src/app.js dist/app.js && node pack.mjs && node mkworker.mjs
```

## 라이선스
MIT (LICENSE). 사용한 오픈소스의 라이선스는 THIRD_PARTY_NOTICES.txt 참고.
