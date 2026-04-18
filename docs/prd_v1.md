# Valet Pilot MVP PRD

## 핵심 정보

**목적**: 매일 아침 수동으로 업무 현황, 날씨, 주식 등을 확인하는 번거로움을 음성 명령 하나로 자동 브리핑받고, 자연어 음성 지시만으로 실제 애플리케이션을 조작하여 업무를 수행할 수 있게 한다.

**사용자**: macOS 환경에서 개발 업무를 수행하며 매일 반복적인 정보 수집과 키보드/마우스 기반 AI 지시에 피로감을 느끼는 1인 개발자 또는 소규모 팀원.

---

## 사용자 여정

```
1. [CLI 설치]
   ↓ npm install -g valet-pilot (MVP. brew install은 Post-MVP 예정)

2. [초기 설정 (Setup Wizard)]
   ↓ valet-pilot setup 실행
   - AI 에이전트 닉네임 입력
   - AI 모델 선택 (anthropic / openai) ※ Post-MVP: google / llama 추가 예정
   - 언어 선택 (korean / japanese / english)
   - 사투리 선택 (korean 선택 시: 경상도 / 전라도 / 충청도 / 제주도 / 강원도 / 표준어)
   - 업무 툴 선택 (Redmine 또는 JIRA 중 하나)
   - 관심사 선택 및 연동 (날씨 / 주식 / 사용자 지정)
   ↓ 설정 저장 완료

3. [에이전트 실행]
   ↓ valet-pilot start 실행 → 음성 대기 상태 진입

4. [오프닝 브리핑 트리거]
   ↓ 사용자 음성 입력: "{닉네임}, 시작하자" / "드가자" / "Let's Go!"
   - bgm/opening.mp3 재생 시작
   - [0초~51.6초] 환영 인사 TTS 출력
   - [51.7초~53초] 강렬하고 활기차며 힘찬 짧고 굵은 시작 멘트 TTS 출력
   - [53.2초~] 관심사 리포트 TTS 순차 출력
     → Redmine/JIRA 할당 티켓 목록
     → 날씨 정보 (설정된 경우)
     → 주식 시장 요약 (설정된 경우)
     → 사용자 지정 관심사 (설정된 경우)
   - 리포트 완료 → bgm/opening.mp3 종료
   ↓

5. [업무 지시 대기]
   ↓ 사용자 음성 입력: 자연어 업무 지시
   - AI가 지시 해석
   [이해 가능] → 애플리케이션 실행 및 업무 수행
   [이해 불가] → 사용자에게 명확화 질문 (TTS)
   ↓

6. [업무 수행] — MVP 지원 범위
   - 쉘 명령 실행: Git 작업, 파일 조작 등 터미널 명령 수행
   - 파일 읽기/쓰기: 로컬 파일 시스템 접근
   - 앱 실행: VSCode(`code` CLI) / IntelliJ(`idea` CLI) / Chrome 실행
   - Chrome URL 네비게이션: JXA를 통한 탭 열기 및 URL 이동
   ※ Post-MVP: 웹 폼 입력, 에디터 내부 조작, Google Drive / Confluence / Notion 접근
   ↓

7. [업무 완료 또는 추가 지시 반복]
   → 5번으로 루프 또는 종료 음성 입력으로 에이전트 종료
```

---

## 기능 명세

### 1. MVP 핵심 기능

