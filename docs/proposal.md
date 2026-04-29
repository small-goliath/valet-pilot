# 프로젝트 기획서

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | Valet Pilot |
| 버전 | v0.1 |
| 작성일 | 2026-04-18 |
| 작성자 | small-goliat |
| 상태 | 초안 |

### 1.1 한 줄 요약

> 사용자의 업무를 자연어로 도와주는 ai Agent application.

### 1.2 배경 및 문제 정의

- 현재 상황: 매일 출근하면 오늘 자신이 어떤 일을 해야하는지, 날씨는 어떠한지 등 많은 요소들을 찾아보는 것으로 하루를 시작합니다.
- 문제점: 매일 출근하면 업무 상황, 날씨, 그 외 사용자가 관심있는 모든 분야에 대해서 서치하는 번거로움이 존재합니다. 또한 업무를 진행하면서 매번 키보드와 마우스를 통해 ai에게 지시를 내리는 번거로움으 존재합니다.
- 기회: 모든 번거로움을 자동화 또는 마이크를 통한 speech를 이용한 지시를 통해 업무를 볼 수 있다.

---

## 2. 목표

### 2.1 핵심 목표 (Goal)

1. 사용자가 출근 후 1분 이내에 오늘의 업무/날씨 현황을 음성으로 브리핑 받을 수 있다.
2. 음성 명령만으로 주요 업무 도구(브라우저 등)를 제어할 수 있다.
3. 반복적인 정보 수집 작업을 완전 자동화하여 하루 30분 이상의 시간을 절약한다.

### 2.2 성공 지표 (KPI / OKR)

| 지표 | 목표값 | 측정 방법 |
|------|--------|-----------|
| ai agent 닉네임 커스텀 지원 | 사용자 커스텀 | 사용자로부터 닉네임 선택 |
| ai model 다수 지원 | kimi-k2.5(default), anthropic, openai, google, llama | 사용자로부터 모델 선택 |
| 언어 지원 | korean, japanese, english | 사용자로부터 언어 선택 |
| 사투리 지원 | korean인 경우, 경상도, 전라도, 제주도, 강원도 등 모든 지역의 사투리 지원 | 사용자로부터 사투리 선택 |
| 목소리 지원 | 여러가지의 ai 목소리 지원 | 사용자로부터 목소리 선택 |
| 여러가지 관심사 지원 | 업무지원(redmine(default) 또는 JIRA(택1), google drive(default) 또는 Confluence 또는 Notion(택1), git, 그 외 사용자 지정), 날씨, 그외 사용자 지정 | 사용자로부터 관심사 선택 |
| 업무 지원 | 설치되어있는 각종 어플리케이션(intelliJ, vscode, chrome 등) | 사용자 지시로부터 ai의 어플리케이션 선택 |
| OS 지원 | macOS | mac 환경에서 어플리케이션 실행 |

---

## 3. 기능

### 3.1 CLI를 통한 설치

사용자는 cli를 통해서 설치할 수 있다.

- 설치 방법: `npm install -g valet-pilot`
- 최소 요구 환경: macOS 26.3 (Tahoe) 이상, Node.js 24 LTS 이상
- 의존성: ffmpeg (오디오 처리), portaudio (마이크 입력)
- 설치 후 초기 설정: `valet-pilot init` 명령어로 대화형 설정 진행

### 3.2 설정

ai model, 언어, 사투리, 관심사, 업무 등을 설정할 수 있다.

- 저장 위치: `~/.valet-pilot/config.yaml`
- 설정 변경 방법:
  - CLI: `valet-pilot config set language korean`
- 대화형: `valet-pilot config` 실행 시 inquirer 기반 메뉴 표시
- 직접 편집: config.yaml 파일을 텍스트 에디터로 수정
- 설정 파일 예시:

```yaml
agent:
    nickname: "자비스"
    model: kimi-k2.5
    language: korean
    dialect: 경상도
    voice: male-01
interests:
    - type: redmine
      url: https://projects.rsupport.com
      api_key: ${REDMINE_API_KEY}
    - type: weather
      location: 서울
```

### 3.3 브리핑 (출근 리포트)

사용자가 speech를 통해 업무 시작을 알리면 설정된 관심사 리포트해준다.

