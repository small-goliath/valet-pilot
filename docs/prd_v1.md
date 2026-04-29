# Valet Pilot MVP PRD

## 핵심 정보

**목적**: 매일 출근 시 업무 현황, 날씨 등 정보 수집 및 AI 지시에 드는 반복 작업을 음성 자동화로 제거한다.
**사용자**: macOS 환경에서 근무하며 Redmine/JIRA 기반 프로젝트를 수행하는 1인 개발자 또는 소규모 팀 구성원.

---

## 사용자 여정

```
1. [백그라운드 대기 상태]
   - valet-pilot 프로세스가 상시 실행 중
   - 마이크 리스닝: 박수 감지 + wake word 감지 동시 활성화
   ↓ [박수 두 번 / wake word / Ctrl+Shift+V / valet-pilot briefing]

2. [브리핑 시작]
   - 300ms 이내 BGM(opening.mp3) 재생 시작
   - 브리핑 준비 데이터가 사전에 캐시되어 있어야 함
   ↓

   [0초~51.6초] → 환영 인사 구간 (TTS 음성 출력)
   [51.7초~53초] → 힘찬 시작 선언 (TTS 음성 출력)
   [53.2초~] → 관심사 리포트 순차 재생 (TTS 음성 출력)
   ↓

3. [리포트 완료]
   - BGM fade-out (최대 59초 이내)
   - 음성 대화 대기 상태로 자동 전환
   ↓

4. [음성 대화 세션]
   - 사용자 발화 감지 → STT 변환 → AI 처리 → TTS 응답
   - 어플리케이션 제어 명령 포함 처리 가능
   - 시간 제한 없이 자유 대화 가능
   ↓ [퇴근 / 끝 / 종료 / Ctrl+Shift+Q / valet-pilot stop / 무응답 2시간]

5. [세션 종료]
   - 세션 요약본 생성 → ~/.valet-pilot/history/ 저장
   - 종료 인사 TTS 출력
   - 다음 트리거 대기 상태로 복귀 (1번으로 돌아감)
```

---

## 기능 명세

### 1. MVP 핵심 기능

| ID | 기능명 | 설명 | MVP 필수 이유 | 관련 페이지 |
|----|--------|------|--------------|------------|
| **F001** | 트리거 감지 | 박수 두 번(볼륨 임계값 -30dB, 800ms 이내), wake word, 키보드 단축키(Ctrl+Shift+V), CLI 명령을 통해 브리핑 또는 세션을 시작 | 사용자 인터랙션의 시작점으로 손 비움 상태에서 작동 필수 | 초기 설정 화면, 설정 변경 CLI |
| **F002** | 출근 브리핑 | BGM 구간별 타이밍(인사/선언/리포트)에 맞춰 TTS로 환영 인사, 시작 선언, 관심사 리포트를 순차 재생. 브리핑 데이터는 트리거 전 사전 준비 | 핵심 가치 제공: 출근 직후 1분 이내 업무 현황 파악 | 브리핑 실행 CLI |
| **F003** | Redmine 일감 조회 | 설정된 Redmine URL과 API 키로 나에게 할당된 open 상태 일감을 조회(최대 100건), 상태/우선순위/갱신일 기준 정렬하여 브리핑에 포함 | 업무 현황 파악을 위한 핵심 데이터 소스 | 초기 설정 화면, 브리핑 실행 CLI |
| **F004** | 음성 대화 (STT + TTS) | 사용자 발화를 Whisper(local, Apple Silicon: medium / Intel: small) 또는 Google STT(online fallback)로 변환하여 AI에 전달하고, AI 응답을 Edge TTS 또는 ElevenLabs로 음성 출력. Whisper avg_logprob 기반 신뢰도 70% 미만 시 재요청 | 핸즈프리 업무 지시를 위한 핵심 인터페이스 | 음성 대화 세션 CLI |
| **F005** | AI 모델 연동 | Kimi K2.5(기본), Claude, GPT, Gemini, Llama(로컬)를 공통 추상화 레이어로 호출. API 실패 시 재시도(1/2/4초) 후 2순위 모델 → Llama로 순차 fallback | 자연어 처리와 모든 대화의 두뇌 역할 | 초기 설정 화면, 음성 대화 세션 CLI |
| **F006** | 어플리케이션 제어 | 음성 명령으로 macOS 앱 실행/종료(Level 1), 포커스 전환(Level 2), AppleScript/JXA 기반 내부 조작(Level 3). 위험 명령은 사용자 확인 후 실행 | 키보드/마우스 없이 업무 도구 제어 | 음성 대화 세션 CLI |
| **F007** | 날씨 관심사 | 설정된 위치의 날씨 API 조회 결과를 브리핑에 포함 | 출근 브리핑 필수 생활 정보 | 초기 설정 화면, 브리핑 실행 CLI |

