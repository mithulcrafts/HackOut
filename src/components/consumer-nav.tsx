import { CircleGauge, UserRound, WalletCards, Zap } from "lucide-react";
import Link from "next/link";
export function ConsumerNav({ active }: { active: "today"|"activities"|"offers"|"rewards"|"profile" }) {
 const items=[ ["today","Today","/consumer/today",CircleGauge], ["activities","Activities","/consumer/activities",Zap], ["offers","Offers","/consumer/offers",WalletCards], ["rewards","Rewards","/consumer/rewards",WalletCards], ["profile","Profile","/consumer/profile",UserRound] ] as const;
 return <nav className="bottom-nav" aria-label="Consumer navigation">{items.map(([key,label,href,Icon])=><Link className={active===key?"active":""} href={href} key={key}><Icon size={18}/><span>{label}</span></Link>)}</nav>;
}
