export const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://dev.connect.clona.trade/api/v1';

export type EmailStatus = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
export type EmailTemplate =
  | 'welcome' | 'login' | 'onboarding_fund' | 'onboarding_copy'
  | 'copy_follow' | 'copy_unfollow' | 'kol_approved' | 'kol_rejected' | 'custom';

export interface TemplateSummary {
  _id: EmailTemplate;
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
  openRate: number;
  clickRate: number;
}

export interface EmailLog {
  _id: string;
  recipient: string;
  subject: string;
  template: EmailTemplate;
  status: EmailStatus;
  metadata: Record<string, unknown>;
  trackingId: string;
  openedAt?: string;
  clickedLinks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsResponse {
  success: boolean;
  data: {
    summary: TemplateSummary[];
    logs: EmailLog[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
}

export interface SendResult {
  success: boolean;
  sent: number;
  failed: number;
  total: number;
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  const json = await res.json();
  return json as T;
}

export interface AnalyticsParams {
  template?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AdminInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export async function adminLogin(email: string, password: string): Promise<{ token: string; admin: AdminInfo }> {
  const res = await fetch(`${BASE}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  const json = await res.json();
  const inner = json.data;
  return { token: inner.token, admin: inner.admin };
}

export async function fetchAnalytics(token: string, params: AnalyticsParams = {}): Promise<AnalyticsResponse['data']> {
  const qs = new URLSearchParams();
  if (params.template) qs.set('template', params.template);
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs}` : '';
  const res = await request<AnalyticsResponse>(`/mail/analytics${query}`, token);
  return res.data;
}

export async function sendWelcomeEmails(
  token: string,
  payload: { emails?: string[]; useWaitlist?: boolean },
): Promise<SendResult> {
  const res = await request<{ success: boolean; data: SendResult }>('/mail/send/welcome', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function sendCustomEmail(
  token: string,
  payload: { emails: string[]; subject: string; body: string },
): Promise<SendResult> {
  const res = await request<{ success: boolean; data: SendResult }>('/mail/send/custom', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}
