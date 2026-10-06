# PDF Editor 설계서 (v0.3 — 멀티탭 구현 반영)

> **구현 현황(2026-09-23):** 1~5단계(뷰어/비밀번호/인쇄/주석/페이지 관리) + 멀티탭 + exe 패키징 완료.
> 엔진은 탭마다 별도의 `EngineSession` 인스턴스로 분리되어 있고(`src/main/engine.ts`),
> 렌더러는 탭마다 독립된 Zustand 스토어 묶음(`TabBundle`)을 가진다(`src/renderer/src/tabs/`).
> **다음 작업 (TODO)**
> - [x] 도형 크기 조절 핸들 / PDF 병합 / PDF 분할 (v0.1.0 릴리스에 포함)
> - [ ] 새 빌드 실사용 확인 — 확대·축소 중 선택 유지, 도형 그린 뒤 바로 선택·이동·크기 조절, 병합/분할 (문제 발견 시 수정)
> - [x] 검색 결과를 페이지 위에 하이라이트 (전체 노랑, 현재 결과 주황, 멀리 있는 페이지도 이동)
> - [ ] 텍스트 상자 모양 직접 생성 — 테두리색을 글자색과 분리, 한글 자간/줄바꿈 정리 (MuPDF 외형 스트림을 직접 만들어야 해서 보류)
> - [ ] 병합 시 암호 걸린 PDF 지원 (현재는 안내 메시지 후 거부)
> - [x] 펜(자유 그리기) 크기 조절 핸들
> - [x] 종료/탭 닫기/페이지 삭제 확인창을 앱 디자인에 맞는 `ConfirmDialog`로 교체 (종료 시 "모두 저장 후 종료" 지원)
> **UI**: 다크 테마 디자인 시스템(`src/renderer/src/styles.css`의 CSS 변수)과 인라인 SVG 아이콘 세트(`src/renderer/src/ui/icons.tsx`)로 전면 재구성.
> **앱 아이콘**: `build/icon.svg` 원본 → `sharp`+`png-to-ico`로 `build/icon.ico`(16~256px 멀티 사이즈) 생성, `package.json`의 `build.win.icon`에 연결. `npm run icon`으로 재생성.
> **텍스트 상자/메모**: `prompt()` 대신 인라인 textarea 편집(그리기 직후 자동 진입, 기존 주석은 더블클릭으로 재진입, Esc 취소·포커스 아웃 저장).
> **형광펜/밑줄/취소선**: 두 가지 경로 — (1) 선택 도구로 텍스트 드래그 선택 → 뜨는 플로팅 툴바에서 클릭, (2) 도구모음에서 해당 도구를 클릭해 고정(arm)한 뒤 텍스트를 드래그하면 즉시 그 스타일로 마킹되고 도구가 계속 고정 상태로 남아 연속 드래그 가능 (`viewer/SelectionToolbar.tsx`). 밑줄/취소선은 실제 선(쿼드 박스 아님)으로 렌더링.
> **뷰어/편집 모드**: 기본은 읽기 전용 뷰어(주석 도구·속성 패널 숨김, 기존 주석은 보이되 클릭 불가) — 우측 상단 "편집" 버튼으로 전환 (`docStore.editMode`).
> **드래그 앤 드롭**: 파일 탐색기에서 PDF를 창에 끌어다 놓으면 새 탭으로 열림 (`webUtils.getPathForFile`, preload 경유).
> **전체화면**: 우측 상단 버튼 + F11.

## 0. 확정 사항
| 항목 | 결정 |
|---|---|
| 플랫폼 | Windows 데스크톱 앱 (Electron) |
| 사용 범위 | 개인 / 사내 / 지인 → MuPDF.js(AGPL) 사용. 지인에게 배포할 때는 소스를 함께 제공 |
| 1차 목표 | 로드맵 1~4단계 (뷰어, 비밀번호, 인쇄, 주석, 저장) |
| 텍스트 편집 | **기존 글자 바꾸기는 제외.** 배경색 있는 텍스트 상자로 덮어서 대체 |
| 도형 스타일 | 테두리 색, 채우기 색(없음 가능), 두께, 투명도, 선 모양(실선/점선) |
| 텍스트 상자 스타일 | 글자 색, 글자 크기, 글꼴, **배경색(없음 가능)**, 테두리 두께, 정렬 |

