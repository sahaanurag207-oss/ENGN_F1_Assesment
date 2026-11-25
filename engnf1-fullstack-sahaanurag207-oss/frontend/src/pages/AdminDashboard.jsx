import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';

export default function AdminDashboard() {
  const [adminStats, setAdminStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [resources, setResources] = useState([]);
  const [newRes, setNewRes] = useState({ name: '', type: 'ROOM', capacity: 4, description: '' });
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [statsRes, bRes, rRes] = await Promise.all([
        apiRequest('/admin/stats'),
        apiRequest('/bookings?page=1'),
        apiRequest('/resources?page=1')
      ]);
      setAdminStats(statsRes);
      setBookings(bRes.data);
      setResources(rRes.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateResource = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/resources', {
        method: 'POST',
        body: JSON.stringify({ ...newRes, capacity: Number(newRes.capacity) })
      });
      setNewRes({ name: '', type: 'ROOM', capacity: 4, description: '' });
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleResource = async (r) => {
    try {
      await apiRequest(`/resources/${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !r.isActive })
      });
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApprove = async (id) => {
    try {
      await apiRequest(`/bookings/${id}/approve`, { method: 'PATCH' });
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReject = async (id) => {
    const note = window.prompt('Enter rejection reason (5–200 chars):');
    if (!note) return;
    try {
      await apiRequest(`/bookings/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ note })
      });
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  if (error) return <div className="p-6 text-rose-600">{error}</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin Operations & Analytics</h1>

      {adminStats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Active Resources</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{adminStats.activeResources}</p>
          </div>
          {Object.entries(adminStats.bookingsByStatus).map(([k, v]) => (
            <div key={k} className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">{k}</p>
              <p className="mt-1 text-2xl font-bold text-indigo-600">{v}</p>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Booking Approvals</h2>
        <div className="mt-4 space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{b.purpose}</p>
                <p className="text-xs text-slate-500">
                  {new Date(b.startTime).toLocaleString()} – {new Date(b.endTime).toLocaleString()} | Status: <strong>{b.status}</strong>
                </p>
              </div>
              {b.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(b.id)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(b.id)}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Manage Resources</h2>
        <form onSubmit={handleCreateResource} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <input
            type="text"
            required
            placeholder="Resource name"
            value={newRes.name}
            onChange={(e) => setNewRes({ ...newRes, name: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={newRes.type}
            onChange={(e) => setNewRes({ ...newRes, type: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ROOM">ROOM</option>
            <option value="LAB">LAB</option>
            <option value="EQUIPMENT">EQUIPMENT</option>
          </select>
          <input
            type="number"
            min="1"
            max="500"
            required
            value={newRes.capacity}
            onChange={(e) => setNewRes({ ...newRes, capacity: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Description"
            value={newRes.description}
            onChange={(e) => setNewRes({ ...newRes, description: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Add Resource
          </button>
        </form>

        <div className="mt-5 divide-y divide-slate-100">
          {resources.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {r.name} <span className="text-xs font-normal text-slate-500">({r.type}, cap {r.capacity})</span>
                </p>
              </div>
              <button
                onClick={() => toggleResource(r)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                  r.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {r.isActive ? 'Active (Click to Deactivate)' : 'Inactive (Click to Activate)'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
