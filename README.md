# PDF Editor

Windows용 PDF 뷰어·편집기입니다. 문서 읽기부터 주석 작성, 페이지 정리까지 한 공간에서 작업할 수 있습니다. Electron + React + [MuPDF.js](https://mupdf.com/) 기반이며, 개인·사내·지인 사용을 목적으로 만들었습니다.

네이비·민트 테마와 Pretendard 글꼴을 적용했으며, 최근 문서 화면과 탭으로 여러 PDF를 관리합니다. 글꼴은 프로그램에 포함되어 별도 설치 없이 적용됩니다.

> 작업 대시보드: <https://bossxor.github.io/works-dashboard/>

## 다운로드

현재 버전은 **v0.1.1**입니다. [최신 릴리즈](https://github.com/bossxor/tool_PDF_Editor/releases/latest)에서 받을 수 있습니다.

- [설치 버전 다운로드](https://github.com/bossxor/tool_PDF_Editor/releases/download/v0.1.1/PDF.Editor.Setup.exe) — 바로가기 생성, `.pdf` 연결 프로그램 등록
- [포터블 버전 다운로드](https://github.com/bossxor/tool_PDF_Editor/releases/download/v0.1.1/PDF.Editor.exe) — 설치 없이 실행

기존 설치 버전은 프로그램을 종료한 뒤 새 설치 파일로 업데이트하세요. 포터블 버전은 새 실행 파일로 교체한 뒤 실행하면 됩니다.

코드 서명이 되어 있지 않아 Windows SmartScreen 경고가 뜰 수 있습니다.

## v0.1.1 변경 사항

- 시작 화면, 최근 문서 카드, 문서 헤더, 도구 모음과 상태 표시줄 디자인 개선
- Pretendard 글꼴 내장 및 제목·본문 타이포그래피 조정
- 페이지 번호·썸네일로 화면 밖 페이지를 선택했을 때 이동하지 않는 문제 수정
- 문서를 연 뒤 창 크기에 맞춰 화면 맞춤이 적용되도록 수정
- 실제 확대율 표시와 확대·축소 범위(10–800%) 수정
- 이벤트 중복 등록 방지, 문서 열기·인쇄 실패 안내 개선
- 배포 빌드 시 프로젝트 최상위 실행 파일 자동 갱신

## 기능

**보기**
- 여러 PDF를 탭으로 열기, 파일 끌어다 놓기, 파일 연결로 열기
- 텍스트 선택·복사, 검색(페이지 위 하이라이트), 목차, 썸네일
- 확대/축소, 폭·페이지 맞춤, 두 페이지씩 보기, 페이지 번호 입력 이동, 전체화면(F11)
- 암호가 걸린 PDF 열기, 인쇄, 시작 화면의 최근 파일, 지난번 탭 복원
- 기본은 읽기 전용 뷰어이며, 우측 상단 **편집** 버튼으로 편집 모드에 들어갑니다.
- 문서 헤더에서 검색을 열고, 상태 표시줄에서 현재 페이지와 읽기·편집 모드를 확인할 수 있습니다.

**편집**
- 형광펜·밑줄·취소선: 텍스트를 드래그해 선택하면 뜨는 툴바에서 적용하거나, 도구를 켠 채 연속으로 드래그
- 사각형·원·선·펜·텍스트 상자·메모, 테두리색·채우기색·두께·투명도 지정
- 도형 선택 후 이동, 크기 조절 핸들, 방향키 미세 이동, 복사·붙여넣기
- 텍스트 상자 글자색·크기·배경색·테두리색
- 실행 취소/다시 실행, 암호 설정·해제 저장

**페이지**
- 회전, 복제, 삭제, 드래그로 순서 변경
- 다른 PDF 삽입(병합), 페이지 범위를 새 PDF로 추출(분할)

## 단축키

| 키 | 동작 |
| --- | --- |
| Ctrl+O / Ctrl+S / Ctrl+Shift+S | 열기 / 저장 / 다른 이름으로 저장 |
| Ctrl+P | 인쇄 |
| Ctrl+F | 검색 |
| Ctrl+Z / Ctrl+Y | 실행 취소 / 다시 실행 |
| Ctrl+W, Ctrl+Tab | 탭 닫기 / 탭 전환 |
| Ctrl+Shift+Tab | 이전 탭으로 전환 |
| Ctrl+마우스 휠 | 확대 / 축소 |
| F11 | 전체화면 |
| V R O L P X N | (편집 모드) 선택·사각형·원·선·펜·텍스트 상자·메모 |
| Delete, 방향키, Ctrl+C / Ctrl+V | (도형 선택 시) 삭제, 이동, 복사 / 붙여넣기 |

## 개발

```bash
npm install
npm run dev        # 개발 실행
npm run typecheck  # 타입 검사
npm run build      # 앱 빌드 (out/)
npm run test:ui    # 빌드 + 숨겨진 Electron 창에서 UI 회귀 검증
npm run dist       # 설치 프로그램 + 포터블 exe 빌드 (dist/)
```

배포 빌드가 완료되면 프로젝트 최상위의 `PDF Editor.exe`와 `PDF Editor Setup.exe`도 최신 결과로 자동 갱신됩니다. `dist/`에는 버전 번호가 포함된 설치·포터블 파일과 `win-unpacked/`가 생성됩니다.

UI 회귀 검증은 테스트 문서 데이터를 사용해 시작 화면, 글꼴 로드, Ctrl+O 열기, 페이지 이동, 창 크기 변경 시 화면 맞춤, 확대율 표시, 검색 버튼을 확인합니다. 화면 캡처는 `.verification/`에 저장됩니다.

## 라이선스

프로젝트 라이선스는 **AGPL-3.0-or-later**입니다. 포함된 Pretendard 글꼴은 **SIL Open Font License 1.1**을 따릅니다. [글꼴 저작권 및 라이선스](src/renderer/public/Pretendard-LICENSE.txt)는 배포 프로그램에도 포함됩니다.

설계 문서와 작업 현황은 [DESIGN.md](DESIGN.md)에 있습니다. 설치 프로그램은 Git LFS로 관리합니다.
