import { redirect } from "next/navigation";
import { resolveOperatorSession } from "./operator-access";

export async function requireOperatorPageSession() {
  const access = await resolveOperatorSession();
  if (!access) redirect("/login");
  return access.session;
}