### 2. MVP 필수 지원 기능

| ID | 기능명 | 설명 | MVP 필수 이유 | 관련 페이지 |
|----|--------|------|--------------|------------|
| **F010** | 초기 설치 및 설정 | `npm install -g valet-pilot` 후 `valet-pilot init`으로 대화형 초기 설정. agent 닉네임, AI 모델, 언어, 사투리, 목소리, Redmine/날씨 등 관심사, 트리거 방식 설정. `~/.valet-pilot/config.yaml`에 저장 | 서비스 구동을 위한 최소 환경 구성 필수 | 초기 설정 화면 |
| **F011** | 설정 변경 | `valet-pilot config` 대화형 메뉴 또는 `valet-pilot config set <key> <value>` CLI 명령으로 설정 변경. config.yaml 직접 편집도 지원 | 사용자 환경 변화에 따른 설정 재구성 필수 | 설정 변경 CLI |
| **F012** | 대화 히스토리 관리 | 세션 내 전체 컨텍스트 유지(최근 50턴). 세션 종료 시 요약본을 `~/.valet-pilot/history/`에 저장. API 키 등 민감 정보는 마스킹 | 연속 대화 맥락 유지 및 이력 관리 필수 | 음성 대화 세션 CLI |
| **F013** | 세션 종료 처리 | 음성 종료 키워드(퇴근/끝/종료/수고했어), Ctrl+Shift+Q, CLI 명령, 무응답 2시간 자동 종료. 종료 인사 후 다음 트리거 대기 상태로 전환 | 세션 생명주기 관리 및 리소스 정리 필수 | 음성 대화 세션 CLI |
| **F014** | 사용자 지정 관심사 | config.yaml의 interests 배열에 REST API, RSS/Atom, 웹 스크래핑, 로컬 파일 유형으로 커스텀 관심사 추가. 리포트 템플릿 지정 가능 | Redmine/날씨 외 사용자 필요 정보 자율 확장 | 초기 설정 화면, 설정 변경 CLI |

### 3. MVP 이후 기능 (제외)

- JIRA 연동 (Phase 2 이후)
- Google Drive / Confluence / Notion 연동
- 사투리 전용 TTS 모델 (Phase 1에서는 LLM 프롬프트 변환 방식으로 대체)
- 자동 업데이트 설치 (알림만 제공)
- 웹 UI 또는 대시보드

---

## 메뉴 구조

```
CLI 명령 구조 (valet-pilot)
├── valet-pilot init
│   └── 기능: F010 (대화형 초기 설정)
├── valet-pilot start
│   └── 기능: F001 (백그라운드 데몬 실행, 트리거 대기)
├── valet-pilot briefing
│   └── 기능: F002, F003, F007, F014 (즉시 브리핑 실행)
├── valet-pilot stop
│   └── 기능: F013 (세션 종료 및 데몬 중지)
└── valet-pilot config
    ├── (인수 없음) → 대화형 메뉴 - F011
    └── set <key> <value> → 직접 값 설정 - F011

valet-pilot config 대화형 메뉴
├── AI 에이전트 설정
│   └── 기능: F010, F011 (닉네임, 모델, 언어, 사투리, 목소리 변경)
├── 트리거 설정
│   └── 기능: F001, F011 (박수/wake word/단축키 on/off 및 파라미터 변경)
├── 관심사 설정
│   └── 기능: F003, F007, F014, F011 (Redmine URL/API키, 날씨 위치, 커스텀 관심사 추가/삭제)
├── BGM 설정
│   └── 기능: F002, F011 (파일 경로, 구간별 타이밍 변경)
└── 세션 설정
    └── 기능: F013, F011 (종료 키워드, 자동 종료 시간, 종료 인사 on/off)
```

---

## 페이지별 상세 기능

### 초기 설정 화면

> **구현 기능:** `F010`, `F003`, `F005`, `F007`, `F014` | **진입:** `valet-pilot init` 실행

