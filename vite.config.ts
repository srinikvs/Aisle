import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Playadda path deploy. Override with BASE_PATH=/ for site-root hosts (Sarukulu). */
const DEFAULT_BASE = "/aisle/";

declare const process: { env: Record<string, string | undefined> };

function resolveBase(raw: string | undefined): string {
  if (raw == null || raw.trim() === "") return DEFAULT_BASE;
  const trimmed = raw.trim();
  if (trimmed === "/") return "/";
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

const base = resolveBase(process.env.BASE_PATH);

export default defineConfig({
  base,
  plugins: [react()],
  server: { host: true, port: 5173, open: base },
  preview: { host: true, port: 4173 },
});
