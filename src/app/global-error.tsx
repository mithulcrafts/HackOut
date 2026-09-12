"use client";
export default function GlobalError({ reset }: { reset: () => void }) { return <html lang="en"><body style={{ background: "#10141c", color: "#f4f7fb", fontFamily: "Arial, sans-serif", padding: 24 }}><h1>Grid Pulse needs a restart</h1><p>The demo could not render this page.</p><button onClick={() => reset()}>Try again</button></body></html>; }
