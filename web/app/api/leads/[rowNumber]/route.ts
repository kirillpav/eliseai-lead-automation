import { NextResponse } from "next/server";
import { z } from "zod";
import type { LeadCellUpdates } from "@/lib/lead-mapper";
import { updateLeadCells } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const trimmed = z.string().trim();

const editSchema = z
  .object({
    name: trimmed.min(1).optional(),
    email: trimmed.email().optional(),
    company: trimmed.min(1).optional(),
    propertyAddress: trimmed.min(1).optional(),
    city: trimmed.min(1).optional(),
    state: trimmed.optional(),
    country: trimmed.min(1).optional()
  })
  .strict();

const bodySchema = z
  .object({
    action: z.enum(["mark_fit", "mark_not_fit", "approve_outreach", "retry_enrichment", "edit"]),
    edit: editSchema.optional(),
    reviewer: trimmed.optional()
  })
  .superRefine((value, ctx) => {
    if (value.action === "edit" && (!value.edit || Object.keys(value.edit).length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "edit action requires at least one field in 'edit'"
      });
    }
  });

const EDIT_FIELD_TO_HEADER = {
  name: "Name",
  email: "Email",
  company: "Company",
  propertyAddress: "Property Address",
  city: "City",
  state: "State",
  country: "Country"
} as const satisfies Record<keyof z.infer<typeof editSchema>, string>;

interface RouteContext {
  params: Promise<{ rowNumber: string }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { rowNumber: rowParam } = await context.params;
  const rowNumber = Number(rowParam);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    return NextResponse.json({ error: `Invalid row number: ${rowParam}` }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`);
    return NextResponse.json({ error: "Invalid request", issues }, { status: 400 });
  }

  const { action, edit, reviewer } = parsed.data;
  const reviewerName = reviewer || process.env.WEB_APP_USER || "web";
  const now = new Date().toISOString();
  const updates: LeadCellUpdates = {};

  switch (action) {
    case "mark_fit":
      updates["Review Decision"] = "FIT";
      updates["Reviewed At"] = now;
      updates["Reviewed By"] = reviewerName;
      break;
    case "mark_not_fit":
      updates["Review Decision"] = "NOT_FIT";
      updates["Reviewed At"] = now;
      updates["Reviewed By"] = reviewerName;
      break;
    case "approve_outreach":
      updates["Outreach Approved"] = "YES";
      updates["Reviewed At"] = now;
      updates["Reviewed By"] = reviewerName;
      break;
    case "retry_enrichment":
      // Blank Status; the sweep's initializeRowStatusIfBlank will stamp NEW and reprocess.
      updates.Status = "";
      break;
    case "edit": {
      if (!edit) {
        return NextResponse.json({ error: "Missing edit payload" }, { status: 400 });
      }
      for (const [field, value] of Object.entries(edit) as Array<[keyof typeof EDIT_FIELD_TO_HEADER, string]>) {
        updates[EDIT_FIELD_TO_HEADER[field]] = value;
      }
      // Re-trigger enrichment with the edited inputs.
      updates.Status = "";
      break;
    }
  }

  try {
    await updateLeadCells(rowNumber, updates);
    return NextResponse.json({ ok: true, rowNumber, action });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
