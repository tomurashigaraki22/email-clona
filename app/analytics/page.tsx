'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import {
  adminLogin,
  fetchAnalytics,
  sendWelcomeEmails,
  sendCustomEmail,
  type TemplateSummary,
  type EmailLog,
  type AnalyticsParams,
} from '../lib/api';

const TEMPLATES = [
  'welcome', 'login', 'onboarding_fund', 'onboarding_copy',
  'copy_follow', 'copy_unfollow', 'kol_approved', 'kol_rejected', 'custom',
];

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-zinc-100 text-zinc-600',
  delivered: 'bg-blue-100 text-blue-700',
  opened: 'bg-green-100 text-green-700',
  clicked: 'bg-emerald-100 text-emerald-800',
  bounced: 'bg-orange-100 text-orange-700',
  failed: 'bg-red-100 text-red-700',
};

function fmt(n: number) {
  return n.toLocaleString();
}
function pct(n: number) {
  return n.toFixed(1) + '%';
}
function fmtDate(s: string) {
  return new Date(s).toLocaleString();
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginGate({ onToken }: { onToken: (t: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setErr('');
    start(async () => {
      try {
        const res = await adminLogin(email.trim(), password);
        const token = res.data.token;
        localStorage.setItem('admin_token', token);
        onToken(token);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Login failed';
        setErr(msg.includes('401') ? 'Invalid email or password' : msg);
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-xl border border-zinc-200 p-8 shadow-sm"
      >
        <div className="text-center mb-6">
          <span className="text-2xl font-bold text-emerald-600">Clona</span>
          <p className="text-sm text-zinc-500 mt-1">Admin Dashboard</p>
        </div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@clona.trade"
          autoComplete="email"
          className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-3"
        />
        <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-4"
        />
        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium rounded-lg py-2 text-sm transition-colors"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: TemplateSummary[] }) {
  const totals = summary.reduce(
    (acc, r) => ({
      sent: acc.sent + r.sent,
      opened: acc.opened + r.opened,
      clicked: acc.clicked + r.clicked,
      failed: acc.failed + r.failed,
    }),
    { sent: 0, opened: 0, clicked: 0, failed: 0 },
  );
  const overallOpenRate = totals.sent ? ((totals.opened / totals.sent) * 100).toFixed(1) : '0.0';
  const overallClickRate = totals.sent ? ((totals.clicked / totals.sent) * 100).toFixed(1) : '0.0';

  const cards = [
    { label: 'Sent', value: fmt(totals.sent), sub: 'all time' },
    { label: 'Opened', value: fmt(totals.opened), sub: `${overallOpenRate}% open rate` },
    { label: 'Clicked', value: fmt(totals.clicked), sub: `${overallClickRate}% click rate` },
    { label: 'Failed', value: fmt(totals.failed), sub: totals.sent ? pct((totals.failed / totals.sent) * 100) + ' fail rate' : '—' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">{c.label}</p>
          <p className="text-2xl font-bold text-zinc-900">{c.value}</p>
          <p className="text-xs text-zinc-400 mt-1">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Per-template table ───────────────────────────────────────────────────────

function TemplateTable({ summary }: { summary: TemplateSummary[] }) {
  if (!summary.length) return null;
  return (
    <div className="bg-white rounded-xl border border-zinc-200 mb-8 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-800">By Template</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 bg-zinc-50 border-b border-zinc-100">
              <th className="text-left px-5 py-3 font-medium">Template</th>
              <th className="text-right px-5 py-3 font-medium">Sent</th>
              <th className="text-right px-5 py-3 font-medium">Opened</th>
              <th className="text-right px-5 py-3 font-medium">Open Rate</th>
              <th className="text-right px-5 py-3 font-medium">Clicked</th>
              <th className="text-right px-5 py-3 font-medium">Click Rate</th>
              <th className="text-right px-5 py-3 font-medium">Failed</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((r) => (
              <tr key={r._id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50">
                <td className="px-5 py-3 font-medium text-zinc-800">{r._id}</td>
                <td className="px-5 py-3 text-right text-zinc-600">{fmt(r.sent)}</td>
                <td className="px-5 py-3 text-right text-zinc-600">{fmt(r.opened)}</td>
                <td className="px-5 py-3 text-right text-emerald-700 font-medium">{pct(r.openRate)}</td>
                <td className="px-5 py-3 text-right text-zinc-600">{fmt(r.clicked)}</td>
                <td className="px-5 py-3 text-right text-emerald-700 font-medium">{pct(r.clickRate)}</td>
                <td className="px-5 py-3 text-right text-red-500">{fmt(r.failed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────

interface Filters {
  template: string;
  startDate: string;
  endDate: string;
}

function FilterBar({
  filters,
  onChange,
  onApply,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onApply: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 mb-4 items-end">
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Template</label>
        <select
          value={filters.template}
          onChange={(e) => onChange({ ...filters, template: e.target.value })}
          className="border border-zinc-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All templates</option>
          {TEMPLATES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">From</label>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
          className="border border-zinc-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">To</label>
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
          className="border border-zinc-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <button
        onClick={onApply}
        className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
      >
        Apply
      </button>
      <button
        onClick={() => {
          onChange({ template: '', startDate: '', endDate: '' });
          setTimeout(onApply, 0);
        }}
        className="text-sm text-zinc-500 hover:text-zinc-800 px-2 py-2"
      >
        Clear
      </button>
    </div>
  );
}

// ─── Logs table ───────────────────────────────────────────────────────────────

function LogsTable({
  logs,
  pagination,
  onPage,
}: {
  logs: EmailLog[];
  pagination: { page: number; totalPages: number; total: number; limit: number };
  onPage: (p: number) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-800">
          Email Logs
          <span className="ml-2 text-xs font-normal text-zinc-400">
            {pagination.total.toLocaleString()} total
          </span>
        </h2>
        <span className="text-xs text-zinc-400">
          Page {pagination.page} of {pagination.totalPages}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 bg-zinc-50 border-b border-zinc-100">
              <th className="text-left px-5 py-3 font-medium">Recipient</th>
              <th className="text-left px-5 py-3 font-medium">Subject</th>
              <th className="text-left px-5 py-3 font-medium">Template</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Sent</th>
              <th className="text-left px-5 py-3 font-medium">Opened</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-zinc-400 text-sm">
                  No logs found.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log._id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50">
                <td className="px-5 py-3 text-zinc-700 max-w-[180px] truncate">{log.recipient}</td>
                <td className="px-5 py-3 text-zinc-600 max-w-[220px] truncate" title={log.subject}>{log.subject}</td>
                <td className="px-5 py-3 text-zinc-500">{log.template}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[log.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                    {log.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">
                  {log.openedAt ? fmtDate(log.openedAt) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination.totalPages > 1 && (
        <div className="px-5 py-4 border-t border-zinc-100 flex items-center justify-between">
          <button
            onClick={() => onPage(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="text-sm text-zinc-600 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 border border-zinc-200 rounded-lg transition-colors"
          >
            ← Previous
          </button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(7, pagination.totalPages) }, (_, i) => {
              let page: number;
              if (pagination.totalPages <= 7) {
                page = i + 1;
              } else if (pagination.page <= 4) {
                page = i + 1;
              } else if (pagination.page >= pagination.totalPages - 3) {
                page = pagination.totalPages - 6 + i;
              } else {
                page = pagination.page - 3 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => onPage(page)}
                  className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                    page === pagination.page
                      ? 'bg-emerald-600 text-white font-medium'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="text-sm text-zinc-600 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 border border-zinc-200 rounded-lg transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Send Welcome ─────────────────────────────────────────────────────────────

function SendWelcomeForm({ token }: { token: string }) {
  const [emails, setEmails] = useState('');
  const [useWaitlist, setUseWaitlist] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    start(async () => {
      try {
        const emailList = emails.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
        const res = await sendWelcomeEmails(token, {
          emails: emailList.length ? emailList : undefined,
          useWaitlist,
        });
        setResult(`Sent ${res.sent}, failed ${res.failed} of ${res.total}`);
        setEmails('');
      } catch (e: unknown) {
        setResult(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    });
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-zinc-200 p-6">
      <h3 className="text-sm font-semibold text-zinc-800 mb-4">Send Welcome Emails</h3>
      <label className="block text-xs font-medium text-zinc-500 mb-1">
        Recipients (comma or newline separated)
      </label>
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        placeholder="user@example.com, another@example.com"
        rows={3}
        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none mb-3"
      />
      <label className="flex items-center gap-2 text-sm text-zinc-700 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={useWaitlist}
          onChange={(e) => setUseWaitlist(e.target.checked)}
          className="rounded accent-emerald-600"
        />
        Send to all waitlist members
      </label>
      {result && (
        <p className={`text-sm mb-3 ${result.startsWith('Error') ? 'text-red-600' : 'text-emerald-700'}`}>
          {result}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
      >
        {pending ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}

// ─── Send Custom ──────────────────────────────────────────────────────────────

function SendCustomForm({ token }: { token: string }) {
  const [emails, setEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    start(async () => {
      try {
        const emailList = emails.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
        const res = await sendCustomEmail(token, { emails: emailList, subject, body });
        setResult(`Sent ${res.sent}, failed ${res.failed} of ${res.total}`);
        setEmails('');
        setSubject('');
        setBody('');
      } catch (e: unknown) {
        setResult(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    });
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-zinc-200 p-6">
      <h3 className="text-sm font-semibold text-zinc-800 mb-4">Send Custom Email</h3>
      <label className="block text-xs font-medium text-zinc-500 mb-1">Recipients</label>
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        placeholder="user@example.com, another@example.com"
        rows={2}
        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none mb-3"
      />
      <label className="block text-xs font-medium text-zinc-500 mb-1">Subject</label>
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Weekly Newsletter"
        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
      />
      <label className="block text-xs font-medium text-zinc-500 mb-1">HTML Body</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="<p>Hello! This is a custom email.</p>"
        rows={5}
        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500 resize-y mb-3"
      />
      {result && (
        <p className={`text-sm mb-3 ${result.startsWith('Error') ? 'text-red-600' : 'text-emerald-700'}`}>
          {result}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !emails.trim() || !subject.trim() || !body.trim()}
        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
      >
        {pending ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [filters, setFilters] = useState<Filters>({ template: '', startDate: '', endDate: '' });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({ template: '', startDate: '', endDate: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    summary: TemplateSummary[];
    logs: EmailLog[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'analytics' | 'send'>('analytics');

  const load = useCallback(
    async (p: number, f: Filters) => {
      setLoading(true);
      setError('');
      try {
        const params: AnalyticsParams = { page: p, limit: 20 };
        if (f.template) params.template = f.template;
        if (f.startDate) params.startDate = new Date(f.startDate).toISOString();
        if (f.endDate) params.endDate = new Date(f.endDate + 'T23:59:59').toISOString();
        const res = await fetchAnalytics(token, params);
        setData(res.data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load analytics');
        if (e instanceof Error && e.message.startsWith('401')) onLogout();
      } finally {
        setLoading(false);
      }
    },
    [token, onLogout],
  );

  useEffect(() => {
    load(page, appliedFilters);
  }, [load, page, appliedFilters]);

  function applyFilters() {
    setPage(1);
    setAppliedFilters({ ...filters });
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-emerald-600">Clona</span>
          <span className="text-zinc-300">|</span>
          <span className="text-sm font-medium text-zinc-600">Mail Analytics</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => load(page, appliedFilters)}
            className="text-sm text-zinc-500 hover:text-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            ↻ Refresh
          </button>
          <button
            onClick={onLogout}
            className="text-sm text-zinc-500 hover:text-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-zinc-100 p-1 rounded-xl w-fit">
          {(['analytics', 'send'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {tab === 'analytics' ? 'Analytics' : 'Send Emails'}
            </button>
          ))}
        </div>

        {activeTab === 'analytics' && (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
                {error}
              </div>
            )}

            {loading && !data && (
              <div className="flex items-center justify-center py-24 text-zinc-400 text-sm">
                Loading…
              </div>
            )}

            {data && (
              <>
                <SummaryCards summary={data.summary} />
                <TemplateTable summary={data.summary} />

                <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
                  <h2 className="text-sm font-semibold text-zinc-800 mb-4">Filters</h2>
                  <FilterBar
                    filters={filters}
                    onChange={setFilters}
                    onApply={applyFilters}
                  />
                </div>

                <div className="relative">
                  {loading && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 rounded-xl">
                      <span className="text-sm text-zinc-400">Loading…</span>
                    </div>
                  )}
                  <LogsTable
                    logs={data.logs}
                    pagination={data.pagination}
                    onPage={(p) => setPage(p)}
                  />
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'send' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <SendWelcomeForm token={token} />
            <SendCustomForm token={token} />
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('admin_token');
    if (stored) setToken(stored);
  }, []);

  function handleToken(t: string) {
    setToken(t);
  }

  function handleLogout() {
    localStorage.removeItem('admin_token');
    setToken(null);
  }

  if (!token) return <LoginGate onToken={handleToken} />;
  return <Dashboard token={token} onLogout={handleLogout} />;
}
