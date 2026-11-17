"use client";

import { useRouter } from "next/navigation";

export function SiteHeader({ showLogout }: { showLogout: boolean }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <img src="/alphaess-logo.svg" alt="AlphaESS Nederland" width={185} height={53} />
        {showLogout ? (
          <button type="button" className="ghost" onClick={() => void logout()}>
            退出
          </button>
        ) : null}
      </div>
    </header>
  );
}
