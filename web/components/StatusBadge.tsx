import type { LeadStatus } from "@shared/types";

const STATUS_STYLES: Record<LeadStatus | "", string> = {
  NEW: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 animate-pulse",
  ENRICHED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  NEEDS_REVIEW: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
  ERROR: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
  "": "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
};

const STATUS_LABEL: Record<LeadStatus | "", string> = {
  NEW: "New",
  PENDING: "Pending",
  ENRICHED: "Enriched",
  NEEDS_REVIEW: "Needs review",
  ERROR: "Error",
  "": "Unprocessed"
};

export function StatusBadge({ status }: { status: LeadStatus | "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
