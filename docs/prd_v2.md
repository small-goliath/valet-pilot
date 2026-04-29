# Valet Pilot UI 화면 PRD (v2)

## 핵심 정보

**목적**: CLI 전용으로 동작하던 Valet Pilot에 전용 앱 창을 추가하여 AI 에이전트 상태, 브리핑 자막, 사용자 발화 내용을 시각적으로 표시한다.
**사용자**: macOS에서 `valet-pilot start`로 Valet Pilot을 실행하는 1인 개발자.

---

## 사용자 여정

```
1. [터미널]
   valet-pilot start 실행
   ↓ (항상 on top) 앱 창 자동 생성

2. [앱 창 — idle 상태]
   - AI 캐릭터: idle 애니메이션 (호흡 효과)
   - 하단 텍스트: 비어 있음
   - 데몬이 트리거 대기 중
   ↓ [박수 두 번 / wake word / 단축키]

3. [앱 창 — briefing 상태]
   - AI 캐릭터: active 애니메이션 (글로우 / 파동)
   - 하단 텍스트(AI): TTS 발화 내용 실시간 자막 표시
   - 사용자 텍스트 영역: 비어 있음
   ↓ [브리핑 완료 → 세션 자동 전환]

4. [앱 창 — session 상태]
   - AI 캐릭터: 발화 중 active / 대기 중 listening 구분 애니메이션
   - 하단 텍스트(AI): AI 응답 스트리밍 자막
   - 최하단 텍스트(사용자): STT 인식 중/완료 텍스트
   ↓ [종료 키워드 / 단축키]

5. [앱 창 — idle 상태 복귀]
   - 세션 요약 저장 완료 후 idle 상태로 전환
   - 앱 창 유지 (다음 트리거 대기)
   ↓ [앱 창 닫기 (Cmd+W / 닫기 버튼)]

6. [데몬 종료]
   - 앱 창 종료 이벤트 감지 → 데몬 SIGTERM 전송
   - 데몬 graceful shutdown 완료
```

---

## 기능 명세

### 1. MVP 핵심 기능

| ID | 기능명 | 설명 | MVP 필수 이유 | 관련 페이지 |
|----|--------|------|--------------|------------|
| **F101** | 앱 창 자동 실행 | `valet-pilot start` 실행 시 Electron 앱 창이 자동으로 열리고 항상 위에 표시(always on top) | 사용자가 별도 조작 없이 UI를 확인할 수 있어야 함 | 메인 앱 창 |
| **F102** | AI 캐릭터 상태 표시 | 데몬 상태(idle / briefing / session-listening / session-speaking)에 따라 캐릭터 이미지 또는 CSS 애니메이션이 전환됨 | 현재 시스템 상태를 직관적으로 인지하기 위한 핵심 UI | 메인 앱 창 |
| **F103** | AI 발화 자막 표시 | TTS가 출력하는 텍스트가 앱 창 하단에 실시간으로 표시됨. 브리핑 구간별 텍스트(환영 인사, 시작 선언, 리포트)와 세션 중 AI 응답 스트리밍 텍스트 모두 포함 | 청각에 의존하지 않고 내용을 확인하는 보조 수단 | 메인 앱 창 |
| **F104** | 사용자 발화 텍스트 표시 | STT 인식 중인 텍스트(점진적 표시)와 인식 완료 텍스트를 최하단에 구분하여 표시 | STT 인식 결과를 실시간으로 확인하여 오인식 즉시 파악 | 메인 앱 창 |
| **F105** | 창 종료 시 데몬 연동 종료 | 앱 창을 닫으면 실행 중인 데몬 프로세스에 SIGTERM을 전송하고 PID 파일을 정리함 | 창을 닫아도 데몬이 백그라운드에 남아 리소스를 점유하는 상황 방지 | 메인 앱 창 |

### 2. MVP 필수 지원 기능

| ID | 기능명 | 설명 | MVP 필수 이유 | 관련 페이지 |
|----|--------|------|--------------|------------|
| **F110** | IPC 상태 브리지 | 기존 데몬(Node.js 프로세스)과 Electron 렌더러 프로세스 간 상태 이벤트를 전달하는 IPC 채널. 데몬은 named pipe 또는 Unix socket으로 상태 변경을 전송하고 Electron main process가 수신하여 렌더러에 전달 | 기존 CLI 코드 변경 최소화하면서 UI와 데몬을 연결하는 유일한 통로 | 메인 앱 창 (내부 인프라) |
| **F111** | 텍스트 자동 초기화 | 새 브리핑 또는 새 세션 시작 시 이전 AI 자막과 사용자 텍스트 영역을 초기화 | 이전 세션 내용이 남아 혼란을 주는 상황 방지 | 메인 앱 창 |

### 3. MVP 이후 기능 (제외)

