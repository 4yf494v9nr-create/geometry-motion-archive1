# Geometry Motion — 수능 기하 3D 풀이 아카이브

학년도·시험·번호별로 11개 공간도형 기출 문항을 분류하고, 현재 3개 문항에서 검산된 해설과 Canvas 3D 도형을 제공합니다.

- **분류된 문제:** 11개 (2022~2027학년도)
- **단계별 3D 풀이:** 2022학년도 9월 27번, 2025학년도 9월 28번, 2027학년도 9월 28번
- **아직 풀이 미완료:** 8개 (준비 중 표시)
- **API 비용:** 방문자의 열람에는 외부 AI API 호출 없음
- **호환:** 휴대폰, 태블릿, PC 브라우저
- **영상 녹화:** MediaRecorder 지원 브라우저에서 WebM/MP4 저장
- **출처:** 한국교육과정평가원 (원문 이미지 대신 재구성한 개략도와 해설 데이터 제공)

## GitHub Pages로 공개하기 (휴대폰 가능)

1. 저장소 [Settings → Pages](https://github.com/4yf494v9nr-create/geometry-motion-archive1/settings/pages)로 이동
2. **Build and deployment**에서 **Source: Deploy from a branch**를 선택
3. **Branch: main**, 폴더 **/(root)** 선택 후 **Save**
4. 배포 후 GitHub Pages 화면에 표시되는 **Visit site** 주소로 접속

GitHub Pages에서 배포가 시작되어야 공개 사이트가 생성됩니다. 이 저장소가 공개(Public)로 되어 있어야 무료 Pages를 사용할 수 있습니다.

예상 주소 형식은 `https://4yf494v9nr-create.github.io/geometry-motion-archive1/`입니다. **Pages를 활성화하고 실제 게시가 확인되기 전에는 유효한 사이트 주소가 아닙니다.**

## Render 배포

Render 정적 사이트 생성은 결제 정보 등록이 요구되어 아직 성공하지 않았습니다. Render를 쓰려면 [Render Billing](https://dashboard.render.com/billing)을 확인해야 합니다.

## 파일 구성

- `index.html` / `site.js` / `style.css`: 문제 검색·분류 화면
- `viewer.html` / `viewer.js`: Canvas 3D 회전·단계별 풀이·영상 저장
- `data/problems.json`: 문항 목록과 풀이 공개 상태
- `data/lessons.json`: 3개 문항의 검산된 풀이 및 3D 장면

교육용 비공식 프로젝트입니다. 문제 원문 저작권은 한국교육과정평가원에 있습니다.