| 항목 | 내용 |
|------|------|
| **역할** | 서비스 최초 구동을 위한 필수 설정을 대화형으로 수집하고 config.yaml 생성 |
| **진입 경로** | `valet-pilot init` 명령 실행 시 (npm 전역 설치 후 최초 1회 필수) |
| **사용자 행동** | inquirer 기반 프롬프트 순서에 따라 닉네임, AI 모델 선택, 언어/사투리/목소리 선택, Redmine URL과 API 키 입력, 날씨 위치 입력, 커스텀 관심사 추가 여부 결정 |
| **주요 기능** | - AI 에이전트 닉네임 입력 (기본값: "자비스")<br>- AI 모델 선택 목록 표시 (Kimi K2.5 기본, Claude/GPT/Gemini/Llama 선택 가능)<br>- 언어 선택 (korean/japanese/english), 사투리 선택 (한국어인 경우)<br>- 목소리 선택 (남성 2종 / 여성 2종)<br>- Redmine URL + API 키 입력 및 연결 테스트 (macOS Keychain에 API 키 저장)<br>- 날씨 위치 입력<br>- 트리거 방식 on/off 설정<br>- **초기 설정 완료** 후 `~/.valet-pilot/config.yaml` 파일 생성 |
| **다음 이동** | 성공 → "설정이 완료되었습니다. `valet-pilot start`로 시작하세요." 출력, 실패(Redmine 연결 오류 등) → 재입력 요청 |

---

### 설정 변경 CLI

> **구현 기능:** `F001`, `F002`, `F005`, `F007`, `F011`, `F013`, `F014` | **진입:** `valet-pilot config` 또는 `valet-pilot config set`

| 항목 | 내용 |
|------|------|
| **역할** | 기존 config.yaml을 안전하게 조회하고 수정하는 인터페이스 |
| **진입 경로** | `valet-pilot config` (대화형 메뉴) 또는 `valet-pilot config set <key> <value>` (직접 지정) |
| **사용자 행동** | 변경할 설정 항목을 메뉴에서 선택하거나 키-값을 직접 지정하여 즉시 반영 |
| **주요 기능** | - AI 에이전트 설정 변경 (닉네임, 모델, 언어, 사투리, 목소리)<br>- 트리거 설정 변경 (박수 임계값/간격, wake word 목록, 키보드 단축키 on/off)<br>- 관심사 설정 변경 (Redmine URL/API키, 날씨 위치, 커스텀 관심사 추가/삭제)<br>- BGM 파일 경로 및 구간 타이밍 변경<br>- 세션 종료 키워드, 자동 종료 시간, 종료 인사 on/off 변경<br>- 변경 즉시 config.yaml에 반영 (실행 중인 데몬에 HUP 신호로 리로드) |
| **다음 이동** | 성공 → "설정이 변경되었습니다." 출력, 실패(잘못된 값) → 유효성 오류 메시지 출력 후 재입력 요청 |

---

### 브리핑 실행 CLI

> **구현 기능:** `F001`, `F002`, `F003`, `F007`, `F014` | **진입:** 트리거 감지 또는 `valet-pilot briefing`

| 항목 | 내용 |
|------|------|
| **역할** | 출근 브리핑의 전체 파이프라인을 BGM 타이밍에 맞춰 순차 실행 |
| **진입 경로** | 박수 두 번 감지, wake word 인식, Ctrl+Shift+V, 또는 `valet-pilot briefing` CLI 명령 |
| **사용자 행동** | 트리거 입력 후 수동 조작 없이 전체 브리핑을 수동 청취 (중단 불필요) |
| **주요 기능** | - 트리거 감지 후 300ms 이내 BGM(opening.mp3) 재생 시작<br>- 0초~51.6초 구간: TTS로 설정된 언어/사투리로 환영 인사 재생<br>- 51.7초~53초 구간: TTS로 힘찬 시작 선언 재생<br>- 53.2초~: 설정된 관심사 순서대로 리포트 재생 (Redmine 일감 수, 우선순위별 목록, 날씨, 커스텀 관심사)<br>- 리포트 완료 시 BGM fade-out (최대 59초에서 강제 종료)<br>- 브리핑 데이터는 트리거 시점 이전에 사전 캐시 준비 (BGM 재생 중 외부 통신 없음)<br>- **캐시 갱신**: 데몬 실행 중 매 15분마다 백그라운드에서 관심사 API 호출하여 `~/.valet-pilot/cache/briefing/`에 저장. TTL 30분 (갱신 실패 시 기존 캐시 유지, 최대 2시간까지 연장)<br>- 브리핑 중 추가 트리거 입력 무시 (중복 실행 방지)<br>- 관심사 조회 실패 시 해당 항목 건너뛰고 다음 관심사로 계속 진행 |
| **다음 이동** | 완료 → 음성 대화 세션 CLI 자동 전환 |

