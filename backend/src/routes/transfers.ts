import { Router } from "express";
import { PortableContextbridgePackage } from "../models/transfer";
import { createTransfer, deleteTransfer, getTransfer } from "../services/transferStore";
import { normalizeTransferCode } from "../utils/transferCode";

const router = Router();
const STORAGE_KEY = "contextbridge-memory";
const STORAGE_VERSION = "1.0.0";

router.post("/api/transfers", async (request, response) => {
  let packageData: PortableContextbridgePackage;
  try {
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      return response.status(400).json({ success: false, error: "Transfer package payload is required." });
    }

    packageData = validatePackage(request.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid transfer package.";
    return response.status(400).json({ success: false, error: message });
  }

  try {
    const stored = await createTransfer(packageData);
    return response.status(201).json({
      success: true,
      transferCode: stored.code,
      expiresAt: stored.expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("unique transfer code")
      ? error.message
      : "Could not store transfer. Please try again.";
    return response.status(500).json({ success: false, error: message });
  }
});

router.get("/api/transfers/:code", async (request, response) => {
  const normalized = normalizeTransferCode(request.params.code);
  let lookup;
  try {
    lookup = await getTransfer(normalized);
  } catch {
    return response.status(500).json({ success: false, error: "Could not retrieve transfer. Please try again." });
  }

  if (lookup.expired) {
    return response.status(410).json({ success: false, error: "Transfer code has expired." });
  }

  if (!lookup.transfer) {
    return response.status(404).json({ success: false, error: "Transfer code not found." });
  }

  try {
    const packageData = validatePackage(lookup.transfer.package);
    return response.json({ success: true, package: packageData });
  } catch {
    try {
      await deleteTransfer(normalized);
    } catch {
      console.error("Could not remove an invalid stored transfer record.");
    }
    return response.status(500).json({ success: false, error: "Stored transfer package is invalid." });
  }
});

router.delete("/api/transfers/:code", async (request, response) => {
  const normalized = normalizeTransferCode(request.params.code);
  let removed: boolean;
  try {
    removed = await deleteTransfer(normalized);
  } catch {
    return response.status(500).json({ success: false, error: "Could not consume transfer. Please try again." });
  }

  if (!removed) {
    return response.status(404).json({ success: false, error: "Transfer code not found." });
  }

  return response.json({ success: true, message: "Transfer consumed." });
});

function validatePackage(value: unknown): PortableContextbridgePackage {
  if (!isRecord(value)) {
    throw new Error("Transfer package payload must be a JSON object.");
  }

  if (typeof value.packageFormat !== "string" || value.packageFormat !== STORAGE_KEY) {
    throw new Error("Transfer package is missing a valid package format.");
  }

  if (typeof value.packageVersion !== "string" || value.packageVersion !== STORAGE_VERSION) {
    throw new Error("Transfer package version is not supported.");
  }

  if (typeof value.exportedAt !== "string" || Number.isNaN(Date.parse(value.exportedAt))) {
    throw new Error("Transfer package is missing a valid exportedAt timestamp.");
  }

  if (value.exportedBy !== "ContextBridge AI") {
    throw new Error("Transfer package must be created by ContextBridge AI.");
  }

  if (!isRecord(value.project)
    || !isString(value.project.name)
    || !isString(value.project.description)
    || !isStringArray(value.project.languages)
    || !isStringArray(value.project.importantFiles)) {
    throw new Error("Transfer package project metadata is invalid.");
  }

  if (!isRecord(value.memory)) {
    throw new Error("Transfer package memory block is missing.");
  }

  const project = value.project as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(project, "rootPath") || containsMachineSpecificPath(value)) {
    throw new Error("Transfer package contains machine-specific path information.");
  }

  if (!isMemoryShape(value.memory)) {
    throw new Error("Transfer package structure is invalid.");
  }

  return value as unknown as PortableContextbridgePackage;
}

function isMemoryShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const architecture = value.architecture;
  const requirements = value.requirements;
  const developmentState = value.developmentState;
  const preferences = value.preferences;

  return isRecord(architecture)
    && isString(architecture.overview)
    && isStringArray(architecture.projectStructure)
    && isStringArray(architecture.importantFiles)
    && isRecord(requirements)
    && isStringArray(requirements.functional)
    && isStringArray(requirements.nonFunctional)
    && isStringArray(requirements.constraints)
    && Array.isArray(value.decisions)
    && value.decisions.every(isDecision)
    && isRecord(developmentState)
    && isStringArray(developmentState.completedTasks)
    && isString(developmentState.currentTask)
    && isStringArray(developmentState.pendingTasks)
    && isStringArray(developmentState.knownIssues)
    && isRecord(preferences)
    && isStringArray(preferences.conventions)
    && isStringArray(preferences.librariesToAvoid)
    && isStringArray(preferences.additionalInstructions);
}

function isDecision(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return isString(value.id)
    && isString(value.decision)
    && isString(value.reason)
    && isStringArray(value.alternatives)
    && isStringArray(value.relatedFiles)
    && isString(value.createdAt)
    && isString(value.source)
    && (value.confidence === "high" || value.confidence === "medium" || value.confidence === "low");
}

function containsMachineSpecificPath(value: unknown): boolean {
  if (typeof value === "string") {
    return /[A-Za-z]:\\|\\\\[^\\\s]+\\|(?<![:\w])\/(?!\/)/.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsMachineSpecificPath(item));
  }

  if (isRecord(value)) {
    return Object.entries(value).some(([key, child]) =>
      /^(root|workspace|absolute|machine)path$/i.test(key)
      || containsMachineSpecificPath(child),
    );
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export default router;
