export type AiModel = 'anthropic' | 'openai' | 'moonshot';
export type Language = 'korean' | 'japanese' | 'english';
export type Dialect =
  | 'standard'
  | 'gyeong-sang'
  | 'jeolla'
  | 'chung-cheong'
  | 'jeju'
  | 'gang-won';
export type WorkToolType = 'redmine' | 'jira';
export type AuthType = 'api_key' | 'cloud' | 'server_pat';
export type InterestId = 'weather' | 'stock' | 'custom';

export interface WorkTool {
  type: WorkToolType;
  base_url: string;
  auth_type: AuthType;
  api_key?: string;
  email?: string | null;
}

export interface Interest {
  id: InterestId;
  name: string;
  auth: Record<string, string>;
  custom_config?: Record<string, unknown> | null;
}

export interface AppConfig {
  name: string;
  bundle_id: string;
  launch_args: string[];
}

export interface ValetConfig {
  agent_nickname: string;
  ai_model: AiModel;
  ai_api_key: string;
  language: Language;
  dialect?: Dialect;
  work_tool: WorkTool;
  interests: Interest[];
  registered_apps: AppConfig[];
  stt_mode?: 'online' | 'offline';
}