---

### 음성 대화 세션 CLI

> **구현 기능:** `F004`, `F005`, `F006`, `F012`, `F013` | **진입:** 브리핑 완료 후 자동 전환 또는 세션 활성 중 상시 대기

| 항목 | 내용 |
|------|------|
| **역할** | 사용자와 AI 에이전트 간 실시간 음성 대화 및 어플리케이션 제어 명령 처리 |
| **진입 경로** | 브리핑 완료 후 자동 전환, 또는 데몬 실행(`valet-pilot start`) 후 트리거 없이 직접 발화 |
| **사용자 행동** | 자유롭게 질문하거나 명령을 발화하고 AI 응답을 음성으로 청취. 시간 제한 없음 |
| **주요 기능** | - 사용자 발화 감지 → Whisper(로컬) STT 변환 (발화 종료 후 1초 이내)<br>- 인식 신뢰도 70% 미만 시 "다시 한번 말씀해주시겠습니까?" 재요청 (3회 연속 실패 시 텍스트 입력 안내)<br>- AI 모델로 텍스트 전달 (첫 토큰 스트리밍 시작 2초 이내)<br>- 어플리케이션 제어 의도 감지 시 macOS Level 1/2/3 명령 실행 (위험 명령은 음성 확인 요청)<br>- Edge TTS 또는 ElevenLabs로 응답 음성 출력 (텍스트 수신 후 500ms 이내 시작)<br>- 세션 내 최근 50턴 컨텍스트 유지<br>- 종료 키워드 또는 단축키 감지 시 세션 요약본 생성 후 히스토리 저장, 종료 인사 출력 |
| **다음 이동** | 종료 트리거 감지 → 백그라운드 대기 상태로 복귀, 무응답 2시간 → 자동 세션 종료 |

---

## 데이터 모델

### config (config.yaml 스키마)

| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| agent.nickname | AI 에이전트 호칭 | String |
| agent.model | 사용 AI 모델 식별자 | Enum (kimi-k2.5, claude, gpt, gemini, llama) |
| agent.language | 출력 언어 | Enum (korean, japanese, english) |
| agent.dialect | 사투리 설정 (한국어 전용) | String (경상도, 전라도, 제주도, 강원도 등) |
| agent.voice | TTS 목소리 식별자 | String (male-01, male-02, female-01, female-02) |
| agent.model_priority | AI 모델 fallback 우선순위 (첫 번째가 기본 모델) | String[] (예: ["kimi-k2.5", "claude", "llama"]) |
| trigger.clap.enabled | 박수 트리거 활성화 여부 | Boolean |
| trigger.clap.threshold_db | 박수 감지 볼륨 임계값 | Number (기본: -30) |
| trigger.clap.interval_ms | 두 번 박수 최대 간격 | Number (기본: 800) |
| trigger.wake_word.enabled | wake word 트리거 활성화 여부 | Boolean |
| trigger.wake_word.words | wake word 목록 | String[] |
| trigger.keyboard.enabled | 키보드 단축키 트리거 활성화 여부 | Boolean |
| trigger.keyboard.shortcut | 키보드 단축키 | String (기본: Ctrl+Shift+V) |
| bgm.file | BGM 파일 경로 | String |
| bgm.greeting_end | 환영 인사 구간 종료 시각(초) | Number (기본: 51.6) |
| bgm.shout_start | 시작 선언 구간 시작 시각(초) | Number (기본: 51.7) |
| bgm.shout_end | 시작 선언 구간 종료 시각(초) | Number (기본: 53.0) |
| bgm.report_start | 리포트 구간 시작 시각(초) | Number (기본: 53.2) |
| bgm.max_duration | BGM 최대 재생 시간(초) | Number (기본: 59) |
| session.end_keywords | 세션 종료 음성 키워드 | String[] |
| session.auto_end_minutes | 무응답 자동 종료 시간(분) | Number (기본: 120) |
| session.farewell_enabled | 종료 인사 활성화 여부 | Boolean |
| stt.whisper_model | Whisper 모델 크기 | Enum (small, medium, large-v3) 기본: medium |
| stt.fallback_to_cloud | Whisper 성능 부족 시 Google STT 자동 전환 | Boolean (기본: true) |
| cache.refresh_interval_minutes | 브리핑 캐시 갱신 주기(분) | Number (기본: 15) |
| interests | 관심사 목록 | Interest[] |

