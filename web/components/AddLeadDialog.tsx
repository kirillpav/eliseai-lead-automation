"use client";

import { useState } from "react";
import type { LeadInput } from "@shared/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY: LeadInput = {
  name: "",
  email: "",
  company: "",
  propertyAddress: "",
  city: "",
  state: "",
  country: "United States"
};

const FIELDS: Array<{ key: keyof LeadInput; label: string; placeholder?: string; required?: boolean }> = [
  { key: "name", label: "Name", placeholder: "Jane Doe", required: true },
  { key: "email", label: "Email", placeholder: "jane@example.com", required: true },
  { key: "company", label: "Company", placeholder: "Acme Properties", required: true },
  { key: "propertyAddress", label: "Property address", placeholder: "123 Main St", required: true },
  { key: "city", label: "City", placeholder: "Austin", required: true },
  { key: "state", label: "State", placeholder: "TX" },
  { key: "country", label: "Country", placeholder: "United States", required: true }
];

export function AddLeadDialog({ open, onClose, onCreated }: Props) {
  const [values, setValues] = useState<LeadInput>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  function update(key: keyof LeadInput, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          issues?: string[];
        };
        throw new Error(payload.issues?.join("; ") || payload.error || `Request failed (${response.status})`);
      }
      setValues(EMPTY);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add lead");
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Add a lead</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            New leads are processed by the every-5-min Apps Script sweep, so it may take a few minutes for the row to enrich.
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
                placeholder={field.placeholder}
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
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Adding…" : "Add lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
