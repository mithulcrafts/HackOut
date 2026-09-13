import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VidyutSutra",
    short_name: "VidyutSutra",
    description: "A renewable aligned demand response planner.",
    start_url: "/consumer/today?demo=1",
    display: "standalone",
    background_color: "#f4f7f3",
    theme_color: "#12645d",
    lang: "en-IN",
  };
}