### Interest (관심사 항목)

| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| type | 관심사 유형 | Enum (redmine, jira, weather, google_drive, custom) |
| name | 관심사 표시명 | String |
| url | 서비스 엔드포인트 URL | String |
| api_key | 인증 키 (환경변수 참조 형태) | String (${ENV_VAR}) |
| source.type | 커스텀 데이터 소스 유형 | Enum (rest_api, rss, scraping, local_file) |
| source.method | HTTP 메서드 (rest_api 유형 시 필수) | Enum (GET, POST) 기본: GET |
| source.extract | 데이터 추출 경로 (JSONPath 또는 CSS selector) | String |
| schedule | 데이터 갱신 주기 | String (cron 표현식 또는 preset: "daily", "hourly", "realtime") 기본: "daily" |
| report_template | 자연어 변환 템플릿 | String |

### SessionHistory (세션 이력)

| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| session_id | 세션 고유 식별자 | UUID |
| trigger_type | 세션 시작 트리거 유형 | Enum (clap, wake_word, keyboard, cli) |
| started_at | 세션 시작 시각 | ISO8601 DateTime |
| ended_at | 세션 종료 시각 | ISO8601 DateTime |
| summary | AI 생성 세션 요약 | String |
| turns | 대화 턴 목록 (최근 50턴) | Turn[] |

### Turn (대화 턴)

| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| role | 발화 주체 | Enum (user, assistant) |
| content | 발화 내용 (민감 정보 마스킹 적용) | String |
| timestamp | 발화 시각 | ISO8601 DateTime |
| model | 응답 생성 AI 모델 (role: assistant인 경우만 해당, user인 경우 null) | String? |

### BriefingCache (브리핑 캐시)

| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| interest_type | 관심사 유형 식별자 | String |
| data | 캐시된 API 응답 데이터 (JSON) | Object |
| fetched_at | 마지막 갱신 성공 시각 | ISO8601 DateTime |
| ttl_minutes | 캐시 유효 시간 (기본: 30분) | Number |
| max_stale_minutes | 갱신 실패 시 최대 연장 시간 (기본: 120분) | Number |
| last_error | 마지막 갱신 실패 사유 (성공 시 null) | String? |
| tts_audio_path | 사전 합성된 TTS 오디오 파일 경로 | String? |

> 저장 경로: `~/.valet-pilot/cache/briefing/{interest_type}.json`
> 갱신 주기: 데몬 실행 중 매 15분 (config.yaml `cache.refresh_interval_minutes`로 변경 가능)

---

## 기술 스택

### 런타임 및 언어

- **Node.js 24 LTS** - 런타임 기반 (최소 요구 환경)
- **TypeScript 5.6+** - 타입 안전성 보장

### CLI 프레임워크

- **@inquirer/prompts** (v7.x) - 대화형 CLI 프롬프트 (개별 함수 방식 사용, inquirer.prompt() 레거시 API 금지)
- **commander.js** - CLI 명령어 파싱 및 라우팅
- **chalk** - 터미널 색상 출력

### 오디오 처리

- **ffmpeg** - 오디오 파일 처리 및 BGM 재생, fade-out (시스템 의존성, brew install ffmpeg)
- **portaudio + node-portaudio** - 실시간 마이크 입력 캡처 (시스템 의존성)
- **node-wav / sox** - 오디오 볼륨 분석 및 주파수 필터링 (박수 감지)

### STT (음성 인식)

- **openai/whisper** (로컬 Python 프로세스 또는 whisper.cpp) - 기본 STT 엔진
  - Apple Silicon Mac: whisper-medium (~1.5GB, Metal GPU 가속) 기본 사용
  - Intel Mac: whisper-small (~500MB) 사용, 정확도 저하 시 Google Cloud STT로 자동 전환
  - 모델 선택은 config.yaml `stt.whisper_model`로 사용자 재정의 가능