| ID | 기능명 | 설명 | MVP 필수 이유 | 관련 페이지/모듈 |
|----|--------|------|-------------|----------------|
| **F001** | CLI 설치 및 실행 | npm 또는 brew를 통한 패키지 설치, `valet-pilot start` 명령으로 에이전트 기동 | 진입점. 설치 없이 서비스 사용 불가 | CLI 진입점 |
| **F002** | 초기 설정 (Setup Wizard) | 닉네임, AI 모델, 언어, 사투리, 관심사, 연동 서비스 설정을 대화형 CLI로 수행 및 로컬 설정 파일 저장 | 모든 개인화 기능의 전제 조건 | Setup Wizard |
| **F003** | 음성 인식 (STT) | 마이크 입력을 텍스트로 변환. 설정된 언어 및 사투리를 인식 트리거 키워드 포함 | 핵심 인터페이스. 음성 없이 서비스 동작 불가 | 음성 처리 모듈 |
| **F004** | 오프닝 브리핑 | 시작 키워드 감지 후 `bgm/opening.mp3` 재생, 고정 타임코드 기반 TTS 환영 인사(~51.6초)/시작 멘트(51.7~53초)/관심사 리포트(53.2초~) 순으로 진행. AI 추천 멘트와 TTS 속도 조절을 통해 타임코드 내 완료 보장 | 서비스의 핵심 가치 제공 경험 | 오프닝 브리핑 모듈 |
| **F005** | 관심사 데이터 수집 | 설정된 업무 툴(Redmine 또는 JIRA 중 하나) API로 할당 티켓 조회, 날씨 API, 주식 API, 사용자 지정 소스 데이터 수집 및 요약 | 브리핑 콘텐츠의 실제 내용 제공 | 관심사 수집 모듈 |
| **F006** | TTS (음성 출력) | 수집된 텍스트를 설정된 언어 및 사투리로 음성 합성하여 출력 | 핵심 인터페이스. 음성 응답 없이 서비스 불완전 | TTS 모듈 |
| **F007** | 자연어 업무 지시 처리 | 사용자 음성 지시를 AI 모델이 해석하고 수행 가능한 액션으로 변환 | 핵심 가치. AI가 지시를 이해해야 업무 수행 가능 | AI 에이전트 실행 엔진 |
| **F008** | 애플리케이션 실행 및 조작 | macOS에서 JXA + 앱별 CLI(`code`, `idea`)를 통해 Chrome, VSCode, IntelliJ 등을 실행하고 기본 조작 수행. MVP 범위: 쉘 명령, 파일 읽기/쓰기, 앱 실행, Chrome URL 네비게이션 | 실제 업무 자동화의 핵심 수행 단위 | 앱 컨트롤 모듈 |
| **F009** | 명확화 질문 | 업무 지시를 이해하지 못하거나 수행할 수 없는 경우 TTS로 사용자에게 명확화 요청 | 오류 없는 업무 수행을 위한 안전 장치 | AI 에이전트 실행 엔진 |

### 2. MVP 필수 지원 기능

| ID | 기능명 | 설명 | MVP 필수 이유 | 관련 페이지/모듈 |
|----|--------|------|-------------|----------------|
| **F010** | 설정 파일 관리 | 사용자 설정(닉네임, 모델, 언어, 사투리, 관심사, API 키 등)을 로컬 JSON/YAML 파일로 저장 및 로드 | 모든 설정이 재시작 후에도 유지되어야 함 | Setup Wizard, 설정 파일 모듈 |
| **F011** | AI 모델 선택 및 API 연동 | Anthropic, OpenAI 중 선택한 모델의 API를 통해 자연어 처리 수행. Adapter 패턴으로 추상화하여 Post-MVP에서 Google, Llama 확장 | 다양한 사용자 환경 지원 | AI 에이전트 실행 엔진 |
| **F012** | 사전 요구사항 검증 | `valet-pilot start` 실행 시 macOS 마이크/접근성 권한 상태 점검, 시스템 의존성(SoX 등) 확인 후 미충족 시 안내 메시지 출력 | 권한/의존성 미충족 시 침묵 실패 방지 | 사전 요구사항 검증 모듈 |

### 3. MVP 이후 기능 (제외)

- Google AI (Gemini) / Llama (Ollama) 모델 지원 확장
- 고급 앱 자동화 (웹 폼 입력, 에디터 내부 UI 조작, 복잡한 멀티스텝 앱 조작)
- GUI 대시보드 (웹 또는 데스크탑 앱)
- 다중 사용자 계정 관리
- 클라우드 설정 동기화
- 업무 이력 로그 및 분석
- 플러그인 마켓플레이스
- Windows / Linux 지원

---

## 모듈 구조

CLI 기반 에이전트이므로 전통적인 메뉴/페이지 대신 모듈(명령) 단위로 구성합니다.

```
Valet Pilot CLI
├── [설치] valet-pilot (전역 명령 등록)
│   └── 기능: F001 (CLI 패키지 설치 및 진입점)
│
├── [초기 설정] valet-pilot setup
│   ├── 닉네임 설정 - F002
│   ├── AI 모델 선택 - F002, F011
│   ├── 언어/사투리 선택 - F002
│   └── 관심사 및 연동 서비스 설정 - F002, F010
│
├── [에이전트 실행] valet-pilot start
│   ├── 사전 요구사항 검증 - F012
│   ├── 음성 인식 대기 - F003
│   ├── 오프닝 브리핑 트리거 감지 - F003, F004
│   ├── 관심사 데이터 수집 및 리포트 - F005, F004, F006
│   ├── 업무 지시 처리 - F007, F008, F009
│   └── TTS 응답 - F006
│
└── [설정 확인/수정] valet-pilot config
    └── 기능: F002, F010 (기존 설정 조회 및 수정)
```

---

## 모듈별 상세 기능

### CLI 진입점

> **구현 기능:** `F001` | **실행:** 전역 CLI 명령

