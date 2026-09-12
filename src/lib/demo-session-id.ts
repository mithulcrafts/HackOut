/** Demo cookies can never select an authenticated operator's namespace. */
export function isDemoSessionId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^demo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
