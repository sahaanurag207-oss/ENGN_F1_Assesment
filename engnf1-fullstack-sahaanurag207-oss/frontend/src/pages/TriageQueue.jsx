import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';
import StatsStrip from '../components/StatsStrip';
import { RefreshCw, Search, ShieldCheck, Clock } from 'lucide-react';

const CATEGORIES = ['BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const SAMPLE_FEED = [
  { externalId: 'EXT-1003', subject: 'Locked out of SSO after 2FA reset', body: 'Agent cannot sign in because password and 2FA token loop endlessly.' },
  { externalId: 'EXT-1004', subject: 'My package has not arrived yet', body: 'Tracking shows stalled shipping for 6 days on hardware token delivery.' },
  { externalId: 'EXT-2001', subject: 'Urgent production down on payment webhook', body: 'Incoming invoice webhook returns 500 error across EU cluster.' }
];

export default function TriageQueue() {
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', q: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchQueueAndStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (filters.status) params.set('status', filters.status);
      if (filters.category) params.set('category', filters.category);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.q) params.set('q', filters.q);

      const [ticketRes, statsRes] = await Promise.all([
        apiRequest(`/tickets?${params.toString()}`),
        apiRequest('/stats')
      ]);
      setTickets(ticketRes.data);
      setTotalPages(Math.max(1, ticketRes.totalPages));
      setStats(statsRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchQueueAndStats();
  }, [fetchQueueAndStats]);

  const openTicket = async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await apiRequest(`/tickets/${id}`);
      setDetail(res);
    } catch (err) {
      setToast({ type: 'error', msg: err.message });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOptimisticPatch = async (ticketId, patch) => {
    const prevTickets = [...tickets];
    const prevDetail = detail ? { ...detail, ticket: { ...detail.ticket } } : null;

    const optimisticPatch = {
      ...patch,
      ...(patch.category ? { isHumanOverride: true, isReviewed: true } : {}),
      ...(patch.status && patch.status !== 'OPEN' ? { isReviewed: true } : {})
    };

    setTickets((curr) =>
      curr.map((t) => (t.id === ticketId ? { ...t, ...optimisticPatch } : t))
    );
    if (detail?.ticket?.id === ticketId) {
      setDetail((curr) => ({ ...curr, ticket: { ...curr.ticket, ...optimisticPatch } }));
    }

    try {
      const updated = await apiRequest(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      setTickets((curr) => curr.map((t) => (t.id === ticketId ? updated.ticket : t)));
      if (detail?.ticket?.id === ticketId) {
        setDetail(updated);
      }
      const freshStats = await apiRequest('/stats');
      setStats(freshStats);
    } catch (err) {
      setTickets(prevTickets);
      if (prevDetail) setDetail(prevDetail);
      setToast({ type: 'error', msg: `Update rolled back: ${err.message}` });
    }
  };

  const handleReimportFeed = async () => {
    try {
      const summary = await apiRequest('/tickets/import', {
        method: 'POST',
        body: JSON.stringify({ tickets: SAMPLE_FEED })
      });
      setToast({
        type: 'success',
        msg: `Feed processed: ${summary.importedCount} new, ${summary.updatedCount} updated, ${summary.skippedOverrideCount} human overrides preserved.`
      });
      fetchQueueAndStats();
      if (selectedId) openTicket(selectedId);
    } catch (err) {
      setToast({ type: 'error', msg: err.message });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support Triage Queue</h1>
          <p className="text-sm text-slate-500">Auto-triaged incoming feed with human-override protection & audit trail</p>
        </div>
        <button
          onClick={handleReimportFeed}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Re-Import Feed</span>
        </button>
      </div>

      {toast && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
            toast.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-4 text-xs font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      <StatsStrip stats={stats} />

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search subject or body..."
            value={filters.q}
            onChange={(e) => { setPage(1); setFilters({ ...filters, q: e.target.value }); }}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filters.category}
          onChange={(e) => { setPage(1); setFilters({ ...filters, category: e.target.value }); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filters.priority}
          onChange={(e) => { setPage(1); setFilters({ ...filters, priority: e.target.value }); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Loading tickets...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
          ) : tickets.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No tickets match the active filters.
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => openTicket(t.id)}
                className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition hover:border-indigo-300 ${
                  selectedId === t.id ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-400">{t.externalId}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {t.isHumanOverride && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        <ShieldCheck className="h-3 w-3" /> Override
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                      {t.category}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                      {t.priority}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {t.status}
                    </span>
                  </div>
                </div>
                <h3 className="mt-2 font-semibold text-slate-900">{t.subject}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{t.body}</p>
              </div>
            ))
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="sticky top-20 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {!selectedId ? (
              <div className="py-12 text-center text-sm text-slate-400">
                Select a ticket from the queue to inspect details, override classification, and view audit events.
              </div>
            ) : detailLoading || !detail ? (
              <div className="py-12 text-center text-sm text-slate-500">Loading ticket details...</div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono">{detail.ticket.externalId}</span>
                    <span>Auto-predicted: <strong>{detail.ticket.autoCategory}</strong></span>
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{detail.ticket.subject}</h2>
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {detail.ticket.body}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500">Category</label>
                    <select
                      value={detail.ticket.category}
                      onChange={(e) => handleOptimisticPatch(detail.ticket.id, { category: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium"
                    >
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500">Priority</label>
                    <select
                      value={detail.ticket.priority}
                      onChange={(e) => handleOptimisticPatch(detail.ticket.id, { priority: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium"
                    >
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500">Status</label>
                    <select
                      value={detail.ticket.status}
                      onChange={(e) => handleOptimisticPatch(detail.ticket.id, { status: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Audit Trail ({detail.events.length})</span>
                  </h3>
                  {detail.events.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-400">No human modifications recorded yet.</p>
                  ) : (
                    <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
                      {detail.events.map((ev) => (
                        <li key={ev.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700">{ev.actor}</span>
                            <span>{new Date(ev.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="mt-1 text-slate-700">
                            Changed <span className="font-mono font-semibold">{ev.field}</span> from{' '}
                            <span className="rounded bg-slate-200 px-1">{ev.oldValue ?? 'null'}</span> to{' '}
                            <span className="rounded bg-indigo-100 px-1 text-indigo-800">{ev.newValue ?? 'null'}</span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
