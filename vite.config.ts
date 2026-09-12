import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Playadda path deploy. Override with BASE_PATH=/ or `vite --base /` for Sarukulu. */
const DEFAULT_BASE = "/aisle/";

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
};

function cliBase(): string | undefined {
  const args = process.argv;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--base=")) return arg.slice("--base=".length);
    if (arg === "--base") return args[i + 1];
  }
  return undefined;
}

function resolveBase(raw: string | undefined): string {
  if (raw == null || raw.trim() === "") return DEFAULT_BASE;
  const trimmed = raw.trim();
  if (trimmed === "/") return "/";
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

const base = resolveBase(cliBase() ?? process.env.BASE_PATH);

export default defineConfig({
  base,
  plugins: [react()],
  server: { host: true, port: 5173, open: base },
  preview: { host: true, port: 4173 },
});
