import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || "";
if (!uri) throw new Error("MONGODB_URI missing");

declare global {
  var _mongoose: Promise<typeof mongoose> | undefined;
}

export async function connectDB() {
  if (!global._mongoose) {
    global._mongoose = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || "lead_suite_db",
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
  }
  return global._mongoose;
}
