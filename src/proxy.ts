import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoSessionId } from "@/lib/demo-session-id";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const demoEnabled = process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true";
  const candidateDemo = request.cookies.get("hackout_demo_session")?.value;
  const existingDemo = demoEnabled && isDemoSessionId(candidateDemo) ? candidateDemo : undefined;
  const requestedDemo = request.nextUrl.searchParams.get("demo") === "1";
  if (demoEnabled && (existingDemo || requestedDemo)) {
    if (requestedDemo && !existingDemo) {
      const session = "demo-" + crypto.randomUUID();
      request.cookies.set("hackout_demo_session", session);
      response = NextResponse.next({ request });
      response.cookies.set("hackout_demo_session", session, { httpOnly: true, sameSite: "lax", maxAge: 8 * 60 * 60, path: "/" });
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.redirect(new URL("/login?setup=required", request.url));
  const db = createServerClient(url, key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll: values => {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  } });
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }
  if (request.nextUrl.pathname.startsWith("/operator") && user.app_metadata.role !== "operator") {
    return NextResponse.redirect(new URL("/consumer/today", request.url));
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/consumer/:path*", "/operator/:path*"] };