---

## 1. 기술 검증 결과 (MuPDF.js 1.28.1, 실제로 실행해서 확인)
| 항목 | 결과 | 설계 반영 |
|---|---|---|
| 도형 테두리색과 채우기색 | ✅ `setColor` / `setInteriorColor` 동작 | 그대로 사용 |
| 텍스트 상자 배경색 | ✅ FreeText는 `setColor`로 배경이 칠해짐. `setInteriorColor`는 오류 | 텍스트 상자 배경 = `/C` |
| 텍스트 상자 테두리색 | ⚠️ 자동 생성 모양에서는 테두리가 **글자색과 같은 색**으로 그려짐 | 테두리색을 따로 지정하는 기능은 7.3의 '직접 그리기' 방식으로 해결 |
| 한글 텍스트 상자 | ✅ 한글이 표시됨. 한글과 영문 사이 간격이 조금 넓어지는 현상 있음 | 7.3의 직접 그리기 방식에서 한글 폰트를 넣어 해결 |
| 암호화 저장·열기 | ✅ AES-256 저장, 틀린 비밀번호는 0 반환, 맞는 비밀번호는 권한 레벨 반환 | 그대로 사용 |
| Undo/Redo | ✅ 문서 저널이 내장되어 있음 (`enableJournal`, `beginOperation`, `undo`/`redo`) | **Undo 시스템을 따로 만들지 않고 저널을 사용** |
| 주석 글자 | 페이지 텍스트 추출(stext)에 주석은 포함되지 않음 | 텍스트 상자 안의 글자는 텍스트 선택·검색 대상이 아님 (주석 목록에서 검색) |

---

## 2. 전체 구조
```
┌─ Main Process (Electron) ──────────────────────────────────────┐
│ 창 관리 · 메뉴 · 파일 대화상자 · 파일 읽기/쓰기 · 인쇄 · 파일 연결 │
└──────────────▲─────────────────────────────────────────────────┘
               │ IPC (preload / contextBridge, contextIsolation=true)
┌──────────────┴─ Renderer (React) ──────────────────────────────┐
│  UI 컴포넌트 ── Zustand Store ── ToolController                 │
│                       │                                         │
│                  EngineClient (Comlink proxy)                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │ postMessage (ArrayBuffer transfer)
┌───────────────────────┴─ PDF Worker ───────────────────────────┐
│  MuPDF.js WASM: 문서 1개 = 워커 1개                              │
└─────────────────────────────────────────────────────────────────┘
```
**원칙**
- PDF 처리는 모두 Worker에서 합니다. UI 스레드는 비트맵과 JSON만 받습니다.
- 파일 시스템에는 Main Process만 접근합니다. Renderer는 IPC로 바이트를 주고받습니다.
- 편집 도중의 문서 상태는 **Worker 안의 MuPDF 문서가 원본**입니다. UI는 그 사본(주석 목록)을 보여주기만 합니다.
- 탭 여러 개로 여러 문서 열기는 2차로 미룹니다. 1차에서는 창 하나에 문서 하나만 열고, 두 번째 문서는 새 창으로 엽니다.

---

## 3. 화면 구성
```
┌──────────────────────────────────────────────────────────────────┐
│ [열기][저장][인쇄] | [↶][↷] | [선택][텍스트선택][손] |              │
│ [형광펜][밑줄][취소선] | [□][○][／][→][펜] | [T 텍스트상자][메모] |   │
│ [-] 100% [+] [맞춤▼] | 3 / 120 | 🔍검색                           │
├────────┬──────────────────────────────────────────┬──────────────┤
│ 사이드  │                                          │ 속성 패널     │
│ [썸네일]│             페이지 뷰어                   │ (선택 도구 또는 │
│ [목차]  │          (세로 연속 스크롤)               │  선택한 주석의 │
│ [주석]  │                                          │  스타일)      │
├────────┴──────────────────────────────────────────┴──────────────┤
│ 상태바: 파일명 · 🔒암호 · 수정됨* · 페이지 크기                      │
└──────────────────────────────────────────────────────────────────┘
```
- **사이드바 탭:** 썸네일(클릭하면 이동), 목차(outline), 주석 목록(종류·페이지·내용, 클릭하면 이동, 검색 가능)
- **속성 패널:** 그리기 도구를 고르면 "다음에 그릴 스타일"을, 주석을 선택하면 "그 주석의 스타일"을 보여줍니다.

