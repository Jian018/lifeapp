import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { foodAnalysisSchema } from "@/lib/schemas";

describe("security and privacy contract", () => {
  const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/202608070001_initial_schema.sql"), "utf8");
  const productionMigration = readFileSync(path.join(process.cwd(), "supabase/migrations/202608070003_production_repository.sql"), "utf8");

  it("grants anonymous users SELECT but not browser writes", () => {
    expect(migration).toContain("grant select on public.system_settings");
    expect(migration).toContain("revoke all on all tables in schema public from public, anon, authenticated");
    expect(migration).not.toMatch(/create policy[^;]+for insert/i);
    expect(migration).not.toMatch(/create policy[^;]+for update/i);
    expect(migration).not.toMatch(/create policy[^;]+for delete/i);
  });

  it("does not add an image or image URL column to food entries", () => {
    const foodTable = migration.match(/create table public\.food_entries \([\s\S]+?\n\);/)?.[0] ?? "";
    expect(foodTable).not.toMatch(/image|base64|storage|blob/i);
  });

  it("enforces one active lifecycle effect per source", () => {
    expect(migration).toContain("uq_lifecycle_effects_active_source");
    expect(migration).toContain("where is_reverted = false");
  });

  it("rejects malformed AI output before persistence", () => {
    expect(foodAnalysisSchema.safeParse({ meal_name: "Unknown" }).success).toBe(false);
  });

  it("keeps the management code out of client source", () => {
    const clientFiles = ["components/admin-gate.tsx", "app/settings/page.tsx", "app/tasks/page.tsx", "app/calories/page.tsx"];
    for (const file of clientFiles) expect(readFileSync(path.join(process.cwd(), file), "utf8")).not.toContain("2468");
  });

  it("locks management again whenever the client provider mounts after refresh", () => {
    const source = readFileSync(path.join(process.cwd(), "components/admin-gate.tsx"), "utf8");
    expect(source).toContain('fetch("/api/admin/session", { method: "DELETE" })');
  });

  it("keeps four PIN slots when a partial numeric value is pasted", () => {
    const source = readFileSync(path.join(process.cwd(), "components/admin-gate.tsx"), "utf8");
    expect(source).toContain("Array.from({ length: 4 }");
    expect(source).not.toContain('padEnd(4, "")');
  });

  it("keeps historical task targets in the hosted database function", () => {
    expect(productionMigration).toContain("total_target = public.daily_task_records.base_target + excluded.carried_target");
    expect(productionMigration).not.toContain("base_target = excluded.base_target");
  });

  it("keeps hosted mutations service-role only", () => {
    expect(productionMigration).toContain("revoke execute on all functions in schema public from public, anon, authenticated");
    expect(productionMigration).toContain("grant execute on all functions in schema public to service_role");
  });

  it("routes production API persistence through the backend repository", () => {
    const routeFiles = [
      "app/api/tasks/complete/route.ts", "app/api/food/create/route.ts", "app/api/smoking/create/route.ts",
      "app/api/settings/general/route.ts", "app/api/settings/reset-all/route.ts", "app/api/public/dashboard/route.ts",
    ];
    for (const file of routeFiles) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).toContain("@/lib/repository");
      expect(source).not.toContain("@/lib/local-db");
    }
  });
});
