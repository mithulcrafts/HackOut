"use client";
export default function ConsumerError({ reset }: { reset: () => void }) {
  return <main className="app-shell"><section className="content-section"><h1>Unable to load this screen</h1><p>Your saved records have not been changed. Check your connection and retry.</p><button className="primary-button" onClick={reset}>Try again</button></section></main>;
}