---

## 4. 모듈 구조
```
PDF_Editer/
├─ electron/
│  ├─ main.ts              # 창, 메뉴, 단축키, 파일 연결 인자 처리
│  ├─ ipc.ts               # file:open / file:save / print:* 핸들러
│  ├─ print.ts             # 숨김 창 기반 인쇄
│  └─ preload.ts           # window.api 노출
├─ src/
│  ├─ main.tsx, App.tsx
│  ├─ engine/
│  │  ├─ worker.ts         # MuPDF 래퍼 (EngineAPI 구현)
│  │  ├─ client.ts         # Comlink 연결 + 렌더 요청 큐 / 취소
│  │  ├─ types.ts          # AnnotData, TextLine, DocInfo …
│  │  └─ coords.ts         # 화면 ↔ PDF 좌표 변환
│  ├─ store/
│  │  ├─ docStore.ts       # 문서 정보, 페이지, 주석 캐시, dirty
│  │  ├─ viewStore.ts      # 배율, 현재 페이지, 스크롤, 맞춤 모드
│  │  └─ toolStore.ts      # 현재 도구, 도구별 기본 스타일(저장됨)
│  ├─ viewer/
│  │  ├─ Viewer.tsx        # 가상 스크롤 컨테이너
│  │  ├─ PageView.tsx      # 한 페이지 (레이어 3개)
│  │  ├─ CanvasLayer.tsx
│  │  ├─ TextLayer.tsx
│  │  └─ AnnotLayer.tsx    # SVG: 그리는 중 미리보기, 선택 핸들
│  ├─ tools/               # 도구 하나당 파일 하나 (7.1의 인터페이스)
│  ├─ panels/              # Toolbar, Sidebar, PropertyPanel, StatusBar
│  ├─ dialogs/             # PasswordDialog, SaveOptionsDialog, PrintDialog
│  └─ ui/                  # ColorPicker 등 공통 컴포넌트
├─ resources/fonts/        # NotoSansKR-Regular.otf (한글 텍스트 상자용)
└─ tests/fixtures/         # 테스트용 PDF 모음 (10장 참고)
```

---

## 5. Engine API (Worker ↔ UI 계약)
```ts
type Rect = [x0, y0, x1, y1];          // PDF 좌표(pt), MuPDF 방식 = 원점 왼쪽 위
type RGB  = [r, g, b] | null;           // 0~1, null = 없음(투명)

interface DocInfo {
  pageCount: number;
  pages: { width: number; height: number; rotation: number }[];  // 가상 스크롤용
  encrypted: boolean;
  permissions: { print: boolean; copy: boolean; annotate: boolean; edit: boolean };
  title?: string;
}

interface EngineAPI {
  // 문서
  open(data: ArrayBuffer): Promise<{ needsPassword: boolean }>;
  authenticate(password: string): Promise<boolean>;
  getInfo(): Promise<DocInfo>;
  getOutline(): Promise<OutlineItem[]>;

  // 렌더링 (ImageBitmap을 transfer로 전달)
  renderPage(page: number, scale: number, jobId: number): Promise<ImageBitmap>;
  cancelRender(jobId: number): void;
  renderThumbnail(page: number, width: number): Promise<ImageBitmap>;

  // 텍스트
  getTextLines(page: number): Promise<TextLine[]>;     // 텍스트 레이어용
  search(query: string): AsyncIterable<SearchHit>;     // 페이지 순서대로 결과 전달

  // 주석
  listAnnots(page: number): Promise<AnnotData[]>;
  createAnnot(page: number, data: NewAnnot): Promise<AnnotData>;
  updateAnnot(page: number, id: string, patch: Partial<AnnotData>): Promise<AnnotData>;
  deleteAnnot(page: number, id: string): Promise<void>;

  // 히스토리 (MuPDF 저널)
  undo(): Promise<ChangedPages>;
  redo(): Promise<ChangedPages>;
  historyState(): Promise<{ canUndo: boolean; canRedo: boolean }>;

  // 저장
  save(opts: SaveOptions): Promise<ArrayBuffer>;
}

interface SaveOptions {
  encryption: 'keep' | 'none' | { userPassword: string; ownerPassword?: string };
  compress: boolean;           // garbage,compress
  incremental: boolean;        // 전자서명이 있는 문서는 true 권장
}
```