1. 사용자가 박수를 두 번치는 것으로 시작을 알림
2. 관심사 리포트: 설정된 redmine 또는 JIRA을 통해 나에게 할당된 일감(티켓)을 리스트업 하고 오늘 해야할 일을 설정된 언어와 사투리로 말해준다.
3. bgm/opening.mp3 음악도 함께 재생된다.
4. 51.6초 까지 사용자에게 환영 인사를 하고 51.7초부터 53초 까지는 강렬하고 힘찬 짧은 말로 시작을 알린다. 53.2초부터 관심사들을 리포트해준다.
5. 사용자가 시작을 알렸을 때 즉각적으로 설정된 언어, 사투리를 사용해서 리포트가 나와야하므로 미리 리포트 내용이 준비되어 있어야한다.
6. bgm/opening.mp3가 재생되는 동안에는 그 어떠한 외부 통신이 발생하지 않는다.

- Redmine의 경우 아래와 같이 나에게 할당된 일감을 조회할 수 있다.

``` bash
curl -H "X-Redmine-API-Key: <your_api_key>" \
  "https://projects.rsupport.com/issues.json?status_id=open&assigned_to_id=me&sort=status%3Aasc%2Cpriority%3Adesc%2Cupdated_on%3Adesc&limit=100"
```

- 박수 감지:
    - 볼륨 임계값: -30dB 이상의 순간 피크
    - 두 번 간격: 800ms 이내
    - 오탐 방지: 박수 패턴의 주파수 대역(2kHz~4kHz) 필터링, 연속 잡음과 구분
- 대체 트리거:
    - 키보드 단축키: `Ctrl+Shift+V` (configurable)
    - 음성 명령: "좋은 아침" 또는 사용자 지정 wake word
    - CLI 명령: `valet-pilot briefing`
- 트리거 동작 모드:
    - 박수 감지와 wake word 감지는 동시에 활성화되며, 어느 쪽이든 먼저 감지되면 브리핑 시작
    - config.yaml에서 개별 on/off 가능
    ```yaml
    trigger:
      clap:
        enabled: true
        threshold_db: -30
        interval_ms: 800
      wake_word:
        enabled: true
        words: ["좋은 아침", "시작"]  # 사용자 지정 가능
      keyboard:
        enabled: true
        shortcut: "Ctrl+Shift+V"
    ```
    - 브리핑 중 추가 트리거 입력은 무시 (중복 실행 방지)
- 타이밍 근거: opening.mp3의 구간별 분위기에 맞춘 설계
    - 0초~51.6초: 잔잔한 인트로 → 환영 인사 구간
    - 51.7초~53초: 드롭/클라이맥스 → 힘찬 시작 선언
    - 53.2초~: 리듬 루프 → 리포트 배경음
- BGM 최대 재생 시간: 59초 (리포트 완료 시 fade-out, 최대 시간 초과 시 강제 종료)
- BGM 파일 변경 시: config.yaml에서 타이밍 구간을 재설정할 수 있도록 지원

```yaml
bgm:
  file: bgm/opening.mp3
  greeting_end: 51.6
  shout_start: 51.7
  shout_end: 53.0
  report_start: 53.2
  max_duration: 59
```

### 3.4 AI 대화

사용자와의 모든 소통은 ai와 한다.

1. 사용자의 질문 또는 지시는 항상 ai가 받는다.
2. 사용자는 언제든지 질문 또는 지시를 할 수 있고, 말할 수 있는 시간 제한이 없다.

- 히스토리 보존: 최근 50턴까지 로컬 파일(`~/.valet-pilot/history/`)에 저장
- 컨텍스트 유지: 현재 세션 내에서는 전체 대화 컨텍스트 유지, 세션 종료(퇴근) 시 요약본만 보존
- 세션 구분: 박수 트리거부터 "퇴근" 명령까지를 하나의 세션으로 간주
- 세션 종료 방법:
    - 음성 명령: "퇴근", "끝", "종료", "수고했어" 등 종료 의도 표현을 인식
    - CLI 명령: `valet-pilot stop`
    - 키보드 단축키: `Ctrl+Shift+Q` (configurable)
    - 자동 종료: 사용자 무응답 상태가 일정 시간(기본 2시간) 지속 시 세션 자동 종료
    - 종료 시 동작:
      1. 오늘 세션 요약본 생성 후 `~/.valet-pilot/history/` 에 저장
      2. 마이크 리스닝은 유지 (다음 트리거 대기 상태로 전환)
      3. 종료 인사: "수고하셨습니다, OO님. 좋은 하루 되세요." (config에서 비활성화 가능)
    ```yaml
    session:
      end_keywords: ["퇴근", "끝", "종료", "수고했어"]
      auto_end_minutes: 120
      farewell_enabled: true
    ```
- 민감 정보 처리: API 키, 비밀번호 등은 히스토리에서 마스킹 처리

