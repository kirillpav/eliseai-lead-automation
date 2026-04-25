"use client";

import { useEffect, useRef, useState } from "react";
import type { Lead } from "@/lib/lead-mapper";
import { reviewSignals } from "@/lib/review-filters";
import { EditLeadDialog } from "./EditLeadDialog";
import { StatusBadge } from "./StatusBadge";

interface Props {
  lead: Lead | null;
  onClose: () => void;
  onActionComplete?: () => void;
}

type ActionId = "mark_fit" | "mark_not_fit" | "approve_outreach" | "retry_enrichment";

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

export function LeadDetailDrawer({ lead, onClose, onActionComplete }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [pendingAction, setPendingAction] = useState<ActionId | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<ActionId | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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

  useEffect(() => {
    setPendingAction(null);
    setActionError(null);
    setJustCompleted(null);
    setEditOpen(false);
  }, [lead?.rowNumber]);

  useEffect(() => {
    if (!justCompleted) return;
    const id = setTimeout(() => setJustCompleted(null), 4000);
    return () => clearTimeout(id);
  }, [justCompleted]);

  if (!lead) {
    return null;
  }

  async function runAction(action: ActionId) {
    if (!lead) return;
    setPendingAction(action);
    setActionError(null);
    try {
      const response = await fetch(`/api/leads/${lead.rowNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; issues?: string[] };
        throw new Error(payload.issues?.join("; ") || payload.error || `Request failed (${response.status})`);
      }
      setJustCompleted(action);
      onActionComplete?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPendingAction(null);
    }
  }

  const insights = lead.salesInsights
    .split(/\s+•\s+/)
    .map((insight) => insight.trim())
    .filter(Boolean);

  const location = [lead.city, lead.state, lead.country].filter(Boolean).join(", ");
  const signals = reviewSignals(lead);

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
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{lead.name || "Unnamed lead"}</h2>
              <StatusBadge status={lead.status} />
              {lead.reviewDecision === "FIT" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                  ✓ Marked fit
                </span>
              )}
              {lead.reviewDecision === "NOT_FIT" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-900 dark:bg-rose-900/40 dark:text-rose-200">
                  ✗ Not a fit
                </span>
              )}
              {lead.outreachApproved === "YES" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200">
                  ✓ Outreach approved
                </span>
              )}
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

          {signals.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Why this is in the review queue
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-900 dark:text-amber-100">
                {signals.map((signal) => (
                  <li key={signal.reason}>{signal.label}</li>
                ))}
              </ul>
            </div>
          )}

          <Field label="Why prioritize" value={lead.whyPrioritize} />
          <Field label="What's missing" value={lead.whatsMissing} />
          <Field label="Address validation" value={lead.addressValidation} />
          <Field label="Enriched company info" value={lead.enrichedCompanyInfo} />
          <Field label="Lead score reason" value={lead.leadScoreReason} />

          {(lead.reviewDecision || lead.outreachApproved) && (
            <div
              className={`rounded-md border-2 p-4 text-sm ${
                lead.reviewDecision === "FIT"
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                  : lead.reviewDecision === "NOT_FIT"
                    ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"
                    : "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                Rep decisions on this lead
              </div>
              <div className="mt-2 space-y-1 text-slate-900 dark:text-slate-100">
                {lead.reviewDecision === "FIT" && (
                  <div className="flex items-center gap-2">
                    <span className="text-base">✓</span>
                    <span>
                      Marked as a <strong>fit</strong>
                    </span>
                  </div>
                )}
                {lead.reviewDecision === "NOT_FIT" && (
                  <div className="flex items-center gap-2">
                    <span className="text-base">✗</span>
                    <span>
                      Marked <strong>not a fit</strong>
                    </span>
                  </div>
                )}
                {lead.outreachApproved === "YES" && (
                  <div className="flex items-center gap-2">
                    <span className="text-base">✓</span>
                    <span>
                      Outreach email <strong>approved</strong> for send
                    </span>
                  </div>
                )}
                {lead.reviewedBy && (
                  <div className="pt-1 text-xs text-slate-600 dark:text-slate-400">
                    by {lead.reviewedBy}
                    {lead.reviewedAt ? ` · ${lead.reviewedAt}` : ""}
                  </div>
                )}
              </div>
            </div>
          )}

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

          {actionError && (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
              {actionError}
            </div>
          )}

          {justCompleted && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              ✓ Saved.{" "}
              {justCompleted === "mark_fit" && "Marked as a fit."}
              {justCompleted === "mark_not_fit" && "Marked not a fit."}
              {justCompleted === "approve_outreach" && "Outreach approved."}
              {justCompleted === "retry_enrichment" && "Re-queued for enrichment — the sweep will pick it up shortly."}
            </div>
          )}

          <div className="sticky bottom-0 -mx-6 mt-2 flex flex-wrap gap-2 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <button
              type="button"
              onClick={() => runAction("mark_fit")}
              disabled={pendingAction !== null}
              className={`rounded-md px-3 py-1.5 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                lead.reviewDecision === "FIT"
                  ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }`}
            >
              {pendingAction === "mark_fit" ? "Saving…" : lead.reviewDecision === "FIT" ? "✓ Marked fit" : "Mark fit"}
            </button>
            <button
              type="button"
              onClick={() => runAction("mark_not_fit")}
              disabled={pendingAction !== null}
              className={`rounded-md px-3 py-1.5 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                lead.reviewDecision === "NOT_FIT"
                  ? "border-2 border-rose-600 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                  : "bg-rose-600 text-white hover:bg-rose-500"
              }`}
            >
              {pendingAction === "mark_not_fit"
                ? "Saving…"
                : lead.reviewDecision === "NOT_FIT"
                  ? "✗ Marked not a fit"
                  : "Not a fit"}
            </button>
            <button
              type="button"
              onClick={() => runAction("approve_outreach")}
              disabled={pendingAction !== null || !lead.draftOutreachEmail}
              className={`rounded-md px-3 py-1.5 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                lead.outreachApproved === "YES"
                  ? "border-2 border-indigo-600 bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              }`}
              title={lead.draftOutreachEmail ? "Approve the drafted outreach email" : "No draft outreach email yet"}
            >
              {pendingAction === "approve_outreach"
                ? "Saving…"
                : lead.outreachApproved === "YES"
                  ? "✓ Outreach approved"
                  : "Approve outreach"}
            </button>
            <button
              type="button"
              onClick={() => runAction("retry_enrichment")}
              disabled={pendingAction !== null}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {pendingAction === "retry_enrichment" ? "Queuing…" : "Retry enrichment"}
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              disabled={pendingAction !== null}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Edit lead
            </button>
          </div>
        </div>
      </aside>

      <EditLeadDialog
        lead={editOpen ? lead : null}
        onClose={() => setEditOpen(false)}
        onSaved={() => onActionComplete?.()}
      />
    </div>
  );
}
