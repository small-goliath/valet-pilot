import { execSync } from 'child_process';
import type { ValetConfig } from '../../types/config.js';

export async function runPreflight(config: ValetConfig): Promise<void> {
  console.log('🔍 사전 요구사항 검증 중...\n');

  checkMicrophonePermission();
  checkAccessibilityPermission();

  if (config.stt_mode === 'offline') {
    checkSox();
  }

  console.log('✅ 모든 검증을 통과했습니다.\n');
}

function checkMicrophonePermission(): void {
  try {
    // macOS에서 마이크 권한 확인 (tccutil로 직접 확인은 root 필요, 실행 시점에서 확인)
    // 권한이 없으면 실제 마이크 접근 시 오류가 발생하므로 안내만 출력
    console.log('  🎙️  마이크 권한: 실행 중 자동 확인됩니다.');
    console.log(
      '     미허용 시: 시스템 설정 > 개인정보 보호 및 보안 > 마이크에서 터미널 앱을 허용해주세요.\n'
    );
  } catch {
    // 권한 확인 실패 시 안내만
  }
}

function checkAccessibilityPermission(): void {
  try {
    // osascript로 접근성 권한 상태 확인
    execSync(
      `osascript -e 'tell application "System Events" to get name of every process' 2>/dev/null`,
      { stdio: 'pipe' }
    );
    console.log('  ♿  접근성 권한: ✅ 허용됨\n');
  } catch {
    console.warn('  ♿  접근성 권한: ⚠️  미허용 상태일 수 있습니다.');
    console.warn(
      '     앱 제어(JXA)를 위해 접근성 권한이 필요합니다.'
    );
    console.warn(
      '     시스템 설정을 열어 터미널 앱에 접근성 권한을 부여해주세요.\n'
    );

    // 접근성 설정 화면 자동 오픈
    try {
      execSync(
        `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"`,
        { stdio: 'ignore' }
      );
    } catch {
      // 무시
    }
  }
}

function checkSox(): void {
  try {
    execSync('which sox', { stdio: 'pipe' });
    console.log('  🔊  SoX: ✅ 설치됨');
  } catch {
    console.error('  🔊  SoX: ❌ 미설치');
    console.error('     오프라인 STT 모드에 SoX가 필요합니다.');
    console.error('     다음 명령으로 설치해주세요: brew install sox\n');
    process.exit(1);
  }

  // whisper-cpp 바이너리 확인
  const binaryCandidates = [
    '/opt/homebrew/bin/whisper-cli',
    '/opt/homebrew/bin/whisper',
    '/usr/local/bin/whisper-cli',
    '/usr/local/bin/whisper',
  ];
  const found = binaryCandidates.some((p) => {
    try { execSync(`test -f ${p}`, { stdio: 'pipe' }); return true; } catch { return false; }
  });

  if (found) {
    console.log('  🤫  whisper-cpp: ✅ 설치됨\n');
  } else {
    console.error('  🤫  whisper-cpp: ❌ 미설치');
    console.error('     오프라인 STT 모드에 whisper-cpp가 필요합니다.');
    console.error('     다음 명령으로 설치해주세요: brew install whisper-cpp\n');
    process.exit(1);
  }
}