| 항목 | 내용 |
|------|------|
| **역할** | 패키지 설치 후 `valet-pilot` 명령어를 전역에서 사용할 수 있게 하는 진입점 |
| **진입 경로** | `npm install -g valet-pilot` 실행 후 터미널에서 `valet-pilot` 입력 (MVP. `brew install`은 Post-MVP 예정) |
| **사용자 행동** | 설치 후 `valet-pilot --help`로 사용 가능한 명령 확인, `valet-pilot setup` 또는 `valet-pilot start` 실행 |
| **주요 기능** | - 전역 CLI 명령 등록 (`valet-pilot`)<br>- 하위 명령 라우팅: `setup`, `start`, `config`<br>- 버전 정보 출력 (`--version`)<br>- 도움말 출력 (`--help`) |
| **다음 이동** | `valet-pilot setup` → Setup Wizard 모듈, `valet-pilot start` → 에이전트 실행 모듈 |

---

### Setup Wizard

> **구현 기능:** `F002`, `F010`, `F011` | **실행:** `valet-pilot setup`

| 항목 | 내용 |
|------|------|
| **역할** | 최초 실행 시 또는 설정 변경 시 인터랙티브 CLI 프롬프트를 통해 에이전트 동작에 필요한 모든 설정을 입력받고 로컬 파일로 저장 |
| **진입 경로** | `valet-pilot setup` 직접 실행, 또는 `valet-pilot start` 실행 시 설정 파일이 없으면 자동 진입 |
| **사용자 행동** | 프롬프트 질문에 순서대로 응답하여 닉네임, AI 모델 및 API 키, 언어, 사투리, 관심사, 연동 서비스 인증 정보 입력 |
| **주요 기능** | - AI 에이전트 닉네임 입력 (예: "자비스", "버디")<br>- AI 모델 선택: `anthropic` / `openai` 및 해당 API 키 입력 (Post-MVP: `google` / `llama` 확장 예정, Adapter 패턴으로 추상화)<br>- 언어 선택: `korean` / `japanese` / `english`<br>- 사투리 선택 (korean 선택 시): 경상도 / 전라도 / 충청도 / 제주도 / 강원도 / 표준어<br>- **업무 툴 선택 (단일 선택)**: `Redmine` 또는 `JIRA` 중 하나<br>&nbsp;&nbsp;&nbsp;→ Redmine 선택 시: 서버 URL + API Key 입력<br>&nbsp;&nbsp;&nbsp;→ JIRA 선택 시: 서버 URL + 이메일 + API Token 입력 (Cloud), 또는 서버 URL + Personal Access Token 입력 (Server/Data Center)<br>- 관심사 선택 (다중 선택): 날씨 / 주식 / 사용자 지정<br>- 관심사별 인증 정보 입력 (주식 티커 목록 등)<br>- 설정 완료 후 `~/.valet-pilot/config.json`에 저장 |
| **다음 이동** | 설정 완료 → "설정이 완료되었습니다. `valet-pilot start`로 시작하세요." 출력 후 종료 |

---

### 음성 처리 모듈

> **구현 기능:** `F003` | **실행:** `valet-pilot start` 내부 컴포넌트

| 항목 | 내용 |
|------|------|
| **역할** | 마이크로부터 실시간 오디오를 수신하고 STT(Speech-to-Text)로 텍스트 변환, 오프닝 트리거 키워드 및 업무 지시를 구분하여 다음 처리 단계로 전달 |
| **진입 경로** | `valet-pilot start` 실행 시 자동으로 음성 대기 상태 진입 |
| **사용자 행동** | 마이크에 대고 "{닉네임}, 시작하자" / "드가자" / "Let's Go!" 등 트리거 발화, 또는 업무 지시 발화 |
| **주요 기능** | - macOS 마이크 권한 획득 및 실시간 오디오 스트림 수신<br>- STT 엔진 연동: 기본 OpenAI Realtime API (WebSocket), 선택 오프라인 모드 `nodejs-whisper` (whisper.cpp)<br>- 설정된 언어 기반 인식 (korean / japanese / english)<br>- 오프닝 트리거 키워드 감지: "{닉네임}, 시작하자", "{닉네임}, 드가자", "{닉네임}, Let's Go!" 등 유연한 패턴 매칭<br>- 인식된 텍스트를 오프닝 브리핑 모듈 또는 AI 에이전트 실행 엔진으로 라우팅<br>- 오프라인 모드 선택 시 `valet-pilot start` 실행 시점에 SoX 설치 여부 자동 확인, 미설치 시 `brew install sox` 안내 메시지 출력 |
| **다음 이동** | 트리거 감지 → 오프닝 브리핑 모듈 / 일반 지시 → AI 에이전트 실행 엔진 |

---

### 오프닝 브리핑 모듈

> **구현 기능:** `F004`, `F005`, `F006` | **트리거:** 오프닝 키워드 감지 시

