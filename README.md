# PDF Editor

Windows용 PDF 뷰어·편집기입니다. Electron + React + [MuPDF.js](https://mupdf.com/) 기반이며, 개인·사내·지인 사용을 목적으로 만들었습니다.

> 작업 대시보드: <https://bossxor.github.io/works-dashboard/>

## 다운로드

[Releases](https://github.com/bossxor/tool_PDF_Editor/releases/latest)에서 받을 수 있습니다.

- **PDF Editor Setup.exe** — 설치 프로그램 (바로가기 생성, `.pdf` 연결 프로그램 등록)
- **PDF Editor.exe** — 설치 없이 실행하는 포터블

코드 서명이 되어 있지 않아 Windows SmartScreen 경고가 뜰 수 있습니다.

## 기능

**보기**
- 여러 PDF를 탭으로 열기, 파일 끌어다 놓기, 파일 연결로 열기
- 텍스트 선택·복사, 검색(페이지 위 하이라이트), 목차, 썸네일
- 확대/축소, 폭·페이지 맞춤, 두 페이지씩 보기, 페이지 번호 입력 이동, 전체화면(F11)
- 암호가 걸린 PDF 열기, 인쇄, 시작 화면의 최근 파일, 지난번 탭 복원
- 기본은 읽기 전용 뷰어이며, 우측 상단 **편집** 버튼으로 편집 모드에 들어갑니다.

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
| F11 | 전체화면 |
| V R O L P X N | (편집 모드) 선택·사각형·원·선·펜·텍스트 상자·메모 |
| Delete, 방향키, Ctrl+C / Ctrl+V | (도형 선택 시) 삭제, 이동, 복사 / 붙여넣기 |

## 개발

```bash
npm install
npm run dev        # 개발 실행
npm run typecheck  # 타입 검사
npm run dist       # 설치 프로그램 + 포터블 exe 빌드 (dist/)
```

설계 문서와 작업 현황은 [DESIGN.md](DESIGN.md)에 있습니다. 설치 프로그램은 Git LFS로 관리합니다.
