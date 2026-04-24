"use client";

import { useEffect, useRef } from "react";
import type { Lead } from "@/lib/lead-mapper";
import { StatusBadge } from "./StatusBadge";

interface Props {
  lead: Lead | null;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) {
    return null;
  }
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

export function LeadDetailDrawer({ lead, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!lead) {
      return;
    }
    closeRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lead, onClose]);

  if (!lead) {
    return null;
  }

  const insights = lead.salesInsights
    .split(/\s+•\s+/)
    .map((insight) => insight.trim())
    .filter(Boolean);

  const location = [lead.city, lead.state, lead.country].filter(Boolean).join(", ");

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
      <div
        className="flex-1 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{lead.name || "Unnamed lead"}</h2>
              <StatusBadge status={lead.status} />
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {lead.company || "Unknown company"}
              {location ? ` · ${location}` : ""}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close detail panel"
          >
            ×
          </button>
        </header>

        <div className="space-y-6 p-6">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" value={lead.email} />
            <Field
              label="Lead score"
              value={lead.leadScore !== null ? String(lead.leadScore) : ""}
            />
            <Field label="Company website" value={lead.companyWebsite} />
            <Field label="Company domain" value={lead.companyDomain} />
            <Field label="Property address" value={lead.propertyAddress} />
            <Field label="Last processed" value={lead.lastProcessedAt} />
          </section>

          <Field label="Address validation" value={lead.addressValidation} />
          <Field label="Enriched company info" value={lead.enrichedCompanyInfo} />
          <Field label="Lead score reason" value={lead.leadScoreReason} />

          {insights.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Sales insights
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-900 dark:text-slate-100">
                {insights.map((insight, i) => (
                  <li key={i}>{insight}</li>
                ))}
              </ul>
            </div>
          )}

          {lead.draftOutreachEmail && (
            <div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Draft outreach email
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(lead.draftOutreachEmail)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  Copy
                </button>
              </div>
              <textarea
                readOnly
                value={lead.draftOutreachEmail}
                className="mt-2 h-48 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
