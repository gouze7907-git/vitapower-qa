import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/session-cookie";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie("", request, 0));
  return response;
}
