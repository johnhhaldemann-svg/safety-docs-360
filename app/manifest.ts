import type { MetadataRoute } from "next";
import { APP_BRAND, productSentence } from "@/lib/appBrand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_BRAND.productName,
    short_name: APP_BRAND.shortName,
    description: productSentence(APP_BRAND.productName),
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
