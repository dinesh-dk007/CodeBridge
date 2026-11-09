import * as vscode from "vscode";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import {
  MEMORY_EXPORT_PACKAGE_FORMAT,
  MEMORY_EXPORT_PACKAGE_VERSION,
  MemoryExportPackage,
} from "../models/exportPackage";
import { ProjectMemory } from "../models/projectMemory";
import { sanitizeProjectMemory } from "../utils/memorySanitizer";

export function createMemoryExportPackage(memory: ProjectMemory): MemoryExportPackage {
  const sanitized = sanitizeProjectMemory(memory);
  const portableMemory: MemoryExportPackage["memory"] = {
    architecture: sanitized.architecture,
    requirements: sanitized.requirements,
    decisions: sanitized.decisions,
    developmentState: sanitized.developmentState,
    preferences: sanitized.preferences,
  };

  const result: MemoryExportPackage = {
    packageFormat: MEMORY_EXPORT_PACKAGE_FORMAT,
    packageVersion: MEMORY_EXPORT_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: "ContextBridge AI",
    project: {
      name: sanitized.project.name,
      description: sanitized.project.description,
      languages: sanitized.project.languages,
      importantFiles: sanitized.project.importantFiles,
    },
    memory: portableMemory,
  };

  validateMemoryExportPackage(result);
  return result;
}

export function validateMemoryExportPackage(value: unknown): asserts value is MemoryExportPackage {
  if (!isRecord(value)
    || value.packageFormat !== MEMORY_EXPORT_PACKAGE_FORMAT
    || value.packageVersion !== MEMORY_EXPORT_PACKAGE_VERSION
    || !isIsoTimestamp(value.exportedAt)
    || value.exportedBy !== "ContextBridge AI"
    || !isRecord(value.project)
    || !isRecord(value.memory)) {
    throw new Error("The portable memory package failed structural validation.");
  }

  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") {
    throw new Error("The portable memory package could not be serialized.");
  }

  const portableProject = value.project;
  if (!isString(portableProject.name)
    || !isString(portableProject.description)
    || !isStringArray(portableProject.languages)
    || !isStringArray(portableProject.importantFiles)
    || !isPortableMemory(value.memory)) {
    throw new Error("The portable memory package contains invalid project or memory data.");
  }

  if (Object.prototype.hasOwnProperty.call(portableProject, "rootPath")
    || containsMachineSpecificPath(value)) {
    throw new Error("The portable memory package contains machine-specific paths.");
  }
}

export function serializeMemoryExportPackage(memory: ProjectMemory): Uint8Array {
  const portablePackage = createMemoryExportPackage(memory);
  let serialized: string;
  try {
    serialized = `${JSON.stringify(portablePackage, null, 2)}\n`;
  } catch (error) {
    throw new Error("The portable memory package could not be serialized.", { cause: error });
  }

  return new TextEncoder().encode(serialized);
}

export async function saveMemoryExport(
  destination: vscode.Uri,
  memory: ProjectMemory,
): Promise<void> {
  const content = serializeMemoryExportPackage(memory);
  const parent = destination.with({ path: path.posix.dirname(destination.path) });
  const temporary = vscode.Uri.joinPath(parent, `.contextbridge-export-${randomUUID()}.tmp`);

  try {
    await vscode.workspace.fs.writeFile(temporary, content);
    await vscode.workspace.fs.rename(temporary, destination, { overwrite: true });
  } catch (error) {
    try {
      await vscode.workspace.fs.delete(temporary);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Memory export failed and its temporary file could not be removed.",
      );
    }

    throw error;
  }
}

export function createSafeExportFileName(projectName: string): string {
  const safeName = projectName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .trim()
    .replace(/^[. ]+|[. ]+$/g, "");

  const fallbackName = safeName || "contextbridge-memory";
  const windowsReservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(fallbackName);
  return `${windowsReservedName ? "_" : ""}${fallbackName}.contextbridge.json`;
}

function containsMachineSpecificPath(value: unknown): boolean {
  if (typeof value === "string") {
    return /[A-Za-z]:\\|\\\\[^\\\s]+\\|(?<![:\w])\/(?!\/)/.test(value);
  }

  if (Array.isArray(value)) {
    return value.some(containsMachineSpecificPath);
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value).some(([key, child]) =>
      /^(root|workspace|absolute|machine)path$/i.test(key)
      || containsMachineSpecificPath(child));
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isIsoTimestamp(value: unknown): value is string {
  return isString(value) && !Number.isNaN(Date.parse(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
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