| 항목 | 내용 |
|------|------|
| **역할** | 시작 트리거 감지 후 `bgm/opening.mp3` 재생과 고정 타임코드 기반으로 환영 인사 → 시작 멘트 → 관심사 리포트를 순서대로 출력하는 하루 시작 의식(ritual) |
| **진입 경로** | 음성 처리 모듈에서 오프닝 트리거 키워드 감지 시 자동 실행 |
| **사용자 행동** | 시작 키워드 발화 후 bgm과 함께 브리핑을 청취. 별도 조작 불필요 |
| **주요 기능** | - `bgm/opening.mp3` 재생 시작 (트리거 감지 즉시)<br>- **[0초~51.6초] 환영 인사**: 설정된 언어/사투리로 환영 인사 TTS 출력<br>- **[51.7초~53초] 시작 멘트**: 강렬하고 활기차며 힘찬 짧고 굵은 시작 멘트 TTS 출력 (예: "드가자!", "Go!")<br>- **[53.2초~] 관심사 리포트**: 관심사 수집 모듈로부터 받은 데이터를 순서대로 TTS 리포트<br>&nbsp;&nbsp;&nbsp;→ Redmine/JIRA: "오늘 할당된 티켓은 N건입니다. [티켓명1], [티켓명2]..."<br>&nbsp;&nbsp;&nbsp;→ 날씨: "오늘 날씨는 ..."<br>&nbsp;&nbsp;&nbsp;→ 주식: "현재 [티커] 주가는 ..."<br>- 모든 리포트 완료 → `bgm/opening.mp3` 종료<br>- 리포트 완료 후 업무 지시 대기 상태로 전환<br><br>**BGM 파일:**<br>- `bgm/opening.mp3` — 단일 BGM 파일. 0~51.6초 환영 구간, 51.7~53초 빌드업 구간, 53.2초~ 브리핑 구간에 맞춰 구성<br><br>**BGM 타임코드 TTS 동기화 전략:**<br>TTS 출력 시간은 텍스트 길이와 네트워크 지연에 따라 가변적이므로, 다음 두 가지 방식을 결합하여 타임코드 내 완료를 보장한다.<br>1. **AI 추천 멘트**: 환영 인사 텍스트를 AI 모델에 요청할 때 "51.6초 이내 발화 완료 가능한 길이로 작성"이라는 조건을 프롬프트에 포함하여 구간에 맞는 스크립트를 생성<br>2. **TTS 속도 조절**: TTS API의 `speed` 파라미터(OpenAI TTS: 0.25~4.0 지원)를 활용하여 생성된 멘트가 목표 타임코드(51.6초/1.3초) 내에 맞게 재생 속도를 조절. 속도 조절 후에도 자연스러운 발화 품질이 유지되는 범위(0.85~1.15 권장) 내에서 적용<br>3. **잔여 시간 패딩**: 멘트가 구간보다 일찍 끝난 경우 짧은 무음(silence)을 삽입하여 다음 구간 시작 타임코드까지 대기 |
| **다음 이동** | 브리핑 완료 → 음성 처리 모듈의 업무 지시 대기 상태로 복귀 |

---

### 관심사 수집 모듈

> **구현 기능:** `F005` | **호출:** 오프닝 브리핑 모듈 내부

| 항목 | 내용 |
|------|------|
| **역할** | 설정된 각 관심사 소스(Redmine, JIRA, 날씨, 주식 API 등)로부터 데이터를 수집하고 TTS 출력에 적합한 자연어 요약 텍스트로 변환 |
| **진입 경로** | 오프닝 브리핑 모듈에서 53.2초 시점에 호출 (관심사 리포트 구간 시작 전 데이터 준비) |
| **사용자 행동** | 별도 조작 없음. 백그라운드에서 자동 수집 |
| **주요 기능** | - **업무 툴 연동 (설정된 하나만 실행)**:<br>&nbsp;&nbsp;&nbsp;→ Redmine: `GET /issues.json?assigned_to_id=me&status_id=*` — 할당된 미완료 이슈 목록 조회 (`status_id=open`은 버전에 따라 동작 불일치, 설정 파일에 숫자 ID 직접 지정 옵션 제공)<br>&nbsp;&nbsp;&nbsp;→ JIRA Cloud: `GET /rest/api/2/search` + JQL `assignee = currentUser() AND statusCategory != Done` — 할당된 미완료 이슈 목록 조회 (Bearer Token + 이메일 인증). v2 우선 사용(v3보다 안정적)<br>&nbsp;&nbsp;&nbsp;→ JIRA Server/Data Center: 동일 JQL, Personal Access Token 인증<br>- **날씨 연동**: OpenWeatherMap API로 현재 위치 또는 설정된 위치의 오늘 날씨 조회<br>- **주식 연동**: Finnhub API로 설정된 티커 목록의 현재가 및 전일 대비 조회 (무료 60회/분, 일일 브리핑에 충분)<br>- **사용자 지정**: 설정에서 추가한 커스텀 URL/API 엔드포인트로 데이터 조회<br>- 수집된 원시 데이터를 AI 모델로 자연어 요약 생성 |
| **다음 이동** | 수집 완료 → 요약 텍스트를 오프닝 브리핑 모듈로 반환 |

