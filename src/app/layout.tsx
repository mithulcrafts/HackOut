import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VidyutSutra | Renewable flexibility",
  description: "Use electricity at a better time and earn verified participation points.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
