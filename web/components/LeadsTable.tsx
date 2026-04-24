"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lead } from "@/lib/lead-mapper";
import { AddLeadDialog } from "./AddLeadDialog";
import { LeadDetailDrawer } from "./LeadDetailDrawer";
import { StatusBadge } from "./StatusBadge";

const POLL_INTERVAL_MS = 10_000;

interface ApiResponse {
  leads: Lead[];
  fetchedAt: string;
  error?: string;
}

function formatRelative(iso: string, now: number): string {
  if (!iso) {
    return "—";
  }
  const t = Date.parse(iso);
  if (Number.isNaN(t)) {
    return iso;
  }
  const seconds = Math.max(0, Math.round((now - t) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const clamped = Math.max(0, Math.min(100, score));
  const tone =
    clamped >= 75
      ? "bg-emerald-500"
      : clamped >= 50
        ? "bg-amber-500"
        : clamped > 0
          ? "bg-orange-500"
          : "bg-slate-300";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full ${tone}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-medium text-slate-700 dark:text-slate-300">{clamped}</span>
    </div>
  );
}

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      const response = await fetch("/api/leads", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
      }
      setLeads(payload.leads);
      setFetchedAt(payload.fetchedAt);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      const ta = Date.parse(a.lastProcessedAt) || 0;
      const tb = Date.parse(b.lastProcessedAt) || 0;
      if (tb !== ta) return tb - ta;
      return b.rowNumber - a.rowNumber;
    });
  }, [leads]);

  const selectedLead = useMemo(
    () => sortedLeads.find((lead) => lead.rowNumber === selectedRow) ?? null,
    [sortedLeads, selectedRow]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {loading ? (
            "Loading…"
          ) : fetchedAt ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" /> Updated{" "}
              {formatRelative(fetchedAt, now)} · {leads.length} {leads.length === 1 ? "lead" : "leads"}
            </>
          ) : (
            "No data yet"
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            Add lead
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Last processed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedLeads.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  No leads yet. Add one to kick off enrichment.
                </td>
              </tr>
            )}
            {sortedLeads.map((lead) => (
              <tr
                key={lead.rowNumber}
                onClick={() => setSelectedRow(lead.rowNumber)}
                className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{lead.name || "—"}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{lead.email || "no email"}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800 dark:text-slate-200">{lead.company || "—"}</div>
                  {lead.companyDomain && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">{lead.companyDomain}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                  {[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-3">
                  <ScoreBar score={lead.leadScore} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {formatRelative(lead.lastProcessedAt, now)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LeadDetailDrawer lead={selectedLead} onClose={() => setSelectedRow(null)} />
      <AddLeadDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => void refresh()} />
    </div>
  );
}
