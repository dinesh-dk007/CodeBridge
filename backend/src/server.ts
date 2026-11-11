import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { connectToDatabase, isDatabaseReady } from "./config/database";
import transferRoutes from "./routes/transfers";

export const app = express();
const port = Number(process.env.PORT ?? "3000");

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.get("/health", (_request, response) => {
  const ready = isDatabaseReady();
  response.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "unavailable",
    service: "ContextBridge Transfer API",
    database: ready ? "connected" : "disconnected",
  });
});
app.use(transferRoutes);
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const status = getErrorStatus(error);
  const message = status === 413
    ? "Request body exceeds the 10 MB limit."
    : status === 400
      ? "Invalid JSON request body."
      : "The request could not be processed.";

  response.status(status).json({ success: false, error: message });
});

async function startServer(): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("PORT must be an integer between 1 and 65535.");
    process.exitCode = 1;
    return;
  }

  try {
    await connectToDatabase();
  } catch (error) {
    const message = error instanceof Error ? error.message : "MongoDB connection failed.";
    console.error(`ContextBridge backend startup failed: ${message}`);
    process.exitCode = 1;
    return;
  }

  mongoose.connection.on("disconnected", () => {
    console.error("MongoDB disconnected; transfer requests will report service errors until storage is restored.");
  });

  app.listen(port, () => {
    console.log(`ContextBridge backend listening on port ${port}.`);
  });
}

function getErrorStatus(error: unknown): number {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return 500;
  }

  const status = error.status;
  return typeof status === "number" && (status === 400 || status === 413) ? status : 500;
}

void startServer();
