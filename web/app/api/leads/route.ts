import { NextResponse } from "next/server";
import { z } from "zod";
import { appendLead, listLeads } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const trimmed = z.string().trim();

const leadInputSchema = z.object({
  name: trimmed.min(1, "Name is required"),
  email: trimmed.email("A valid email is required"),
  company: trimmed.min(1, "Company is required"),
  propertyAddress: trimmed.min(1, "Property address is required"),
  city: trimmed.min(1, "City is required"),
  state: trimmed.default(""),
  country: trimmed.min(1, "Country is required")
});

export async function GET() {
  try {
    const leads = await listLeads();
    return NextResponse.json(
      { leads, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load leads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const parsed = leadInputSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`);
    return NextResponse.json({ error: "Invalid lead input", issues }, { status: 400 });
  }

  try {
    const result = await appendLead(parsed.data);
    return NextResponse.json({ rowNumber: result.rowNumber }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to append lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
