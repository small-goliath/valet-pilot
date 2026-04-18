import type { AIAdapter } from '../../adapters/ai.js';
import type { ValetConfig } from '../../types/config.js';
import { speak } from '../tts/index.js';
import { listenOnce } from '../voice/index.js';
import { executeTool, TOOLS_DESCRIPTION, type ToolCall } from './tools.js';

const MAX_TOOL_LOOPS = 6; // 무한 루프 방지

type AgentResponse =
  | { type: 'tool_call'; tool: ToolCall['tool']; params: Record<string, unknown>; reasoning?: string }
  | { type: 'speak'; message: string }
  | { type: 'clarify'; question: string };

const AGENT_SYSTEM_PROMPT = (config: ValetConfig) => `
당신은 ${config.agent_nickname}입니다. macOS에서 사용자의 업무를 음성으로 처리하는 AI 비서입니다.
응답 언어: ${config.language}.

${TOOLS_DESCRIPTION}

중요 규칙:
- 반드시 아래 JSON 형식 중 하나로만 응답하세요. 다른 텍스트는 포함하지 마세요.
- 도구가 필요하면: { "type": "tool_call", "tool": "도구이름", "params": {...}, "reasoning": "이유" }
- 결과를 말할 때: { "type": "speak", "message": "사용자에게 할 말" }
- 지시가 불명확하면: { "type": "clarify", "question": "명확화 질문" }
- 도구 실행 후 최종 결과를 반드시 speak로 보고하세요.
`.trim();

/**
 * 사용자 음성 명령을 처리하는 에이전트 루프
 */
export async function runAgentLoop(
  command: string,
  config: ValetConfig,
  ai: AIAdapter
): Promise<void> {
  const history: { role: 'user' | 'assistant'; content: string }[] = [];

  history.push({ role: 'user', content: command });

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const contextPrompt = history.map((m) => `[${m.role}]: ${m.content}`).join('\n');

    let rawResponse: string;
    try {
      rawResponse = await ai.chat(contextPrompt, AGENT_SYSTEM_PROMPT(config));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await speak(`AI 응답 오류가 발생했습니다: ${errMsg}`, config);
      return;
    }

    const parsed = parseAgentResponse(rawResponse);
    if (!parsed) {
      // JSON 파싱 실패 시 그대로 발화
      await speak(rawResponse.slice(0, 300), config);
      return;
    }

    if (parsed.type === 'speak') {
      console.log(`  🤖 ${parsed.message}`);
      await speak(parsed.message, config);
      return;
    }

    if (parsed.type === 'clarify') {
      console.log(`  ❓ ${parsed.question}`);
      await speak(parsed.question, config);

      // 사용자 추가 음성 입력 대기
      try {
        const followUp = await listenOnce(config);
        if (followUp.type === 'command') {
          history.push({ role: 'assistant', content: rawResponse });
          history.push({ role: 'user', content: followUp.text });
          continue;
        }
      } catch {
        await speak('다시 말씀해주세요.', config);
      }
      return;
    }

    if (parsed.type === 'tool_call') {
      const toolCall = { tool: parsed.tool, params: parsed.params } as ToolCall;
      console.log(`  🔧 도구 실행: ${toolCall.tool} ${JSON.stringify(toolCall.params)}`);

      if (parsed.reasoning) {
        await speak(parsed.reasoning, config);
      }

      const result = await executeTool(toolCall);
      console.log(`  ${result.success ? '✅' : '❌'} 결과: ${result.output.slice(0, 100)}`);

      history.push({ role: 'assistant', content: rawResponse });
      history.push({
        role: 'user',
        content: `도구 실행 결과 (${result.success ? '성공' : '실패'}): ${result.output}`,
      });
      continue;
    }
  }

  await speak('처리 중 오류가 발생했습니다. 다시 시도해주세요.', config);
}

function parseAgentResponse(raw: string): AgentResponse | null {
  // JSON 블록 추출 (```json ... ``` 형태도 처리)
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) ?? raw.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch?.[1] ?? raw.trim();

  try {
    const obj = JSON.parse(jsonStr) as Record<string, unknown>;
    if (typeof obj.type !== 'string') return null;

    if (obj.type === 'tool_call') {
      return {
        type: 'tool_call',
        tool: obj.tool as ToolCall['tool'],
        params: (obj.params as Record<string, unknown>) ?? {},
        reasoning: obj.reasoning as string | undefined,
      };
    }

    if (obj.type === 'speak') {
      return { type: 'speak', message: String(obj.message ?? '') };
    }

    if (obj.type === 'clarify') {
      return { type: 'clarify', question: String(obj.question ?? '') };
    }

    return null;
  } catch {
    return null;
  }
}
