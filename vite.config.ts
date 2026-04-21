import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Pre-bundle heavy deps so the dev server doesn't stall on first navigation
  // and so production builds get stable, cacheable vendor chunks.
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@supabase/supabase-js",
      "@tanstack/react-query",
      "lucide-react",
      "framer-motion",
      "date-fns",
      "sonner",
    ],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Long-term-cacheable vendor splits. Keeps the entry chunk small so
        // first paint isn't blocked behind a single 1MB JS file.
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) {
            return "vendor-react";
          }
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("jspdf") || id.includes("html2canvas") || id.includes("pdf")) {
            return "vendor-pdf";
          }
          if (id.includes("date-fns")) return "vendor-date";
          return "vendor";
        },
      },
    },
  },
}));
