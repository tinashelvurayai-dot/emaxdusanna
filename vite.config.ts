// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually:
//   tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro, componentTagger (dev-only),
//   VITE_* env injection, @ path alias, React/TanStack dedupe, error logger plugins.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

const isVercel = !!process.env.VERCEL;

export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  nitro: isVercel ? { preset: "vercel" } : undefined,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      devOptions: { enabled: false },
      includeAssets: ["favicon.ico", "robots.txt", "logo.webp", "icon-192.png", "icon-512.png", "manifest.webmanifest"],
      manifest: false,
      workbox: {
        navigateFallback: "/",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/_serverFn/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "edusanna-pages",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(?:js|css|woff2?|ttf)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "edusanna-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith("lovable.app") ||
              /\.(?:png|jpg|jpeg|svg|webp|avif|gif)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "edusanna-images",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
