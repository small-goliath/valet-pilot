// ────────────────────────────────────────────────────────────────
//  Valet Pilot — 민감 정보 마스킹 유틸리티
// ────────────────────────────────────────────────────────────────

/** 마스킹 규칙 목록 */
const MASKING_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  // API 키: api_key: <value>, api-key=<value> 등
  {
    pattern: /api[_-]?key\s*[:=]\s*\S+/gi,
    replacement: 'API_KEY: ***',
  },
  // 비밀번호: password: <value>, password=<value> 등
  {
    pattern: /password\s*[:=]\s*\S+/gi,
    replacement: 'password: ***',
  },
  // 토큰: token: <value>, token=<value> 등
  {
    pattern: /token\s*[:=]\s*\S+/gi,
    replacement: 'token: ***',
  },
  // URL 쿼리 파라미터에 포함된 민감 키워드 값
  // 예: ?api_key=abc123, &password=secret, &token=xyz
  {
    pattern: /([?&])(api[_-]?key|password|token|secret|auth|access_token)=([^&\s"']+)/gi,
    replacement: '$1$2=***',
  },
  // Authorization 헤더 값
  {
    pattern: /authorization\s*[:=]\s*\S+/gi,
    replacement: 'authorization: ***',
  },
  // secret 필드
  {
    pattern: /secret\s*[:=]\s*\S+/gi,
    replacement: 'secret: ***',
  },
];

/**
 * 텍스트에서 민감 정보를 탐지하고 마스킹합니다.
 *
 * @param text 마스킹할 원본 텍스트
 * @returns 민감 정보가 *** 로 대체된 텍스트
 */
export function maskSensitiveInfo(text: string): string {
  let result = text;

  for (const rule of MASKING_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }

  return result;
}
