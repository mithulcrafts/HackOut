import { ConnectionBanner } from "@/components/consumer-feedback";

/** Keep operator mutations explicit when the browser has lost connectivity. */
export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return <><ConnectionBanner />{children}</>;
}

