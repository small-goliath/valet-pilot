import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';
import type { ValetConfig } from '../../types/config.js';

const CONFIG_DIR = path.join(os.homedir(), '.valet-pilot');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const WorkToolSchema = z.object({
  type: z.enum(['redmine', 'jira']),
  base_url: z.string().url(),
  auth_type: z.enum(['api_key', 'cloud', 'server_pat']),
  api_key: z.string().optional(),
  email: z.string().nullable().optional(),
});

const InterestSchema = z.object({
  id: z.enum(['weather', 'stock', 'custom']),
  name: z.string(),
  auth: z.record(z.string(), z.string()),
  custom_config: z.record(z.string(), z.unknown()).nullable().optional(),
});

const AppConfigSchema = z.object({
  name: z.string(),
  bundle_id: z.string(),
  launch_args: z.array(z.string()),
});

const ValetConfigSchema = z.object({
  agent_nickname: z.string().min(1),
  ai_model: z.enum(['anthropic', 'openai', 'moonshot']),
  ai_api_key: z.string().min(1),
  language: z.enum(['korean', 'japanese', 'english']),
  dialect: z
    .enum(['standard', 'gyeong-sang', 'jeolla', 'chung-cheong', 'jeju', 'gang-won'])
    .optional(),
  work_tool: WorkToolSchema,
  interests: z.array(InterestSchema),
  registered_apps: z.array(AppConfigSchema),
  stt_mode: z.enum(['online', 'offline']).optional(),
});

export function configExists(): boolean {
  return fs.existsSync(CONFIG_PATH);
}

export function loadConfig(): ValetConfig {
  if (!configExists()) {
    throw new Error(`설정 파일이 없습니다. 먼저 'valet-pilot setup'을 실행하세요.`);
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return ValetConfigSchema.parse(parsed) as ValetConfig;
}

export function saveConfig(config: ValetConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
