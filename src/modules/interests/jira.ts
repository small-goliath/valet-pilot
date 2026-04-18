import axios from 'axios';
import type { WorkTool } from '../../types/config.js';

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    priority?: { name: string };
    project: { name: string };
  };
}

const JQL = 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';

export async function fetchJiraIssues(workTool: WorkTool): Promise<JiraIssue[]> {
  const headers = buildAuthHeaders(workTool);

  const res = await axios.get<{ issues: JiraIssue[] }>(
    `${workTool.base_url}/rest/api/2/search`,
    {
      params: { jql: JQL, maxResults: 25, fields: 'summary,status,priority,project' },
      headers,
      timeout: 10000,
    }
  );

  return res.data.issues;
}

function buildAuthHeaders(workTool: WorkTool): Record<string, string> {
  if (workTool.auth_type === 'cloud' && workTool.email && workTool.api_key) {
    const token = Buffer.from(`${workTool.email}:${workTool.api_key}`).toString('base64');
    return { Authorization: `Basic ${token}` };
  }
  // server_pat
  return { Authorization: `Bearer ${workTool.api_key}` };
}