### 3.5 어플리케이션 제어

  - 제어 범위:
    - Level 1 (실행/종료): `open -a "IntelliJ IDEA"`, `osascript -e 'quit app "Chrome"'`
    - Level 2 (포커스 전환): 특정 앱을 최전면으로 전환
    - Level 3 (내부 조작): AppleScript/JXA를 통해 Chrome 탭 열기, VSCode 파일 열기 등
  - 기술 제약:
    - macOS 접근성 권한(Accessibility API) 필수 — 설치 시 권한 요청 가이드 제공
    - 샌드박스 앱은 AppleScript 지원이 제한될 수 있음
    - 지원 앱 목록을 config에서 관리하고 미지원 앱은 Level 1만 허용
  - 보안:
    - 위험 명령(파일 삭제, 시스템 설정 변경 등)은 사용자 확인 후 실행
    - 허용/차단 명령어 화이트리스트 설정 가능

### 3.6 사용자 지정 관심사

  - 정의 방법: config.yaml의 interests 배열에 추가
    ```yaml
    interests:
      - type: custom
        name: "환율"
        source:
          type: rest_api
          url: "https://api.exchangerate.host/latest?base=USD&symbols=KRW"
          method: GET
          extract: "$.rates.KRW"
        report_template: "현재 달러 환율은 {value}원입니다."
        schedule: daily
    ```
  - 지원 데이터 소스 유형:
    - REST API: URL + 인증 + JSON 경로 지정
    - RSS/Atom: 피드 URL 지정
    - 웹 스크래핑: URL + CSS 셀렉터 지정
    - 로컬 파일: 특정 파일 내용 읽기
  - 리포트 템플릿: 데이터를 자연어로 변환하는 프롬프트 또는 템플릿 문자열 지정

---

## 4. 기술 요구사항

### 4.1 STT (음성 인식)

- 엔진: OpenAI Whisper (large-v3)
- 동작 방식: 로컬 실행 (오프라인), GPU 없이도 CPU에서 동작 가능
- 대안: Google Cloud Speech-to-Text (온라인, 네트워크 필요)
- 언어 지원: 한국어, 일본어, 영어 동시 인식 (auto-detect 또는 설정 언어 우선)
- 지연 시간 목표: 발화 종료 후 1초 이내 텍스트 변환 완료
- wake word 감지: Porcupine 또는 자체 키워드 감지 모델 사용

### 4.2 TTS (음성 합성)

  - 엔진: 
    - 기본: Edge TTS (무료, 다양한 한국어 음성)
    - 고품질: ElevenLabs API (자연스러운 음성, 유료)
    - 사투리: Moonshot TTS 또는 커스텀 fine-tuned 모델
  - 목소리 종류: 최소 4종 (남성 2, 여성 2)
  - 사투리 대응 방안:
    - 방법 A: LLM에게 사투리 변환 프롬프트 적용 후 표준어 TTS로 읽기
    - 방법 B: 사투리 학습된 커스텀 TTS 모델 사용 (경상도/전라도 우선 지원)
    - Phase 1에서는 방법 A로 시작, 품질 확인 후 방법 B로 전환
  - 캐싱: 자주 사용되는 인사말/정형 문장은 미리 합성하여 캐시