---

### TTS 모듈

> **구현 기능:** `F006` | **호출:** 오프닝 브리핑, AI 에이전트 실행 엔진

| 항목 | 내용 |
|------|------|
| **역할** | 텍스트 입력을 설정된 언어 및 사투리 특성에 맞는 자연스러운 음성으로 합성하여 스피커로 출력 |
| **진입 경로** | 오프닝 브리핑 모듈 또는 AI 에이전트 실행 엔진에서 출력 텍스트 전달 시 호출 |
| **사용자 행동** | 별도 조작 없음. 음성 출력을 청취 |
| **주요 기능** | - 설정된 AI 모델의 TTS API 또는 시스템 TTS(macOS `say` 명령) 활용<br>- 언어별 자연스러운 발화: korean / japanese / english<br>- korean 선택 시 사투리 프롬프트 적용 (경상도/전라도/충청도/제주도/강원도 특성 반영)<br>- 오프닝 브리핑의 고정 타임코드(51.6초/53초/53.2초)에 맞춰 각 구간별 TTS 출력 타이밍 동기화<br>- bgm 재생 중에도 음성이 명확히 들리도록 음량 균형 조절 |
| **다음 이동** | 출력 완료 → 호출한 모듈로 제어 반환 |

---

### AI 에이전트 실행 엔진

> **구현 기능:** `F007`, `F008`, `F009`, `F011` | **실행:** 오프닝 브리핑 완료 후 상시 대기

| 항목 | 내용 |
|------|------|
| **역할** | 사용자의 자연어 음성 지시를 해석하고, Claude Code의 핵심 패턴(도구 호출 루프)을 참고한 단계적 확장 구조로 실제 애플리케이션을 실행하거나 조작하여 업무를 수행. 지시가 불명확한 경우 명확화 질문 |
| **진입 경로** | 오프닝 브리핑 완료 후 자동으로 업무 지시 대기 상태 진입, 이후 음성 지시 수신 시마다 실행 |
| **사용자 행동** | 자연어로 업무 지시 (예: "어제 커밋한 내용 정리해서 JIRA 티켓 코멘트에 달아줘", "크롬 열고 지메일 확인해줘") |
| **주요 기능** | - 음성 처리 모듈로부터 텍스트 수신<br>- 설정된 AI 모델(Anthropic/OpenAI) API로 지시 해석 및 실행 계획 수립<br>- **MVP 지원 도구** (4가지로 한정):<br>&nbsp;&nbsp;&nbsp;→ 쉘 명령 실행: `execa`를 통한 터미널 명령 직접 실행 (git, 파일 조작 등)<br>&nbsp;&nbsp;&nbsp;→ 파일 읽기/쓰기: Node.js `fs`를 통한 로컬 파일 시스템 접근<br>&nbsp;&nbsp;&nbsp;→ 앱 실행: `open` 명령 + JXA를 통한 macOS 앱 실행 (Chrome, VSCode `code` CLI, IntelliJ `idea` CLI 등)<br>&nbsp;&nbsp;&nbsp;→ Chrome URL 네비게이션: JXA를 통한 Chrome 탭 열기 및 URL 이동<br>- **Post-MVP 확장 예정**: 웹 폼 입력, 에디터 내부 UI 조작, 복잡한 멀티스텝 앱 조작<br>- **단계별 진행 상황 TTS 보고** (수행 중 및 완료 시)<br>- **명확화 질문**: 지시 해석 불가 또는 수행 불가 시 TTS로 구체적 질문 후 추가 음성 입력 대기<br>- Claude Code의 핵심 패턴(도구 호출 루프)을 참고한 단계적 확장 구조: 파일 읽기/쓰기, 명령 실행, 결과 해석 및 보고 |
| **다음 이동** | 업무 완료 → 결과 TTS 보고 후 다음 지시 대기 / 명확화 필요 → 질문 TTS 출력 후 음성 입력 대기 |

---

### 설정 파일 모듈

> **구현 기능:** `F010` | **위치:** `~/.valet-pilot/config.json`

