import mongoose from "mongoose";
import { TransferModel } from "../models/transfer";

export async function connectToDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is required to start the ContextBridge backend.");
  }

  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error("MONGODB_URI must be a valid MongoDB connection URI.");
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    await TransferModel.createIndexes();
    console.log("MongoDB connected for ContextBridge transfer storage.");
  } catch {
    throw new Error("Could not connect to MongoDB or initialize transfer indexes. Check MONGODB_URI and ensure the database is reachable.");
  }
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
