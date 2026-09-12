"use client";
export default function GlobalError({ reset }: { reset: () => void }) { return <html lang="en"><body style={{ background: "#10141c", color: "#f4f7fb", fontFamily: "Arial, sans-serif", padding: 24 }}><h1>VidyutSutra needs a restart</h1><p>This page could not be rendered. Try again.</p><button onClick={() => reset()}>Try again</button></body></html>; }
