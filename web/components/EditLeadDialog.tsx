"use client";

import { useEffect, useState } from "react";
import type { Lead } from "@/lib/lead-mapper";
import type { LeadInput } from "@shared/types";

interface Props {
  lead: Lead | null;
  onClose: () => void;
  onSaved: () => void;
}

const FIELDS: Array<{ key: keyof LeadInput; label: string; required?: boolean }> = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "company", label: "Company", required: true },
  { key: "propertyAddress", label: "Property address", required: true },
  { key: "city", label: "City", required: true },
  { key: "state", label: "State" },
  { key: "country", label: "Country", required: true }
];

function leadToInput(lead: Lead): LeadInput {
  return {
    name: lead.name,
    email: lead.email,
    company: lead.company,
    propertyAddress: lead.propertyAddress,
    city: lead.city,
    state: lead.state,
    country: lead.country
  };
}

function diffEdits(original: LeadInput, current: LeadInput): Partial<LeadInput> {
  const diff: Partial<LeadInput> = {};
  (Object.keys(current) as Array<keyof LeadInput>).forEach((key) => {
    if (current[key] !== original[key]) {
      diff[key] = current[key];
    }
  });
  return diff;
}

export function EditLeadDialog({ lead, onClose, onSaved }: Props) {
  const [values, setValues] = useState<LeadInput | null>(lead ? leadToInput(lead) : null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(lead ? leadToInput(lead) : null);
    setError(null);
  }, [lead]);

  if (!lead || !values) {
    return null;
  }

  const original = leadToInput(lead);
  const diff = diffEdits(original, values);
  const hasChanges = Object.keys(diff).length > 0;

  function update(key: keyof LeadInput, value: string) {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasChanges || !lead) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${lead.rowNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", edit: diff })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; issues?: string[] };
        throw new Error(payload.issues?.join("; ") || payload.error || `Request failed (${response.status})`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save edits");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Edit lead</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Saving will clear the row&apos;s status and re-trigger enrichment on the next sweep.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className="block text-sm">
              <span className="text-slate-700 dark:text-slate-200">
                {field.label}
                {field.required ? <span className="text-rose-500"> *</span> : null}
              </span>
              <input
                type={field.key === "email" ? "email" : "text"}
                value={values[field.key]}
                onChange={(event) => update(field.key, event.target.value)}
                required={field.required}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          ))}
        </div>

        {error && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !hasChanges}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save & re-enrich"}
          </button>
        </div>
      </form>
    </div>
  );
}