| 항목 | 내용 |
|------|------|
| **역할** | 모든 사용자 설정을 로컬 파일로 영속 저장하고 에이전트 시작 시 로드 |
| **진입 경로** | Setup Wizard 완료 시 저장, `valet-pilot start` 실행 시 자동 로드 |
| **사용자 행동** | `valet-pilot config` 명령으로 현재 설정 조회, `valet-pilot setup` 재실행으로 수정 |
| **주요 기능** | - 설정 파일 경로: `~/.valet-pilot/config.json`<br>- 저장 항목: 닉네임, AI 모델 종류, API 키(암호화 저장), 언어, 사투리, 관심사 목록 및 각 인증 정보, 등록된 앱 목록<br>- `valet-pilot config` 명령으로 현재 설정 CLI 출력 (API 키는 마스킹)<br>- 설정 파일 없이 `start` 실행 시 자동으로 Setup Wizard로 안내 |
| **다음 이동** | 로드 완료 → 에이전트 실행 모듈로 설정 전달 |

---

### 사전 요구사항 검증 모듈

> **구현 기능:** `F012` | **실행:** `valet-pilot start` 최초 단계

| 항목 | 내용 |
|------|------|
| **역할** | 에이전트 실행에 필요한 macOS 시스템 권한 및 외부 의존성을 사전 점검하고, 미충족 항목에 대해 사용자에게 해결 안내를 제공 |
| **진입 경로** | `valet-pilot start` 실행 시 음성 대기 상태 진입 전 자동 실행 |
| **사용자 행동** | 안내 메시지 확인 후 시스템 설정에서 권한 허용 또는 필요 패키지 설치 |
| **주요 기능** | - **마이크 권한 검증**: macOS 마이크 접근 권한(`Privacy & Security > Microphone`) 상태 확인. 미허용 시 "시스템 설정 > 개인정보 보호 및 보안 > 마이크에서 터미널 앱을 허용해주세요" 안내 출력 후 종료<br>- **접근성 권한 검증**: macOS 접근성 권한(`Privacy & Security > Accessibility`) 상태 확인. JXA 앱 제어에 필요. 미허용 시 `osascript`를 통해 시스템 설정의 접근성 화면 자동 오픈(`open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"`) → 사용자 권한 부여 확인 대기 → 완료 후 재시도 또는 재기동 안내 출력<br>- **오프라인 STT 의존성 검증** (오프라인 모드 설정 시에만): SoX 설치 여부 확인 (`which sox`). 미설치 시 `brew install sox` 안내 출력<br>- **설정 파일 존재 확인**: `~/.valet-pilot/config.json` 없으면 Setup Wizard로 안내<br>- 모든 검증 통과 시 음성 대기 상태로 진행 |
| **다음 이동** | 검증 통과 → 음성 대기 상태 진입 / 실패 → 안내 메시지 출력 후 종료 (접근성 권한 미허용 시: 시스템 설정 화면 자동 오픈 후 사용자 확인 대기 → 재시도 흐름) |

---

## 데이터 모델

### Config (로컬 설정 파일: `~/.valet-pilot/config.json`)

| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| agent_nickname | AI 에이전트 닉네임 | string |
| ai_model | 선택된 AI 모델 | enum: anthropic / openai (Post-MVP: google / llama 확장) |
| ai_api_key | AI 모델 API 키 (암호화 저장) | string (encrypted) |
| language | 응답 언어 | enum: korean / japanese / english |
| dialect | 사투리 (language=korean 시) | enum: standard / gyeong-sang / jeolla / chung-cheong / jeju / gang-won |
| work_tool | 업무 툴 설정 (단일) | object → WorkTool |
| interests | 날씨/주식/사용자 지정 관심사 목록 | array → Interest |
| registered_apps | 업무 지시에서 사용할 앱 목록 | array → AppConfig |

### WorkTool (업무 툴 설정 — Redmine 또는 JIRA 중 하나)

| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| type | 업무 툴 종류 | enum: redmine / jira |
| base_url | 서버 URL | string |
| auth_type | 인증 방식 | enum: api_key (Redmine) / cloud (JIRA Cloud) / server_pat (JIRA Server) |
| api_key | API Key (Redmine, JIRA Server PAT) | string (encrypted) |
| email | 사용자 이메일 (JIRA Cloud 전용) | string \| null |

### Interest (날씨/주식/사용자 지정 관심사)

| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| id | 관심사 식별자 | enum: weather / stock / custom |
| name | 표시 이름 | string |
| auth | 인증 정보 (API Key 등) | object |
| custom_config | 사용자 지정 설정 (endpoint 등) | object \| null |

### AppConfig (등록 애플리케이션)

| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| name | 앱 이름 (음성 지시에서 참조) | string |
| bundle_id | macOS 번들 ID 또는 앱 경로 | string |
| launch_args | 실행 시 전달할 기본 인수 | array |

### SessionLog (실행 이력, 선택적 로컬 저장)

| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| id | 세션 ID | UUID |
| started_at | 에이전트 시작 시각 | datetime |
| commands | 이번 세션의 음성 지시 목록 | array (text, result, timestamp) |
| briefing_summary | 오프닝 브리핑 요약 텍스트 | string |

