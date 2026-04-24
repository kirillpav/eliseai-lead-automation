import { LeadsTable } from "@/components/LeadsTable";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          EliseAI Leads
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Live mirror of the lead enrichment pipeline. Polls the source sheet every 10 seconds.
        </p>
      </header>
      <LeadsTable />
    </main>
  );
}