### 주석 데이터 모델
```ts
interface AnnotData {
  id: string;                 // 우리가 /NM 에 기록한 UUID (없으면 열 때 부여)
  page: number;
  type: 'Highlight'|'Underline'|'StrikeOut'|'Square'|'Circle'
      | 'Line'|'Ink'|'FreeText'|'Text';
  rect: Rect;
  quads?: Quad[];             // 형광펜/밑줄/취소선
  line?: [Point, Point];      // 선/화살표
  ink?: Point[][];            // 펜
  style: {
    stroke: RGB;              // 테두리/선 색
    fill: RGB;                // 도형 채우기 / 텍스트 상자 배경
    width: number;            // 테두리 두께(pt), 0 = 없음
    opacity: number;          // 0~1
    dash?: number[];          // 점선
    lineEnd?: 'None'|'OpenArrow'|'ClosedArrow';
  };
  text?: {                    // FreeText 전용
    content: string;
    font: 'Helv'|'TiRo'|'Cour'|'KR';
    size: number;
    color: RGB;
    align: 0|1|2;
  };
  contents?: string;          // 메모 내용
  author?: string; modified?: string;
}
```
- **ID 방식:** MuPDF 주석 객체는 Worker 안에만 있습니다. UI와는 `/NM`(주석 고유 이름) 값으로 대응시킵니다.

---

## 6. 뷰어 설계

### 6.1 렌더링과 스크롤
- **레이아웃:** DocInfo의 페이지 크기로 전체 높이를 미리 계산합니다. 가상 스크롤로 화면에 보이는 페이지 ±2장만 DOM에 둡니다.
- **렌더 품질:** `scale = zoom × devicePixelRatio`로 렌더링합니다.
- **확대/축소:** 줌을 바꾸는 동안에는 기존 비트맵을 CSS로 늘려서 즉시 보여줍니다. 줌이 150ms 동안 멈추면 새 해상도로 다시 렌더링합니다.
- **요청 큐:** 현재 보이는 페이지를 가장 먼저 렌더링합니다. 화면 밖으로 나간 요청은 `cancelRender`로 취소합니다.
- **캐시:** `(page, scale, docVersion)` 키로 LRU 캐시를 두고 약 200MB로 제한합니다. 주석을 바꾸면 해당 페이지의 docVersion을 올립니다.
- **맞춤 모드:** 폭 맞춤, 페이지 맞춤, 실제 크기, 직접 입력(10~800%)
- **입력:** Ctrl+휠은 커서 위치를 기준으로 확대/축소, PageUp/Down, Home/End, 페이지 번호 입력

### 6.2 텍스트 선택과 복사
- `toStructuredText("preserve-whitespace")`의 결과를 줄 단위로 `{text, bbox, fontSize, dir}` 형태로 변환합니다.
- 줄마다 투명한 `<span>`을 절대 위치로 놓습니다. span 폭은 `scaleX`로 bbox 폭에 맞춥니다(PDF.js와 같은 방식).
- 드래그 선택, Ctrl+C, 더블클릭, Ctrl+A(현재 페이지)는 브라우저 기본 기능을 그대로 씁니다.
- 복사 권한(copy)이 없는 문서는 텍스트 레이어를 만들지 않습니다.
- 텍스트가 없는 페이지(스캔본)에는 "텍스트 없음" 배지를 표시합니다.

