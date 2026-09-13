import { redirect } from "next/navigation";

/** Forecast evaluation is an internal engineering route, not a user-facing product screen. */
export default function ForecastLabPage() {
  redirect("/operator/overview");
}
