"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lead } from "@/lib/lead-mapper";
import { needsReview, reviewSignals } from "@/lib/review-filters";
import { AddLeadDialog } from "./AddLeadDialog";
import { LeadDetailDrawer } from "./LeadDetailDrawer";
import { StatusBadge } from "./StatusBadge";

const POLL_INTERVAL_MS = 10_000;

type ViewMode = "all" | "review";

type SortKey = "recent" | "score_desc" | "score_asc";

const STATUS_OPTIONS = ["all", "NEW", "PENDING", "ENRICHED", "NEEDS_REVIEW", "ERROR"] as const;
const TIER_OPTIONS = ["all", "HOT", "WARM", "REVIEW", "COLD"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];
type TierFilter = (typeof TIER_OPTIONS)[number];

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
  const [view, setView] = useState<ViewMode>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [search, setSearch] = useState("");
  const [missingIdentityOnly, setMissingIdentityOnly] = useState(false);
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

  const reviewQueue = useMemo(() => sortedLeads.filter(needsReview), [sortedLeads]);

  const filtersActive =
    statusFilter !== "all" ||
    tierFilter !== "all" ||
    sortKey !== "recent" ||
    search.trim().length > 0 ||
    missingIdentityOnly;

  const visibleLeads = useMemo(() => {
    const base = view === "review" ? reviewQueue : sortedLeads;
    const query = search.trim().toLowerCase();

    let filtered = base.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) {
        return false;
      }
      if (tierFilter !== "all" && lead.leadTier.toUpperCase() !== tierFilter) {
        return false;
      }
      if (missingIdentityOnly) {
        if (!lead.company) return false;
        if (lead.companyDomain || lead.companyWebsite) return false;
      }
      if (query) {
        const haystack = [lead.company, lead.companyDomain, lead.city, lead.state, lead.name, lead.email]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });

    if (sortKey === "score_desc" || sortKey === "score_asc") {
      const direction = sortKey === "score_desc" ? -1 : 1;
      filtered = [...filtered].sort((a, b) => {
        const sa = a.leadScore;
        const sb = b.leadScore;
        // null scores always sort to the bottom regardless of direction.
        if (sa === null && sb === null) return 0;
        if (sa === null) return 1;
        if (sb === null) return -1;
        return (sa - sb) * direction;
      });
    }

    return filtered;
  }, [view, sortedLeads, reviewQueue, statusFilter, tierFilter, missingIdentityOnly, search, sortKey]);

  const selectedLead = useMemo(
    () => sortedLeads.find((lead) => lead.rowNumber === selectedRow) ?? null,
    [sortedLeads, selectedRow]
  );

  function clearFilters() {
    setStatusFilter("all");
    setTierFilter("all");
    setSortKey("recent");
    setSearch("");
    setMissingIdentityOnly(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {loading ? (
            "Loading…"
          ) : fetchedAt ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" /> Updated{" "}
              {formatRelative(fetchedAt, now)} ·{" "}
              {filtersActive
                ? `${visibleLeads.length} of ${leads.length} ${leads.length === 1 ? "lead" : "leads"}`
                : `${leads.length} ${leads.length === 1 ? "lead" : "leads"}`}
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

      <div className="flex gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 text-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setView("all")}
          className={`flex-1 rounded px-3 py-1.5 font-medium transition ${
            view === "all"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          All leads · {sortedLeads.length}
        </button>
        <button
          type="button"
          onClick={() => setView("review")}
          className={`flex-1 rounded px-3 py-1.5 font-medium transition ${
            view === "review"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Review queue · {reviewQueue.length}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Company, city, state, name…"
            className="w-56 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All statuses" : option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Tier</span>
          <select
            value={tierFilter}
            onChange={(event) => setTierFilter(event.target.value as TierFilter)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {TIER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All tiers" : option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Sort by</span>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="recent">Most recent</option>
            <option value="score_desc">Score · high → low</option>
            <option value="score_asc">Score · low → high</option>
          </select>
        </label>

        <label className="flex items-center gap-2 pb-1.5 text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={missingIdentityOnly}
            onChange={(event) => setMissingIdentityOnly(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>Only missing company domain/website</span>
        </label>

        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto pb-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Clear filters
          </button>
        )}
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
            {visibleLeads.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  {filtersActive
                    ? "No leads match the current filters."
                    : view === "review"
                      ? "Nothing in the review queue. Everything is either auto-enriched or already actioned."
                      : "No leads yet. Add one to kick off enrichment."}
                </td>
              </tr>
            )}
            {visibleLeads.map((lead) => (
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
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge status={lead.status} />
                    {lead.reviewDecision === "FIT" && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                        ✓ Fit
                      </span>
                    )}
                    {lead.reviewDecision === "NOT_FIT" && (
                      <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-900 dark:bg-rose-900/40 dark:text-rose-200">
                        ✗ Not fit
                      </span>
                    )}
                    {lead.outreachApproved === "YES" && (
                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200">
                        ✓ Outreach
                      </span>
                    )}
                  </div>
                  {view === "review" && (
                    <div className="mt-1 space-y-0.5">
                      {reviewSignals(lead).map((signal) => (
                        <div
                          key={signal.reason}
                          className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300"
                        >
                          {signal.label}
                        </div>
                      ))}
                    </div>
                  )}
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

      <LeadDetailDrawer
        lead={selectedLead}
        onClose={() => setSelectedRow(null)}
        onActionComplete={() => void refresh()}
      />
      <AddLeadDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => void refresh()} />
    </div>
  );
}
