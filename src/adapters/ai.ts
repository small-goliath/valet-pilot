import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { ValetConfig } from '../types/config.js';

export interface AIAdapter {
  chat(userPrompt: string, systemPrompt?: string): Promise<string>;
}

class OpenAIAdapter implements AIAdapter {
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }

  async chat(userPrompt: string, systemPrompt?: string): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    const res = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
    });

    return res.choices[0]?.message?.content?.trim() ?? '';
  }
}

class AnthropicAdapter implements AIAdapter {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(userPrompt: string, systemPrompt?: string): Promise<string> {
    const res = await this.client.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 1024,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: userPrompt }],
    });

    const block = res.content[0];
    if (block.type !== 'text') return '';
    return block.text.trim();
  }
}

class MoonshotAdapter implements AIAdapter {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.moonshot.cn/v1',
    });
  }

  async chat(userPrompt: string, systemPrompt?: string): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    const res = await this.client.chat.completions.create({
      model: 'moonshot-v1-8k',
      messages,
    });

    return res.choices[0]?.message?.content?.trim() ?? '';
  }
}

export function createAIAdapter(config: ValetConfig): AIAdapter {
  switch (config.ai_model) {
    case 'openai':
      return new OpenAIAdapter(config.ai_api_key);
    case 'anthropic':
      return new AnthropicAdapter(config.ai_api_key);
    case 'moonshot':
      return new MoonshotAdapter(config.ai_api_key);
  }
}
