import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';
import { Calendar, Users, CheckCircle2 } from 'lucide-react';

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedResource, setSelectedResource] = useState(null);
  const [dateStr, setDateStr] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [availability, setAvailability] = useState([]);
  const [startHourMin, setStartHourMin] = useState('10:00');
  const [durationMins, setDurationMins] = useState(60);
  const [purpose, setPurpose] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [bookingMsg, setBookingMsg] = useState(null);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('search', search);
      if (type) params.set('type', type);
      if (minCapacity) params.set('minCapacity', minCapacity);
      const res = await apiRequest(`/resources?${params.toString()}`);
      setResources(res.data);
      setTotalPages(Math.max(1, res.totalPages));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, type, minCapacity]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const loadAvailability = useCallback(async (resourceId, chosenDate) => {
    try {
      const from = `${chosenDate}T00:00:00.000Z`;
      const to = `${chosenDate}T23:59:59.000Z`;
      const res = await apiRequest(`/resources/${resourceId}/availability?from=${from}&to=${to}`);
      setAvailability(res.bookings);
    } catch {
      setAvailability([]);
    }
  }, []);

  const selectResource = (r) => {
    setSelectedResource(r);
    setBookingMsg(null);
    loadAvailability(r.id, dateStr);
  };

  useEffect(() => {
    if (selectedResource) {
      loadAvailability(selectedResource.id, dateStr);
    }
  }, [selectedResource, dateStr, loadAvailability]);

  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      timeOptions.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }

  const handleBook = async (e) => {
    e.preventDefault();
    setBookingMsg(null);
    try {
      const startIso = new Date(`${dateStr}T${startHourMin}:00.000Z`).toISOString();
      const endIso = new Date(new Date(startIso).getTime() + Number(durationMins) * 60000).toISOString();

      await apiRequest('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          resourceId: selectedResource.id,
          startTime: startIso,
          endTime: endIso,
          purpose,
          ticketId: ticketId.trim() || undefined
        })
      });
      setBookingMsg({ type: 'success', text: 'Slot booked successfully (Status: PENDING).' });
      setPurpose('');
      loadAvailability(selectedResource.id, dateStr);
    } catch (err) {
      setBookingMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Internal Resources & Slot Scheduling</h1>
        <p className="text-sm text-slate-500">Book 30-minute UTC-aligned slots for rooms, diagnostic labs, and equipment</p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <input
          type="text"
          placeholder="Search resource name or description..."
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => { setPage(1); setType(e.target.value); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          <option value="ROOM">ROOM</option>
          <option value="LAB">LAB</option>
          <option value="EQUIPMENT">EQUIPMENT</option>
        </select>
        <input
          type="number"
          min="1"
          placeholder="Minimum capacity..."
          value={minCapacity}
          onChange={(e) => { setPage(1); setMinCapacity(e.target.value); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-6">
          {loading ? (
            <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">Loading resources...</div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
          ) : resources.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">No resources found.</div>
          ) : (
            resources.map((r) => (
              <div
                key={r.id}
                onClick={() => selectResource(r)}
                className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition ${
                  selectedResource?.id === r.id ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">{r.name}</h3>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                    {r.type}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{r.description || 'No description provided.'}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Capacity: {r.capacity}
                  </span>
                  {!r.isActive && <span className="font-bold text-rose-600">INACTIVE</span>}
                </div>
              </div>
            ))
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {!selectedResource ? (
              <div className="py-12 text-center text-sm text-slate-400">
                Select a resource to check UTC slot availability and schedule a booking.
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedResource.name}</h2>
                  <p className="text-xs text-slate-500">All slots aligned to 30-minute UTC intervals</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">Inspect Date (UTC)</label>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-600">Blocked Windows on {dateStr}</p>
                  {availability.length === 0 ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Entire day open (no PENDING or APPROVED bookings)
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs">
                      {availability.map((b, i) => (
                        <li key={i} className="flex justify-between rounded bg-white px-2.5 py-1.5 shadow-sm">
                          <span>
                            {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                            {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Local)
                          </span>
                          <span className="font-semibold text-amber-700">{b.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {bookingMsg && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      bookingMsg.type === 'error'
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {bookingMsg.text}
                  </div>
                )}

                <form onSubmit={handleBook} className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600">Start Time (UTC)</label>
                      <select
                        value={startHourMin}
                        onChange={(e) => setStartHourMin(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {timeOptions.map((t) => <option key={t} value={t}>{t} UTC</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600">Duration</label>
                      <select
                        value={durationMins}
                        onChange={(e) => setDurationMins(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {[30, 60, 90, 120, 150, 180, 210, 240].map((d) => (
                          <option key={d} value={d}>{d} mins</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600">Purpose (5–200 chars)</label>
                    <input
                      type="text"
                      required
                      minLength={5}
                      maxLength={200}
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="Live customer reproduction & packet trace"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600">Linked Ticket UUID (Optional)</label>
                    <input
                      type="text"
                      value={ticketId}
                      onChange={(e) => setTicketId(e.target.value)}
                      placeholder="e.g., 550e8400-e29b-41d4-a716-446655440000"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Request Slot Booking</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
