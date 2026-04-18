import { runSetupWizard } from '../modules/setup/index.js';

export async function setupCommand(): Promise<void> {
  try {
    await runSetupWizard();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ERR_USE_AFTER_CLOSE') {
      // 사용자가 Ctrl+C로 종료한 경우
      console.log('\n\n설정이 취소되었습니다.');
      process.exit(0);
    }
    throw err;
  }
}
