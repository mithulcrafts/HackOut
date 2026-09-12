// Never return database details: they can contain private row values.
export function activityDatabaseError(code: string) {
  if (["PGRST205", "42P01", "PGRST204", "42703"].includes(code)) {
    return { status: 503, error: "Activity storage needs a database update. Please contact the app administrator." };
  }
  if (code === "42501") {
    return { status: 403, error: "Your account cannot access activity storage. Please contact the app administrator." };
  }
  if (code === "23514") {
    return { status: 400, error: "This activity does not match the database requirements. Check the details or contact the app administrator." };
  }
  return { status: 503, error: "Activity storage is temporarily unavailable. Please try again." };
}
