export const SESSION_COOKIE = "vp_session";

export function sessionCookie(value: string, request: Request, maxAge = 60 * 60 * 12) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: requestIsHttps(request),
    path: "/",
    maxAge,
  };
}

function requestIsHttps(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  return new URL(request.url).protocol === "https:";
}
