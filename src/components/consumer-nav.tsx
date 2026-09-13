"use client";
import { CircleGauge, UserRound, WalletCards, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getConsumerCopy } from "@/lib/language";
export function ConsumerNav({ active }: { active: "today"|"activities"|"offers"|"rewards"|"profile" }) {
 const [language, setLanguage] = useState("en-IN");
 useEffect(() => {
   const saved = window.localStorage.getItem("vidyut_language");
   if (saved) queueMicrotask(() => setLanguage(saved));
 }, []);
 const labels = getConsumerCopy(language);
 const items=[ ["today",labels.today,"/consumer/today",CircleGauge], ["activities",labels.activities,"/consumer/activities",Zap], ["offers",labels.offers,"/consumer/offers",WalletCards], ["rewards",labels.rewards,"/consumer/rewards",WalletCards], ["profile",labels.profile,"/consumer/profile",UserRound] ] as const;
 return <nav className="bottom-nav" aria-label="Consumer navigation">{items.map(([key,label,href,Icon])=><Link className={active===key?"active":""} aria-current={active===key ? "page" : undefined} href={href} key={key}><Icon aria-hidden="true" focusable="false" size={18}/><span>{label}</span></Link>)}</nav>;
}
