const SESSION_MESSAGE = "vitapower-qa-session-v1";

export function appPassword(): string | undefined {
  const value = process.env.APP_PASSWORD;
  if (!value || !value.trim()) return undefined;
  return value;
}

export async function passwordMatches(input: string): Promise<boolean> {
  const expected = appPassword();
  if (!expected || !input) return false;
  const [left, right] = await Promise.all([sha256Hex(input), sha256Hex(expected)]);
  return safeEqual(left, right);
}

export async function sessionTokenForPassword(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(SESSION_MESSAGE),
  );
  return toHex(new Uint8Array(signature));
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const password = appPassword();
  if (!password || !token) return false;
  const expected = await sessionTokenForPassword(password);
  return safeEqual(expected, token);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}
