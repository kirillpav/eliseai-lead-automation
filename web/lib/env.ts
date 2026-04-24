import { z } from "zod";

const schema = z.object({
  GOOGLE_SHEETS_ID: z.string().min(1, "GOOGLE_SHEETS_ID is required"),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email("GOOGLE_SERVICE_ACCOUNT_EMAIL must be a valid email"),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is required"),
  LEADS_SHEET_NAME: z.string().min(1).default("Leads"),
  WEB_APP_USER: z.string().min(1, "WEB_APP_USER is required"),
  WEB_APP_PASSWORD: z.string().min(1, "WEB_APP_PASSWORD is required")
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) {
    return cached;
  }

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  cached = {
    ...parsed.data,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: parsed.data.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n")
  };

  return cached;
}
