"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/backfill-company-mode.ts
require("@/lib/db");
var Company_1 = require("@/models/Company");
await Company_1.default.updateMany({ code: { $in: ["A", "C"] } }, { $set: { roleMode: "uploader" } });
await Company_1.default.updateMany({ code: { $in: ["B"] } }, { $set: { roleMode: "receiver" } });
// others → hybrid by default
