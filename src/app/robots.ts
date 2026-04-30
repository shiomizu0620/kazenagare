import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/garden/setup",
        "/garden/setup-name",
        "/garden/empty",
        "/garden/publish",
        "/garden/me",
        "/test-ui",
        "/voice-zoo",
      ],
    },
    sitemap: "https://kazenagare.vercel.app/sitemap.xml",
  };
}