### 6.3 검색
- Ctrl+F로 검색창을 엽니다. Worker가 페이지 순서대로 `page.search()`를 실행하고 결과를 점진적으로 보냅니다.
- 결과 수를 표시하고, Enter / Shift+Enter로 다음·이전 결과로 이동합니다. 결과는 노란 박스(SVG)로 표시합니다.
- 옵션: 대소문자 구분. 1차에서는 이것만 넣습니다.

---

## 7. 편집 설계

### 7.1 도구 인터페이스
```ts
interface Tool {
  id: ToolId;
  cursor: string;
  onPointerDown(e: PagePointerEvent): void;   // e.pdf = PDF 좌표로 변환된 점
  onPointerMove(e: PagePointerEvent): void;
  onPointerUp(e: PagePointerEvent): void;
  renderPreview(): SVGElement | null;         // 그리는 중 미리보기
}
```
| 도구 | 동작 | 결과 |
|---|---|---|
| 선택 (V) | 주석 클릭 → 핸들 8개 표시 → 이동/크기 조절, Delete로 삭제, 더블클릭으로 텍스트 편집 | updateAnnot |
| 텍스트 선택 (T) | 기본 모드. 텍스트 레이어 활성화 | – |
| 손 (H, Space 누르고 있기) | 드래그로 화면 이동 | – |
| 형광펜/밑줄/취소선 | 텍스트를 드래그하면 `stext.highlight(p,q)`로 글자 영역 생성. **텍스트를 먼저 선택한 뒤 도구 버튼을 눌러도 적용** | Highlight 등 |
| 사각형/원 (R/O) | 드래그로 그리기, Shift 누르면 정사각형/정원 | Square/Circle |
| 선/화살표 (L/A) | 드래그, Shift 누르면 45° 단위로 고정 | Line (+LineEnding) |
| 펜 (P) | 포인터 좌표 수집 → 가까운 점 제거로 단순화 | Ink |
| 텍스트 상자 (X) | 클릭하면 기본 크기, 드래그하면 그 영역으로 생성 → 바로 편집 모드 | FreeText |
| 메모 (N) | 클릭 → 팝업에 내용 입력 | Text |

- 그리기 도구는 한 번 그린 뒤 **선택 도구로 돌아갑니다.** 도구 버튼을 더블클릭하면 계속 그리기 모드로 고정됩니다.
- 주석 선택 여부는 Worker에 묻지 않고 UI가 가진 AnnotData 목록으로 판정합니다.

### 7.2 속성 패널
| 대상 | 항목 |
|---|---|
| 형광펜류 | 색 (프리셋 6개와 사용자 지정), 투명도 |
| 사각형/원 | **테두리 색**, **채우기 색(없음 가능)**, 두께(0~20pt), 투명도, 실선/점선 |
| 선/화살표 | 선 색, 두께, 투명도, 시작·끝 모양 |
| 펜 | 색, 두께, 투명도 |
| 텍스트 상자 | 글꼴, 크기, 글자 색, **배경색(없음 가능)**, 테두리 색, 테두리 두께(0 가능), 정렬 |
| 메모 | 색, 내용 |

- 도구별 기본 스타일은 마지막으로 쓴 값을 localStorage에 저장해서 다음에도 씁니다.
- 스타일을 바꾸면 선택된 주석에 즉시 반영하고, 이 변경도 Undo 한 단계로 기록합니다.

### 7.3 텍스트 상자 렌더링 방식 (중요)
검증해 보니 MuPDF가 자동으로 만드는 FreeText 모양에는 두 가지 한계가 있었습니다.
- 테두리색을 따로 지정할 수 없습니다(글자색과 같은 색으로 그려짐).
- 한글과 영문 사이 간격이 부자연스럽습니다.

