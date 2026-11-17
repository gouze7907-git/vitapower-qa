import { cookies } from "next/headers";
import { ChatApp } from "@/components/ChatApp";
import { Footer } from "@/components/Footer";
import { LoginGate } from "@/components/LoginGate";
import { verifySessionToken } from "@/lib/auth";
import { getIndex } from "@/lib/knowledge";
import { loadRules } from "@/lib/rules";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

export default async function Page() {
  const jar = await cookies();
  const authed = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  const rules = loadRules();
  const loadedCount = getIndex().docs.length;

  return (
    <div className="shell">
      {authed ? <ChatApp banner={rules.banner} /> : <LoginGate banner={rules.banner} />}
      <Footer rules={rules} loadedCount={loadedCount} />
    </div>
  );
}
