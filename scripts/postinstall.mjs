#!/usr/bin/env node
import { execSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const ok = (msg) => console.log(`${GREEN}✔${RESET} ${msg}`);
const warn = (msg) => console.log(`${YELLOW}⚠${RESET}  ${msg}`);
const fail = (msg) => console.log(`${RED}✖${RESET} ${msg}`);
const info = (msg) => console.log(`  ${msg}`);

function which(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function tryInstallBrew(pkg) {
  if (!which('brew')) return false;
  try {
    console.log(`  brew install ${pkg} 실행 중...`);
    execSync(`brew install ${pkg}`, { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

function tryInstallPip(pkg) {
  // pipx 우선 시도 (macOS externally-managed-environment 대응)
  if (which('pipx')) {
    try {
      console.log(`  pipx install ${pkg} 실행 중...`);
      execSync(`pipx install ${pkg}`, { stdio: 'inherit' });
      return true;
    } catch { /* fall through */ }
  }
  // --user 플래그로 pip 시도
  const pip = which('pip3') ? 'pip3' : which('pip') ? 'pip' : null;
  if (!pip) return false;
  try {
    console.log(`  ${pip} install --user ${pkg} 실행 중...`);
    execSync(`${pip} install --user ${pkg}`, { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

function checkPythonPackage(importName) {
  try {
    const py = which('python3') ? 'python3' : 'python';
    execFileSync(py, ['-c', `import ${importName}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

console.log(`\n${BOLD}Valet Pilot — 시스템 의존성 확인${RESET}\n`);

let hasWarning = false;

// ─── sox ────────────────────────────────────────────────────────────────────
if (which('sox')) {
  ok('sox (박수 감지 / 마이크 입력)');
} else {
  fail('sox가 설치되어 있지 않습니다.');
  if (tryInstallBrew('sox')) {
    ok('sox 설치 완료');
  } else {
    warn('sox를 수동으로 설치하세요: brew install sox');
    hasWarning = true;
  }
}

// ─── ffmpeg ─────────────────────────────────────────────────────────────────
if (which('ffmpeg')) {
  ok('ffmpeg (BGM fade-out)');
} else {
  fail('ffmpeg가 설치되어 있지 않습니다.');
  if (tryInstallBrew('ffmpeg')) {
    ok('ffmpeg 설치 완료');
  } else {
    warn('ffmpeg를 수동으로 설치하세요: brew install ffmpeg');
    info('ffmpeg 없이도 실행 가능하나 BGM fade-out이 비활성화됩니다.');
    hasWarning = true;
  }
}

// ─── Python ─────────────────────────────────────────────────────────────────
const hasPython = which('python3') || which('python');
if (hasPython) {
  ok('Python (Whisper STT / Edge TTS)');
} else {
  fail('Python이 설치되어 있지 않습니다.');
  warn('Python 3.9+ 설치 후 다시 시도하세요: https://www.python.org');
  hasWarning = true;
}

// ─── whisper ────────────────────────────────────────────────────────────────
if (which('whisper') || checkPythonPackage('whisper')) {
  ok('openai-whisper (로컬 STT)');
} else {
  fail('openai-whisper가 설치되어 있지 않습니다.');
  if (hasPython && tryInstallPip('openai-whisper')) {
    ok('openai-whisper 설치 완료');
  } else {
    warn('수동으로 설치하세요: pip3 install openai-whisper');
    info('whisper 없이는 Google Cloud STT(온라인)로 fallback됩니다.');
    hasWarning = true;
  }
}

// ─── edge-tts ───────────────────────────────────────────────────────────────
if (which('edge-tts') || checkPythonPackage('edge_tts')) {
  ok('edge-tts (음성 합성)');
} else {
  fail('edge-tts가 설치되어 있지 않습니다.');
  if (hasPython && tryInstallPip('edge-tts')) {
    ok('edge-tts 설치 완료');
  } else {
    warn('수동으로 설치하세요: pip3 install edge-tts');
    info('edge-tts 없이는 ElevenLabs(유료) 또는 텍스트 출력으로 fallback됩니다.');
    hasWarning = true;
  }
}

// ─── afplay (macOS 내장) ─────────────────────────────────────────────────────
if (existsSync('/usr/bin/afplay')) {
  ok('afplay (BGM 재생, macOS 내장)');
} else {
  warn('afplay를 찾을 수 없습니다. macOS에서만 지원됩니다.');
  hasWarning = true;
}

// ─── 요약 ────────────────────────────────────────────────────────────────────
console.log('');
if (hasWarning) {
  console.log(`${YELLOW}⚠  일부 의존성이 누락되어 있습니다. 기능이 제한될 수 있습니다.${RESET}`);
  console.log(`   설치 후 'valet-pilot init'으로 초기 설정을 시작하세요.\n`);
} else {
  console.log(`${GREEN}${BOLD}✔  모든 의존성이 준비되었습니다!${RESET}`);
  console.log(`   'valet-pilot init'으로 초기 설정을 시작하세요.\n`);
}
