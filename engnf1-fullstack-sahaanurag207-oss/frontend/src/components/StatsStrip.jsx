import React from 'react';

export default function StatsStrip({ stats }) {
  if (!stats) return null;
  const totalTickets = Object.values(stats.byStatus || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Queue</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{totalTickets}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Open / Urgent</p>
        <p className="mt-1 text-2xl font-bold text-rose-600">
          {stats.byStatus?.OPEN || 0} <span className="text-sm font-normal text-slate-400">/ {stats.byPriority?.URGENT || 0}</span>
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Reviewed</p>
        <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.reviewedCount}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Model Agreement</p>
        <p className="mt-1 text-2xl font-bold text-indigo-600">{stats.modelAgreementRate}%</p>
      </div>
    </div>
  );
}
