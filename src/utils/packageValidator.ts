import {
  MEMORY_EXPORT_PACKAGE_FORMAT,
  MEMORY_EXPORT_PACKAGE_VERSION,
  MemoryExportPackage,
} from "../models/exportPackage";

export class UnsupportedPackageVersionError extends Error {
  constructor(version: string) {
    super(`ContextBridge package version "${version}" is not supported. Supported version: ${MEMORY_EXPORT_PACKAGE_VERSION}.`);
    this.name = "UnsupportedPackageVersionError";
  }
}

export function parseAndValidateMemoryPackage(contents: Uint8Array): MemoryExportPackage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(contents)) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("The selected file is not a valid ContextBridge memory package.", { cause: error });
    }

    throw error;
  }

  if (!isRecord(parsed) || parsed.packageFormat !== MEMORY_EXPORT_PACKAGE_FORMAT) {
    throw new Error("The selected file is not a valid ContextBridge memory package.");
  }

  if (typeof parsed.packageVersion !== "string") {
    throw new Error("The selected file is not a valid ContextBridge memory package.");
  }
  if (parsed.packageVersion !== MEMORY_EXPORT_PACKAGE_VERSION) {
    throw new UnsupportedPackageVersionError(parsed.packageVersion);
  }

  if (!isIsoTimestamp(parsed.exportedAt)
    || parsed.exportedBy !== "ContextBridge AI"
    || !isRecord(parsed.project)
    || !isRecord(parsed.memory)
    || !isString(parsed.project.name)
    || !isString(parsed.project.description)
    || !isStringArray(parsed.project.languages)
    || !isStringArray(parsed.project.importantFiles)
    || !isPortableMemory(parsed.memory)) {
    throw new Error("The selected file is not a valid ContextBridge memory package.");
  }

  return parsed as unknown as MemoryExportPackage;
}

function isPortableMemory(value: Record<string, unknown>): boolean {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isIsoTimestamp(value: unknown): value is string {
  return isString(value) && !Number.isNaN(Date.parse(value));
}