### 4.3 AI 모델 연동

  - 모델별 연동:
    | 모델 | API 엔드포인트 | 인증 방식 | 비고 |
    |------|---------------|-----------|------|
    | Kimi K2.5 | https://api.moonshot.ai/v1 | Bearer Token | 기본 모델 |
    | Claude (Anthropic) | https://api.anthropic.com/v1 | x-api-key | |
    | GPT (OpenAI) | https://api.openai.com/v1 | Bearer Token | |
    | Gemini (Google) | https://generativelanguage.googleapis.com/v1 | API Key | |
    | Llama | 로컬 Ollama (http://localhost:11434) | 없음 | 로컬 실행 |
  - fallback 전략:
    1. 기본 모델 API 호출 실패 시 3회 재시도 (1초, 2초, 4초 간격)
    2. 재시도 실패 시 사용자가 설정한 2순위 모델로 전환
    3. 2순위도 실패 시 로컬 Llama로 fallback
    4. 모든 모델 실패 시 "현재 AI 서비스에 연결할 수 없습니다" 음성 안내
  - 공통 인터페이스: 모든 모델을 동일한 추상화 레이어로 감싸 호출

---

## 5. 비기능 요구사항

### 5.1 성능

  - 응답 지연:
    - STT 변환: 발화 종료 후 1초 이내
    - AI 응답 생성: 첫 토큰 스트리밍 시작까지 2초 이내
    - TTS 재생: 텍스트 수신 후 500ms 이내 음성 출력 시작
    - 브리핑 시작: 박수 감지 후 300ms 이내 BGM 재생 시작
  - 리소스 사용:
    - 대기 상태 메모리: 200MB 이하
    - 활성 상태 메모리: 500MB 이하
    - CPU: 대기 시 5% 이하, 활성 시 30% 이하
    - 백그라운드 마이크 리스닝: 상시 실행, 50MB 이하

### 5.2 보안

  - API 키 저장:
    - macOS Keychain에 저장 (평문 파일 저장 금지)
    - 환경 변수 참조 지원: `${REDMINE_API_KEY}` 형태로 config에 기재
  - 인증 흐름:
    - Redmine/JIRA: API 키 기반 인증 (초기 설정 시 1회 입력)
    - Google Drive: OAuth 2.0 플로우 (브라우저 리다이렉트)
    - Notion: Integration Token 기반
  - 마이크 데이터:
    - 음성 데이터는 로컬에서만 처리 (STT가 로컬 Whisper인 경우)
    - 온라인 STT 사용 시 전송 구간 TLS 암호화
    - 음성 원본은 처리 후 즉시 메모리에서 삭제, 디스크에 저장하지 않음
    - 대기 상태에서는 wake word/박수 감지만 수행하며 음성 내용을 분석하지 않음

### 5.3 에러 처리

  - API 실패:
    - Redmine/JIRA 조회 실패: "일감 정보를 가져오지 못했습니다. 나중에 다시 확인해드리겠습니다." 음성 안내 후 나머지 관심사 리포트 계속 진행
    - 날씨 API 실패: 해당 항목 건너뛰고 다음 관심사로 이동
  - 네트워크 끊김:
    - 마지막으로 성공한 리포트 캐시를 "이전 데이터 기준으로" 안내
    - 네트워크 복구 시 자동 재시도
  - STT 인식 실패:
    - 인식 신뢰도 70% 미만: "다시 한번 말씀해주시겠습니까?" 재요청
    - 3회 연속 실패: "음성 인식이 어렵습니다. 텍스트로 입력해주세요." 안내
  - TTS 실패:
    - 사투리 TTS 실패 시 표준어 TTS로 fallback
    - TTS 자체 실패 시 터미널에 텍스트 출력

### 5.4 업데이트

  - 버전 관리: SemVer (Major.Minor.Patch)
  - 업데이트 방식:
    - npm: `npm update -g valet-pilot`
  - 자동 업데이트: 기동 시 최신 버전 확인, 업데이트 가능 시 알림만 표시 (자동 설치는 하지 않음)
  - 설정 파일 마이그레이션: 메이저 버전 업데이트 시 자동 마이그레이션 스크립트 제공

---

## 6. 우선순위 및 로드맵

  | Phase | 기간 | 목표 | 주요 기능 |
  |-------|------|------|-----------|
  | Phase 1 (MVP) | 4주 | 핵심 브리핑 동작 | 박수 트리거, Redmine 연동, 기본 TTS, BGM 재생, 단일 AI 모델 |
  | Phase 2 | 4주 | 대화 기능 확장 | 음성 대화(STT+TTS), 다중 AI 모델 지원, 날씨 관심사 |
  | Phase 3 | 4주 | 앱 제어 + 커스텀 | 어플리케이션 제어, 사용자 지정 관심사, 사투리 TTS |
  | Phase 4 | 2주 | 안정화 | 에러 처리 강화, 성능 최적화, 배포 패키징 |

---

## 7. 사용자 시나리오 (예시)

  **시나리오 1: 출근 브리핑**
  ```
  1. 사용자가 맥북을 열고 valet-pilot이 백그라운드에서 실행 중
  2. 사용자가 박수를 두 번 침
  3. [300ms] BGM(opening.mp3) 재생 시작
  4. [0초~51.6초] "좋은 아침입니다, OO님! 오늘도 화이팅입니다."
  5. [51.7초~53초] "자, 시작합니다!"
  6. [53.2초~] "오늘 할당된 일감은 총 5건입니다. 
     긴급: #1234 로그인 버그 수정, 
     높음: #1235 대시보드 API 개발..."
  7. 리포트 완료 → BGM fade-out(BGM 재생 중인 경우) → 대기 상태로 전환
  ```

  **시나리오 2: 업무 중 음성 명령**
  ```
  1. 사용자: "자비스, 크롬에서 Redmine 열어줘"
  2. AI: Chrome 활성화 → Redmine URL 새 탭으로 열기
  3. AI: "Redmine 열었습니다."
  ```

  **시나리오 3: 자유 질문**
  ```
  1. 사용자: "오늘 서울 날씨 어때?"
  2. AI: 날씨 API 조회 → "오늘 서울은 맑고 최고 24도, 최저 15도입니다. 미세먼지는 좋음입니다."
  ```
