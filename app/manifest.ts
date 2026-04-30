import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vaulto Protocol",
    short_name: "Vaulto",
    description: "Trade, earn, and invest in tokenized private company stocks",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/apple-touch-icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
