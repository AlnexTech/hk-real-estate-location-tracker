import { isAdminRole } from "@/lib/roles";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isPublic(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/invite" || pathname.startsWith("/invite/")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (
    pathname === "/api/invites/accept" ||
    pathname.startsWith("/api/invites/accept/")
  ) {
    return true;
  }
  if (
    pathname === "/api/invites/preview" ||
    pathname.startsWith("/api/invites/preview/")
  ) {
    return true;
  }
  return false;
}

function isAdminOnly(pathname: string): boolean {
  if (pathname === "/activity" || pathname.startsWith("/activity/")) return true;
  if (pathname === "/team" || pathname.startsWith("/team/")) return true;
  if (pathname.startsWith("/api/activity")) return true;
  if (pathname.startsWith("/api/members")) return true;
  if (pathname === "/api/invites" || pathname.startsWith("/api/invites/")) {
    if (pathname.startsWith("/api/invites/accept")) return false;
    if (pathname.startsWith("/api/invites/preview")) return false;
    return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  if (isAdminOnly(pathname) && !isAdminRole(typeof token.role === "string" ? token.role : null)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Admins only" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