그래서 2단계 전략을 씁니다.
1. **기본 방식:** 표준 FreeText 속성을 모두 기록합니다. `/C`는 배경, `/DA`는 글꼴·크기·글자색, `/BS`는 두께, `/Contents`는 내용입니다. 그래서 다른 뷰어에서도 편집할 수 있는 텍스트 상자로 인식됩니다.
2. **모양(Appearance)은 직접 생성합니다.** `setAppearance()`에 다음 내용을 담은 콘텐츠 스트림을 넣습니다.
   - 배경 사각형을 채우고 테두리를 그립니다. 테두리색은 `/DS`나 사용자 정의 키에 보관합니다.
   - 글자는 **Noto Sans KR을 CJK 폰트로 넣어서**(`addCJKFont` 또는 `addFont`) 줄바꿈을 직접 계산해 그립니다.
   - 줄바꿈은 글꼴의 advance 값으로 폭을 재서 단어 단위로 처리하고, 한글은 글자 단위로 처리합니다.

→ 이렇게 하면 Acrobat·크롬·엣지에서도 똑같이 보이고, 우리 앱에서는 모든 스타일을 자유롭게 바꿀 수 있습니다.
→ **초기 구현은 1번(MuPDF 자동 모양)만으로 먼저 만들고, 2번은 4단계 후반에 교체합니다.** 위험을 나누기 위해서입니다.

### 7.4 Undo/Redo
- 문서를 열자마자 `doc.enableJournal()`을 호출합니다.
- 모든 변경을 `beginOperation("형광펜 추가")` … `endOperation()`로 감쌉니다. 드래그로 이동할 때는 pointerup 시점에 한 번만 기록합니다.
- Ctrl+Z / Ctrl+Y로 `undo()` / `redo()`를 호출한 뒤 영향받은 페이지의 주석을 다시 읽고 다시 렌더링합니다.
- dirty 상태 = 저널 위치가 마지막 저장 시점과 다름

---

## 8. 비밀번호와 보안
```
열기 → open(bytes)
  needsPassword?
   ├ 아니오 → getInfo()
   └ 예 → PasswordDialog ──(입력)──▶ authenticate(pw)
                ▲                       ├ 0: "비밀번호가 틀렸습니다" (횟수 제한 없음, 흔들림 효과)
                └───────────────────────┘ └ >0: getInfo()
```
- **권한 처리:** print가 없으면 인쇄 버튼, copy가 없으면 텍스트 레이어, annotate가 없으면 주석 도구를 비활성화하고 툴팁으로 이유를 알립니다.
- **저장 대화상자의 암호 옵션:**
  - 원래 암호 유지 (기본값. 열 때 입력한 비밀번호를 메모리에서 재사용)
  - 암호 제거
  - 새 암호 설정: 열기 암호, 확인 입력, 권한 암호(선택). AES-256으로 저장
- 비밀번호는 Worker 메모리에만 두고, 문서를 닫으면 폐기합니다. 로그·파일·최근 파일 목록에는 남기지 않습니다.

---

## 9. 인쇄와 저장

### 9.1 인쇄
1. PrintDialog에서 범위(전체 / 현재 / 1-3,5), 주석 포함 여부, 맞춤(용지에 맞춤 / 실제 크기)을 고릅니다.
2. Worker가 페이지를 **200~300dpi JPEG**로 렌더링합니다. 주석 제외를 고르면 `runPageContents`만 사용합니다.
3. Main이 숨김 BrowserWindow에 `<img>`를 한 페이지에 하나씩 넣고 `@page { size: auto; margin: 0 }`으로 설정합니다.
4. `webContents.print({ silent: false })`로 OS 인쇄 대화상자를 띄웁니다(프린터와 매수는 여기서 선택).

- 가로 페이지는 페이지별 CSS로 방향을 지정합니다.
- 100페이지가 넘으면 진행률을 표시하고, 메모리를 위해 이미지를 임시 파일로 씁니다.

