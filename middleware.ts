import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

const PAGE_PROTECTED_PREFIXES = ["/admin", "/projetos"];
const API_PROTECTED_PREFIXES = ["/api/admin", "/api/projetos", "/api/apis"];

function isProtectedPage(pathname: string) {
  return PAGE_PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isProtectedApi(pathname: string) {
  return API_PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function buildLoginRedirect(request: NextRequest) {
  const redirectUrl = new URL("/", request.url);
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  redirectUrl.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(redirectUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPage(pathname) && !isProtectedApi(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    if (isProtectedApi(pathname)) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    return buildLoginRedirect(request);
  }

  try {
    const user = await verifySessionToken(token);

    if (user.status !== "ativo") {
      if (isProtectedApi(pathname)) {
        return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
      }

      return buildLoginRedirect(request);
    }

    return NextResponse.next();
  } catch {
    if (isProtectedApi(pathname)) {
      return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
    }

    return buildLoginRedirect(request);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/projetos/:path*", "/api/admin/:path*", "/api/projetos/:path*", "/api/apis/:path*"],
};
