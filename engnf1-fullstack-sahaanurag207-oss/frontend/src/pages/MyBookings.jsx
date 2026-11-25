import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMine = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set('status', status);
      const res = await apiRequest(`/bookings/mine?${params.toString()}`);
      setBookings(res.data);
      setTotalPages(Math.max(1, res.totalPages));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await apiRequest(`/bookings/${id}/cancel`, { method: 'PATCH' });
      loadMine();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">My Resource Bookings</h1>
        <select
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Loading your bookings...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      ) : bookings.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">No bookings found.</div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="font-semibold text-slate-900">{b.purpose}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(b.startTime).toLocaleString()} → {new Date(b.endTime).toLocaleString()}
                </p>
                {b.decisionNote && (
                  <p className="mt-1 text-xs text-rose-600">Admin Note: {b.decisionNote}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{b.status}</span>
                {['PENDING', 'APPROVED'].includes(b.status) && new Date(b.startTime) > new Date() && (
                  <button
                    onClick={() => handleCancel(b.id)}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border bg-white px-3 py-1 text-xs disabled:opacity-40">
          Previous
        </button>
        <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border bg-white px-3 py-1 text-xs disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  );
}
