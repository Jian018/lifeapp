import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Life System",
    short_name: "Life System",
    description: "Movement, nutrition and life direction in one personal system.",
    start_url: "/?pwa=1",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#07090b",
    theme_color: "#07090b",
    categories: ["health", "lifestyle", "productivity"],
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
