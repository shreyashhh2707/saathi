"use client";

import dynamic from "next/dynamic";

// Testing shortcut: open the app with ?reset to wipe this browser's data and start onboarding fresh.
if (typeof window !== "undefined" && new URLSearchParams(location.search).has("reset")) {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("saathi.")).forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage blocked: nothing to clear.
  }
  history.replaceState(null, "", location.pathname);
}

// Everything lives in this browser's storage, so the app renders on the client only.
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => <main className="flex-1 bg-cream" />,
});

export default function Page() {
  return <App />;
}