- 브리핑/세션 내용 앱 내 히스토리 뷰어
- 앱 창 크기/위치 설정 UI
- 다크/라이트 테마 전환
- 트레이 아이콘 및 메뉴바 통합
- 캐릭터 이미지 교체 UI

---

## 메뉴 구조

```
앱 창 내비게이션 (단일 창 구성)
└── 메인 앱 창 (단일 화면)
    ├── AI 캐릭터 영역 — F101, F102
    ├── AI 자막 영역 — F103, F111
    └── 사용자 텍스트 영역 — F104, F111

macOS 네이티브 메뉴바 (Electron 기본)
├── Valet Pilot
│   └── Valet Pilot 종료 — F105
└── 창
    └── 닫기 (Cmd+W) — F105
```

---

## 페이지별 상세 기능

### 메인 앱 창

> **구현 기능:** `F101`, `F102`, `F103`, `F104`, `F105`, `F110`, `F111` | **진입:** `valet-pilot start` 실행 시 자동 실행

| 항목 | 내용 |
|------|------|
| **역할** | 데몬 상태와 AI/사용자 발화 내용을 실시간으로 시각화하는 단일 전용 창 |
| **진입 경로** | `valet-pilot start` 명령 실행 시 Electron 앱이 자동으로 열림. 사용자가 별도로 앱 아이콘을 클릭할 필요 없음 |
| **사용자 행동** | 창을 띄워 두고 AI 캐릭터 상태 변화와 자막을 확인. 대화 조작은 기존과 동일하게 음성/단축키로 수행 |
| **주요 기능** | - 창 크기 고정(예: 480×640px) 또는 최소 크기 제한, 항상 위에 표시(always on top)<br>- **AI 캐릭터 영역**: 화면 상단 2/3를 차지하는 이미지 또는 CSS 애니메이션. 상태별 전환: idle(호흡 효과) / briefing·speaking(파동/글로우 효과) / listening(느린 맥박 효과)<br>- **AI 자막 영역**: 하단 약 20% 영역. 청록색(#00e5ff) 계열 텍스트, 다크 반투명 배경. 텍스트가 한 줄을 초과하면 위로 스크롤하여 최신 내용 유지. 브리핑 완료 또는 세션 종료 시 페이드아웃 후 초기화<br>- **사용자 텍스트 영역**: 최하단 약 10% 영역. STT 인식 중 회색 텍스트(점진적 표시) → 인식 완료 후 흰색 텍스트 전환. 발화 종료 후 3초 유지 후 페이드아웃<br>- 창 닫기 이벤트(Cmd+W 포함) 감지 시 데몬 PID에 SIGTERM 전송 후 앱 종료<br>- **IPC 채널**: Electron main process가 데몬이 기록하는 Unix socket(`~/.valet-pilot/ui.sock`)을 구독하여 상태 이벤트(state-change, ai-text, user-text) 수신 후 렌더러에 ipcRenderer로 전달 |
| **다음 이동** | 창 닫기 → 데몬 종료 후 앱 완전 종료 |

---

## 데이터 모델

### UIState (렌더러 상태)

| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| state | 현재 데몬 상태 | Enum (idle, briefing, session-listening, session-speaking) |
| aiText | AI 자막 영역에 표시 중인 텍스트 | String |
| userText | 사용자 텍스트 영역에 표시 중인 텍스트 | String |
| userTextFinal | 사용자 텍스트 인식 완료 여부 | Boolean |

### UIEvent (IPC 이벤트 페이로드)

| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| type | 이벤트 유형 | Enum (state-change, ai-text, user-text, user-text-final) |
| payload | 이벤트 데이터 | String (state 명칭 또는 텍스트 내용) |
| timestamp | 이벤트 발생 시각 | ISO8601 DateTime |

---

## 기술 스택 (UI 추가분)

### 앱 프레임워크

- **Electron 41** (최신 안정 버전, 41.3.0) — macOS 네이티브 앱 창, always on top, IPC, 프로세스 관리
- **기존 Node.js 24 + TypeScript 5.6 ESM 코드베이스와 동일 런타임** (Electron 28+에서 ESM 지원)

### 렌더러 UI

- **React 19** — 렌더러 프로세스 UI 라이브러리
- **TailwindCSS v4** (`@tailwindcss/vite` 플러그인, PostCSS 설정 불필요) — 유틸리티 CSS
- 캐릭터 애니메이션: CSS keyframes 기반 (별도 애니메이션 라이브러리 없이 구현 가능)
- 번들러: **electron-vite** (Vite 8 기반 Electron 전용 템플릿, ESM + preload 지원)

### IPC / 프로세스 통신

- **Unix Domain Socket** (`~/.valet-pilot/ui.sock`) — 기존 데몬 코드 변경 최소화. 데몬은 소켓 파일에 JSON 이벤트를 write, Electron main process가 `net.createConnection`으로 구독
  - `~` 틸데는 Node.js에서 자동 확장되지 않으므로 `os.homedir()`로 절대 경로 생성
- **Electron ipcMain / ipcRenderer** — main ↔ renderer 간 이벤트 중계 (`webContents.send` + `ipcRenderer.on` 패턴)

### 빌드 및 패키징

- **electron-builder** — macOS .app 패키지 생성
- `valet-pilot start` 실행 시 `require('electron')` 반환값(바이너리 경로)으로 electron 프로세스를 `child_process.spawn`하여 기존 CLI 구조 유지

---

## 구현 통합 전략

### 기존 CLI와의 통합 방식

현재 `valet-pilot start` → `Daemon.start()` 흐름을 다음과 같이 확장합니다.

```
valet-pilot start
├── 1. UIServer.start()      — Unix socket 서버 생성 (LISTEN 상태 확보)
├── 2. Daemon.start()        — 트리거/브리핑/세션 실행
└── 3. electron spawn        — UIServer 준비 완료 후 앱 창 열기
```

> **시작 순서 보장**: UIServer가 LISTEN 상태가 된 이후에 electron을 spawn해야 연결 경합 조건을 방지할 수 있습니다. Electron main process 측에도 연결 실패 시 100ms 간격 최대 10회 재시도 로직을 추가합니다.

데몬 내부에서 상태 변경이 발생하는 시점(브리핑 시작, TTS 텍스트 전달, STT 결과 수신, 세션 종료 등)에 UIServer를 통해 UIEvent를 소켓에 write합니다. Electron은 소켓을 구독하고 있다가 이벤트를 수신하면 ipcMain을 통해 렌더러로 전달합니다.

### TTS / STT 이벤트 훅

F103(AI 자막), F104(사용자 자막)를 구현하려면 `TtsManager`와 `SttManager`가 UI에 텍스트를 전달할 수 있어야 합니다. 현재 두 클래스는 이벤트 발행 메커니즘이 없으므로 다음과 같이 확장합니다.

**TtsManager 변경** (`src/tts/manager.ts`):
- `EventEmitter`를 상속하여 `speak()` 진입 시 `'speak-start'` 이벤트, 완료 시 `'speak-end'` 이벤트 발행
- 이벤트 페이로드: `{ text: string }`

**SttManager 변경** (`src/stt/manager.ts`):
- `transcribeMic()` 호출 시작 시 `'listening-start'` 이벤트 발행
- 인식 완료 시 `'transcript'` 이벤트 발행
- 이벤트 페이로드: `{ text: string, final: boolean }`

**Daemon 이벤트 라우팅**:
- `Daemon`이 `TtsManager` / `SttManager` 이벤트를 구독하여 `UIServer.emit(UIEvent)`로 전달

### SessionState → UI 상태 매핑

현재 코드의 `SessionState`와 PRD UI 상태의 매핑 테이블:

| SessionState (현재 코드) | UI 상태 (PRD) | 캐릭터 애니메이션 |
|------------------------|--------------|----------------|
| `idle` (데몬 대기 중) | `idle` | 호흡 효과 (느린 pulse) |
| `listening` (STT 녹음 중) | `session-listening` | 느린 맥박 효과 |
| `processing` (AI 응답 생성 중) | `session-speaking` | 파동/글로우 효과 |
| `speaking` (TTS 재생 중) | `session-speaking` | 파동/글로우 효과 |
| `ending` (세션 종료 중) | `idle` | 호흡 효과로 전환 |
| (브리핑 중, Daemon 이벤트) | `briefing` | 파동/글로우 효과 |

### UI 선택 조건

`--no-ui` 플래그를 추가하여 UI 없이 기존 CLI 전용 모드로도 실행 가능하게 유지합니다.

```
valet-pilot start          # UI 창 포함 실행 (기본)
valet-pilot start --no-ui  # 기존 CLI 전용 모드 (UI 없음)
```

### 디렉토리 구조 추가

```
src/
├── ui/                     # Electron + React 앱 (신규)
│   ├── main.ts             # Electron main process
│   ├── preload.ts          # contextBridge 설정
│   └── renderer/           # React 앱 (Vite)
│       ├── App.tsx
│       ├── components/
│       │   ├── CharacterView.tsx   # AI 캐릭터 애니메이션
│       │   ├── AiSubtitle.tsx      # AI 자막 영역
│       │   └── UserSubtitle.tsx    # 사용자 텍스트 영역
│       └── hooks/
│           └── useValetState.ts    # IPC 이벤트 구독 훅
└── uiserver/               # 데몬 ↔ UI IPC 서버 (신규)
    └── server.ts            # Unix socket 서버
```
