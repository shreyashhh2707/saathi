"use client";

import dynamic from "next/dynamic";

// Everything lives in this browser's storage, so the app renders on the client only.
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => <main className="flex-1 bg-stone-100" />,
});

export default function Page() {
  return <App />;
}
