import Link from "next/link";

const links = [
  ["Overview", "/operator/overview"],
  ["Events", "/operator/events"],
  ["Flexibility", "/operator/flexibility"],
  ["Verification", "/operator/verification"],
  ["Rewards", "/operator/rewards"],
  ["Reports", "/operator/reports"],
  ["Simulation", "/operator/simulation"],
  ["Forecast lab", "/operator/forecast-lab"],
  ["Settings", "/operator/settings"],
] as const;

export function OperatorNav({ active }: { active?: string }) {
  return (
    <nav className="operator-subnav" aria-label="Operator navigation">
      {links.map(([label, href]) => (
        <Link key={href} href={href} aria-current={active === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