---

## 기술 스택

### 런타임 및 언어

- **Node.js 22 LTS** - 비동기 I/O 처리, CLI 도구 생성에 최적
- **TypeScript 5.6+** - 타입 안전성 보장, 모듈 간 인터페이스 명확화

### CLI 프레임워크

- **Commander.js 12.x** - 하위 명령(`setup`, `start`, `config`) 라우팅
- **Inquirer.js 10.x** - Setup Wizard 인터랙티브 프롬프트

### 음성 인식 (STT)

- **OpenAI Realtime API** (기본) - WebSocket 기반 실시간 스트리밍 STT, 한국어 포함 다국어 인식, 트리거 키워드 감지 및 업무 지시 모두 처리
  - 서버 측 Node.js에서 WebSocket으로 마이크 오디오 스트림 직접 전달
  - 별도 시스템 의존성(SoX 등) 불필요
- **`nodejs-whisper`** (선택, 오프라인 모드) - whisper.cpp N-API 바인딩, Python 의존성 없이 로컬 STT 실행
  - Setup에서 오프라인 모드 활성화 시 사용
  - macOS 마이크 캡처를 위해 `node-record-lpcm16` + SoX 필요 (`brew install sox`)
  - **주의**: v0.3.0 pre-release 상태이며 단일 관리자 패키지. Node.js 22 공식 호환 여부 사전 검증 필요. 검증 실패 시 `whisper.cpp` 바이너리를 `child_process.spawn`으로 직접 실행하는 방식으로 대체
  - ~~`faster-whisper`~~ (Python 전용 라이브러리, Node.js 브리지 아키텍처 미지원, npm 단일 설치로 Python 의존성 해결 불가 — 제외)
  - ~~OpenAI Whisper API 단독 기본 사용~~ (파일 업로드 방식, 스트리밍 미지원, 1~5초 지연 — 제외)

### 음성 합성 (TTS)

- **OpenAI TTS API** (기본) - 자연스러운 다국어 음성. `speed` 파라미터(0.25~4.0) 지원으로 BGM 타임코드 동기화에 활용
- **macOS `say` 명령** (폴백) - 추가 API 키 없이 시스템 TTS 사용 (`-v Narae`로 한국어 음성 지원, 해당 언어 팩 설치 필요)
- 사투리 표현: AI 모델을 통해 사투리 어휘/어미 텍스트 변환 후 TTS 입력 (억양은 표준어로 출력되며, 사투리 설정은 STT가 아닌 TTS 출력 전용으로 적용)

### AI 모델 연동

- **Anthropic SDK (`@anthropic-ai/sdk`)** - Claude 모델 (claude-3-5-sonnet 등)
- **OpenAI SDK (`openai`)** - GPT-4o 등
- Adapter 패턴으로 AI 모델 인터페이스를 추상화하여 Post-MVP에서 확장 용이하게 설계
  - ~~Google AI SDK (`@google/generative-ai`)~~ — Post-MVP 확장 예정
  - ~~Ollama (로컬 Llama 실행 환경)~~ — Post-MVP 확장 예정

### 오디오 재생

- **`play-sound`** 또는 **`node-speaker`** - `bgm/opening.mp3` 재생
- `ffmpeg` (선택) - 오디오 믹싱 (bgm + TTS 동시 재생 볼륨 제어)

### macOS 자동화 (애플리케이션 조작)

- **`@jxa/run`** (JXA: JavaScript for Automation) - macOS 앱 제어 주력 도구 (Chrome, Finder, Terminal 등 AppleScript 딕셔너리 지원 앱)
- **`osascript`** (쉘 호출) - JXA 미지원 시나리오에서 AppleScript 직접 실행 보조 수단
- **앱별 CLI 인터페이스 활용**: VSCode(`code` CLI), IntelliJ(`idea` CLI)로 파일 열기/프로젝트 실행
  - ~~`@nut-tree/nut-js`~~ (npm public registry에서 제거, 유료 private registry 전환으로 일반 배포 불가 — 제외)
  - ~~`robotjs`~~ (개발 중단, Node.js 22 바이너리 호환 불가 — 제외)
- **`execa`** - 쉘 명령 및 터미널 앱 실행

### 외부 서비스 연동

