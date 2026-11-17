import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return NextResponse.next();
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/logout")) {
    return NextResponse.next();
  }
  const ok = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
