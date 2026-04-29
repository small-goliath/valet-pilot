// 타입 선언: node-record-lpcm16 (공식 @types 패키지 없음)
declare module 'node-record-lpcm16' {
  import type { Readable } from 'node:stream';
  import type { ChildProcess } from 'node:child_process';

  interface RecordingOptions {
    sampleRate?: number;
    channels?: number;
    compress?: boolean;
    threshold?: number;
    thresholdStart?: number | null;
    thresholdEnd?: number | null;
    /** 침묵 종료 시간(초). 문자열로 전달 (예: "1.5") */
    silence?: string;
    recorder?: 'sox' | 'rec' | 'arecord';
    endOnSilence?: boolean;
    audioType?: string;
  }

  class Recording {
    options: Required<RecordingOptions>;
    process: ChildProcess;
    _stream: Readable;

    stop(): void;
    pause(): void;
    resume(): void;
    isPaused(): boolean;
    stream(): Readable;
  }

  function record(options?: RecordingOptions): Recording;

  export { record };
  export type { RecordingOptions, Recording };
}