- **Redmine REST API** - 이슈 조회 (`/issues.json?assigned_to_id=me&status_id=*`). `status_id=open`은 Redmine 버전에 따라 동작 불일치 가능하므로 `status_id=*`(미완료 전체) 또는 설정 파일에 숫자 ID를 직접 지정할 수 있도록 구현
- **JIRA REST API v2** - 이슈 조회 (`GET /rest/api/2/search`). v3 엔드포인트(`POST /rest/api/3/search/jql`)보다 안정적인 v2를 우선 사용. Post-MVP에서 v3로 마이그레이션
- **OpenWeatherMap API** - 날씨 정보 조회
- **Finnhub API** (기본) - 주식 시세 조회. 무료 티어 60회/분으로 일일 브리핑에 충분. ~~Alpha Vantage~~ (무료 25회/일, 복수 종목 조회 시 수일 내 소진으로 제외), ~~Yahoo Finance~~ (공식 공개 API 없음, 비공식 엔드포인트 의존으로 제외)
- **`axios`** - HTTP 클라이언트 (외부 API 통신)

### 설정 저장

- **`zod`** + Node.js `fs` - `~/.valet-pilot/config.json` 직접 관리 및 스키마 검증. ~~`conf`~~ (Electron 앱 중심 설계, CLI 전용으로 불필요한 의존성 — 제외)
- **`keytar3`** - macOS Keychain 연동으로 API 키 안전 저장. ~~`keytar`~~ (2022년 12월 공식 아카이브, Node.js 22 네이티브 addon 호환 미검증 — 제외). `keytar3`도 호환 문제 발생 시 Node.js 내장 `crypto` 모듈의 AES-256-GCM으로 API 키 암호화 후 config.json 저장으로 대체

### 패키지 배포

- **npm** - 패키지 배포 및 전역 설치 (`npm install -g valet-pilot`)
- **pkg** 또는 **`@vercel/ncc`** - 단일 바이너리 빌드 (선택)
- ~~Homebrew (`brew install valet-pilot`)~~ — Formula 등록 승인 절차(수 주 소요) 및 GitHub Release 아티팩트 관리 필요. Post-MVP에서 Homebrew Tap 방식으로 지원 예정

---

## 정합성 검증

### 기능 명세 -> 모듈 연결 검증

| 기능 ID | 기능명 | 구현 모듈 | 검증 |
|---------|--------|----------|------|
| F001 | CLI 설치 및 실행 | CLI 진입점 | 확인 |
| F002 | 초기 설정 (Setup Wizard) | Setup Wizard | 확인 |
| F003 | 음성 인식 (STT) | 음성 처리 모듈 | 확인 |
| F004 | 오프닝 브리핑 | 오프닝 브리핑 모듈 | 확인 |
| F005 | 관심사 데이터 수집 | 관심사 수집 모듈 | 확인 |
| F006 | TTS (음성 출력) | TTS 모듈 | 확인 |
| F007 | 자연어 업무 지시 처리 | AI 에이전트 실행 엔진 | 확인 |
| F008 | 애플리케이션 실행 및 조작 | AI 에이전트 실행 엔진 | 확인 |
| F009 | 명확화 질문 | AI 에이전트 실행 엔진 | 확인 |
| F010 | 설정 파일 관리 | 설정 파일 모듈 | 확인 |
| F011 | AI 모델 선택 및 API 연동 | AI 에이전트 실행 엔진 | 확인 |
| F012 | 사전 요구사항 검증 | 사전 요구사항 검증 모듈 | 확인 |

---

## 오프닝 브리핑 플로우 상세

> `bgm/opening.mp3` 단일 파일의 **고정 타임코드** 기반으로 TTS 출력 구간을 동기화한다.
> BGM의 음악적 구성(인트로 → 빌드업 → 브리핑 배경)에 맞춰 TTS가 자연스럽게 연결된다.
> TTS 출력 시간의 가변성(텍스트 길이, 네트워크 지연)은 **AI 추천 멘트 + TTS 속도 조절 + 무음 패딩** 조합으로 보정한다.

```
[트리거 감지]
    ↓
[bgm/opening.mp3 재생 시작]
    ↓
[0초 ~ 51.6초: 환영 인사]
    AI 추천 멘트(51.6초 이내 발화 조건) + TTS speed 파라미터 조절로 구간 내 완료
    멘트 종료 후 51.6초까지 잔여 시간이 있으면 무음(silence) 패딩으로 대기
    ↓
[51.7초 ~ 53초: 시작 멘트]
    강렬하고 활기차며 힘찬 짧고 굵은 시작 멘트 TTS 출력 (1.3초 이내)
    ↓
[53.2초 ~: 관심사 리포트]
    관심사 데이터 수집 결과를 순서대로 TTS 출력
    ↓
[종료]
    리포트 완료 → bgm/opening.mp3 종료
    업무 지시 대기 상태 전환
```

**BGM 파일 요구사항:**

| 파일 | 역할 | 특성 |
|------|------|------|
| `bgm/opening.mp3` | 오프닝 브리핑 전체 배경음 | 단일 파일. 0~51.6초 인트로(환영 분위기), 51.7~53초 빌드업(강렬한 전환), 53.2초~ 브리핑 배경(차분한 정보 전달 톤)으로 구성 |
