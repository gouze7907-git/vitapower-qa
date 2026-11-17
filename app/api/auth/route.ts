import { NextResponse } from "next/server";
import { appPassword, passwordMatches, sessionTokenForPassword } from "@/lib/auth";
import { sessionCookie } from "@/lib/session-cookie";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const password = appPassword();
  if (!password) {
    return NextResponse.json({ error: "服务器未配置 APP_PASSWORD" }, { status: 500 });
  }

  const body: unknown = await request.json().catch(() => null);
  const input = body && typeof body === "object" && "password" in body ? body.password : "";
  if (typeof input !== "string" || !(await passwordMatches(input))) {
    return NextResponse.json({ error: "口令不正确" }, { status: 401 });
  }

  const token = await sessionTokenForPassword(password);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie(token, request));
  return response;
}