### 9.2 저장
- **Ctrl+S:** 옵션은 이전과 같게(암호 유지, compress) 해서 원래 경로에 저장합니다.
- **Ctrl+Shift+S:** 다른 이름으로 저장. SaveOptionsDialog를 거칩니다.
- **안전한 쓰기:** `파일명.pdf.tmp`에 먼저 쓰고, 성공하면 rename으로 교체합니다. 실패하면 원본을 그대로 둡니다.
- 전자서명이 있는 문서는 증분 저장을 권장한다고 경고합니다.
- 창을 닫을 때 dirty 상태면 "저장 / 저장 안 함 / 취소"를 묻습니다.

---

## 10. 테스트 계획
**tests/fixtures에 둘 파일**
| 파일 | 확인할 것 |
|---|---|
| 일반 한글 문서 | 텍스트 복사, 검색 |
| 300페이지 이상 문서 | 스크롤 성능, 메모리 |
| 90°/270° 회전 페이지, CropBox가 있는 문서 | 좌표 변환, 주석 위치 |
| 열기 암호 문서 (RC4 / AES-128 / AES-256) | 인증, 저장 뒤 다시 열기 |
| 권한만 제한된 문서 | 버튼 비활성화 |
| 스캔 이미지 문서 | 텍스트 없음 안내 |
| 다른 프로그램으로 주석을 단 문서 | 기존 주석 표시와 수정 |

- **자동 테스트:** `engine/worker.ts`의 로직을 Node에서 Vitest로 검증합니다. 주석 생성 → 저장 → 다시 열기 → 속성 일치 여부를 확인합니다.
- **호환성 확인(수동):** 저장한 파일을 Acrobat Reader, 크롬, 엣지에서 열어 모양이 같은지 봅니다.

---

## 11. 단축키
| 키 | 동작 | 키 | 동작 |
|---|---|---|---|
| Ctrl+O / S / Shift+S | 열기 / 저장 / 다른 이름으로 저장 | Ctrl+P | 인쇄 |
| Ctrl+Z / Y | 실행 취소 / 다시 실행 | Ctrl+F | 검색 |
| Ctrl+휠, Ctrl+± / 0 | 확대·축소 / 폭 맞춤 | Delete | 선택한 주석 삭제 |
| V T H | 선택 / 텍스트 선택 / 손 | R O L A P X N | 도구 선택 |
| Esc | 그리기 취소, 선택 해제 | Ctrl+D | 선택한 주석 복제 |

---

## 12. 로드맵 (1차 = 1~4)
| 단계 | 내용 | 완료 기준 |
|---|---|---|
| 1 | 골격, Worker 연결, 열기, 렌더링, 줌, 가상 스크롤, 썸네일·목차 | 300페이지 문서가 끊김 없이 스크롤됨 |
| 2 | 비밀번호, 권한 처리, 텍스트 레이어, 검색 | 암호 문서를 열고 한글을 복사할 수 있음 |
| 3 | 인쇄 | 범위 지정 인쇄, 가로 페이지 정상 출력 |
| 4a | 주석 도구, 속성 패널, 선택·이동·크기 조절, Undo, 저장(암호 옵션 포함) | 저장한 파일이 크롬·Acrobat에서 똑같이 보임 |
| 4b | 텍스트 상자 모양 직접 생성 (7.3의 2번 방식) | 테두리색을 따로 지정 가능, 한글 간격 정상 |
| 5 | 페이지 회전·삭제·순서 변경·병합 | |
| 6 | 이미지 삽입, 서명, 양식 채우기, OCR (선택) | |

## 13. 위험 요소와 대응
| 위험 | 대응 |
|---|---|
| 회전·CropBox 문서에서 좌표가 어긋남 | `coords.ts` 한 곳에서만 변환, 1단계부터 해당 fixture로 테스트 |
| 대용량 문서의 메모리 사용 | 비트맵 LRU 캐시 상한, 화면 밖 캔버스 해제, 인쇄 이미지는 임시 파일 사용 |
| FreeText 모양 호환성 | 4b의 직접 생성 방식, 다른 뷰어로 교차 확인 |
| WASM 초기 로딩 시간(약 10MB) | 앱 시작 시 Worker를 미리 띄워 둠 |
| AGPL | 배포할 때 소스 저장소 링크 또는 zip을 함께 제공 |