- **@google-cloud/speech** - 온라인 STT fallback (Intel Mac 기본 또는 Whisper 성능 부족 시)
- **Porcupine (picovoice)** - wake word 감지 (로컬, 저전력)

### TTS (음성 합성)

- **edge-tts** (Python CLI 또는 node-edge-tts 래퍼) - 기본 TTS, 무료, 다양한 한국어 음성
- **ElevenLabs API** - 고품질 TTS (유료, 선택적)
- TTS 캐싱: 정형 문장(인사말 등) 사전 합성하여 `~/.valet-pilot/cache/tts/`에 저장

### AI 모델 연동

- **axios** - HTTP 클라이언트 (AI API 및 관심사 REST API 공통)
- 공통 추상화 레이어로 아래 엔드포인트를 동일 인터페이스로 래핑:
  - Kimi K2.5: `https://api.moonshot.ai/v1` (Bearer Token, 기본 모델)
  - Claude: `https://api.anthropic.com/v1` (x-api-key)
  - GPT: `https://api.openai.com/v1` (Bearer Token)
  - Gemini: `https://generativelanguage.googleapis.com/v1` (API Key)
  - Llama: `http://localhost:11434` (Ollama, 로컬, 인증 없음)

### 설정 및 저장

- **js-yaml** - config.yaml 파싱 및 저장
- **macOS `security` CLI 래퍼** - macOS Keychain 연동 (`child_process.execFile('security', ...)` 방식으로 API 키 안전 저장. keytar는 아카이브(2022)되어 Node.js 24 비호환이므로 사용하지 않음)
- **dotenv** - 환경 변수 참조 지원 (`${ENV_VAR}` 형태)

### 시스템 제어 (macOS 전용)

- **@jxa/run** 또는 **osascript** CLI - AppleScript/JXA 기반 앱 제어
- **uiohook-napi** - 전역 키보드 단축키 감지 (node-global-key-listener는 2024년 7월 아카이브되어 Node.js 24 비호환이므로 사용하지 않음. macOS 접근성 권한 필수)

### 배포 및 패키징

- **npm** - 전역 설치 (`npm install -g valet-pilot`)
- **pkg** 또는 **nexe** - 단일 바이너리 패키징 (선택적)
- **SemVer** - 버전 관리 체계

---

## 비기능 요구사항 요약

### 성능 목표

| 항목 | 목표 |
|------|------|
| STT 변환 | 발화 종료 후 1초 이내 |
| AI 첫 토큰 응답 | 2초 이내 |
| TTS 음성 출력 시작 | 텍스트 수신 후 500ms 이내 |
| BGM 재생 시작 | 트리거 감지 후 300ms 이내 |
| 대기 상태 메모리 | 200MB 이하 |
| 활성 상태 메모리 (Whisper 모델 제외) | 500MB 이하 |
| Whisper 모델 메모리 | small ~500MB / medium ~1.5GB (모델에 따라 추가) |
| 마이크 리스닝 메모리 | 50MB 이하 |

### 에러 처리 원칙

- **관심사 API 실패**: 해당 항목 음성 안내 후 건너뛰고 다음 관심사 계속 진행
- **AI 모델 실패**: 3회 재시도(1/2/4초) → 2순위 모델 → Llama(로컬) → 텍스트 출력
- **STT 인식 실패**: Whisper 세그먼트별 `avg_logprob`의 평균값이 -0.5 이하(≈신뢰도 70% 미만)이거나 `no_speech_prob > 0.6`인 경우 재요청, 3회 연속 실패 시 텍스트 입력 안내
- **TTS 실패**: 사투리 TTS 실패 시 표준어 TTS fallback, TTS 전체 실패 시 터미널 텍스트 출력
- **네트워크 끊김**: 마지막 성공 리포트 캐시를 "이전 데이터 기준" 안내, 복구 시 자동 재시도

### 보안 원칙

- API 키는 macOS Keychain에 저장 (macOS `security` CLI를 통해 접근. config.yaml에 평문 저장 금지, 환경변수 참조만 허용)
- 음성 원본 데이터는 처리 후 즉시 메모리에서 삭제, 디스크 미저장
- 대기 상태에서 박수/wake word 감지 외 음성 내용 미분석
- 위험 어플리케이션 제어 명령(파일 삭제, 시스템 설정 변경)은 사용자 음성 확인 후 실행
