import { ConnectionBanner } from "@/components/consumer-feedback";
export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return <><ConnectionBanner />{children}</>;
}
