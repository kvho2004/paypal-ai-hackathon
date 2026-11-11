import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeNext, sessionSecretConfigured, verifySession } from "./lib/auth/session";

// Everything needs a signed-in student except:
// - the login page and the auth API
// - Demo Diner: a separate restaurant site with its own login, which Kernel's browser must be able to reach
// - the PayPal webhook: PayPal calls it and cannot sign in (it must verify PayPal's signature instead)
const PUBLIC_PATHS = [/^\/login$/, /^\/api\/auth\//, /^\/demo-diner(\/|$)/, /^\/api\/paypal\/webhook$/];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => p.test(pathname))) return NextResponse.next();

  // Production without SESSION_SECRET: nobody can sign in. Fail closed, and say why instead of looping to /login.
  if (!sessionSecretConfigured()) {
    return new NextResponse("Sign-in is not configured on this server (SESSION_SECRET is missing).", { status: 503 });
  }

  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (userId) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  const next = safeNext(pathname + search, "");
  if (next && next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip Next's own assets and static images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif)$).*)"],
};
