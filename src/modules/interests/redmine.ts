import axios from 'axios';
import type { WorkTool } from '../../types/config.js';

export interface RedmineIssue {
  id: number;
  subject: string;
  status: { name: string };
  priority: { name: string };
  project: { name: string };
}

export async function fetchRedmineIssues(workTool: WorkTool): Promise<RedmineIssue[]> {
  const res = await axios.get<{ issues: RedmineIssue[] }>(`${workTool.base_url}/issues.json`, {
    params: {
      assigned_to_id: 'me',
      status_id: 'open',
      limit: 25,
    },
    headers: {
      'X-Redmine-API-Key': workTool.api_key,
    },
    timeout: 10000,
  });

  return res.data.issues;
}
