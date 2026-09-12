import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { supabaseConfigured } from "./backend.ts";

describe("supabaseConfigured", () => {
  it("requires both Vite env values", () => {
    assert.equal(supabaseConfigured({}), false);
    assert.equal(supabaseConfigured({ VITE_SUPABASE_URL: "https://x.supabase.co" }), false);
    assert.equal(
      supabaseConfigured({
        VITE_SUPABASE_URL: "https://x.supabase.co",
        VITE_SUPABASE_ANON_KEY: "anon",
      }),
      true,
    );
  });
});
