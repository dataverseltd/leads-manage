#!/usr/bin/env tsx
/**
 * Backfill Company.roleMode field
 *
 * Usage examples:
 *   pnpm tsx apps/web/scripts/backfill-company-mode.ts --list
 *   pnpm tsx apps/web/scripts/backfill-company-mode.ts --mode=uploader --codes=A,B
 *   pnpm tsx apps/web/scripts/backfill-company-mode.ts --mode=receiver --all --dry-run
 */

import process from "node:process";
import mongoose from "mongoose";
import { config as dotenv } from "dotenv";

// load env from root/app
dotenv({ path: ".env" });
dotenv({ path: ".env.local" });
dotenv({ path: "apps/web/.env" });
dotenv({ path: "apps/web/.env.local" });

import { connectDB } from "../src/lib/db";
import Company from "../src/models/Company";

type RoleMode = "uploader" | "receiver" | "hybrid";

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const a of argv.slice(2)) {
    if (a.startsWith("--")) {
      const [k, v] = a.replace(/^--/, "").split("=");
      args[k] = v === undefined ? true : v;
    }
  }
  return args;
}

function ensureMode(v: any): RoleMode {
  if (v === "uploader" || v === "receiver" || v === "hybrid") return v;
  throw new Error(`Invalid --mode: ${v}. Must be uploader|receiver|hybrid`);
}

async function main() {
  const args = parseArgs(process.argv);
  const wantList = !!args.list;
  const allFlag = !!args.all;
  const dryRun = !!args["dry-run"] || !!args.dryrun;
  const modeArg = args.mode as string | undefined;
  const codesArg = (args.codes as string | undefined)?.trim();

  await connectDB();

  if (wantList) {
    const companies = await Company.find({})
      .select("_id name code roleMode active")
      .sort({ code: 1 })
      .lean();
    console.table(
      companies.map((c: any) => ({
        id: String(c._id),
        code: c.code,
        name: c.name,
        roleMode: c.roleMode || "hybrid",
        active: !!c.active,
      }))
    );
    return;
  }

  if (!modeArg) {
    console.log("❌ Missing --mode. Example: --mode=uploader");
    process.exit(1);
  }
  const roleMode = ensureMode(modeArg);

  if (!allFlag && !codesArg) {
    console.log("❌ Need --all or --codes=A,B");
    process.exit(1);
  }

  let filter: any = {};
  if (allFlag) filter = {};
  else if (codesArg) {
    const codes = codesArg
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    filter = { code: { $in: codes } };
  }

  const toUpdate = await Company.find(filter)
    .select("_id name code roleMode")
    .sort({ code: 1 })
    .lean();

  if (!toUpdate.length) {
    console.log("No companies matched.");
    return;
  }

  console.log("➡️ Will update:");
  console.table(
    toUpdate.map((c: any) => ({
      code: c.code,
      name: c.name,
      from: c.roleMode || "hybrid",
      to: roleMode,
    }))
  );

  if (dryRun) {
    console.log("Dry-run enabled. No DB writes performed.");
    return;
  }

  const res = await Company.updateMany(filter, { $set: { roleMode } });
  console.log(
    `✅ Updated. Matched: ${res.matchedCount ?? (res as any).n}, Modified: ${
      res.modifiedCount ?? (res as any).nModified
    }`
  );
}

main()
  .catch((err) => {
    console.error("Script error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
