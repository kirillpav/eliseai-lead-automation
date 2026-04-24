import { NextResponse, type NextRequest } from "next/server";

const REALM = "EliseAI Leads";

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"` }
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function middleware(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }

  const expectedUser = process.env.WEB_APP_USER;
  const expectedPassword = process.env.WEB_APP_PASSWORD;
  if (!expectedUser || !expectedPassword) {
    return new NextResponse("Server is not configured: WEB_APP_USER / WEB_APP_PASSWORD missing", { status: 500 });
  }

  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("basic ")) {
    return unauthorized();
  }

  let decoded = "";
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return unauthorized();
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) {
    return unauthorized();
  }

  const user = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (!timingSafeEqual(user, expectedUser) || !timingSafeEqual(password, expectedPassword)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
