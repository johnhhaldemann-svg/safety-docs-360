import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SafePredict by Safety360Docs",
    short_name: "SafePredict",
    description: "SafePredict by Safety360Docs: safety operations for risk, compliance, documentation, and field execution.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
