import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { ProjectAnalysis } from "../models/projectAnalysis";
import { PROJECT_MEMORY_SCHEMA_VERSION, ProjectMemory } from "../models/projectMemory";

export const memoryDirectoryName = ".contextbridge";
export const memoryFileName = "memory.json";
export const memorySource = "Generated from the ContextBridge Workspace Scanner";
export const missingMemoryMessage = "No ContextBridge project memory was found. Please create a memory snapshot first.";
const memoryUpdateQueues = new Map<string, Promise<void>>();

export class MissingProjectMemoryError extends Error {
  constructor() {
    super(missingMemoryMessage);
    this.name = "MissingProjectMemoryError";
  }
}

export function createProjectMemory(analysis: ProjectAnalysis): ProjectMemory {
  const timestamp = new Date().toISOString();
  const description = analysis.packageMetadata?.description ?? "";

  return {
    schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION,
    project: {
      name: analysis.projectName,
      description,
      rootPath: analysis.rootPath,
      languages: [...analysis.detectedLanguages],
      importantFiles: [...analysis.importantFiles],
    },
    architecture: {
      overview: "Architecture details have not yet been documented.",
      projectStructure: [...analysis.projectStructure],
      importantFiles: [...analysis.importantFiles],
    },
    requirements: {
      functional: [],
      nonFunctional: [],
      constraints: [],
    },
    decisions: [],
    developmentState: {
      completedTasks: [],
      currentTask: "",
      pendingTasks: [],
      knownIssues: [],
    },
    preferences: {
      conventions: [],
      librariesToAvoid: [],
      additionalInstructions: [],
    },
    metadata: {
      createdAt: timestamp,
      updatedAt: timestamp,
      source: memorySource,
    },
  };
}

export function getMemoryUri(folder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(folder.uri, memoryDirectoryName, memoryFileName);
}

export async function memoryExists(folder: vscode.WorkspaceFolder): Promise<boolean> {
  return memoryFileExists(getMemoryUri(folder));
}

export async function loadMemory(folder: vscode.WorkspaceFolder): Promise<ProjectMemory> {
  const uri = getMemoryUri(folder);
  if (!(await memoryExists(folder))) {
    throw new MissingProjectMemoryError();
  }

  let parsed: unknown;
  try {
    const contents = await vscode.workspace.fs.readFile(uri);
    parsed = JSON.parse(new TextDecoder().decode(contents)) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("The ContextBridge memory file contains invalid JSON.", { cause: error });
    }

    throw error;
  }

  if (!isProjectMemory(parsed)) {
    throw new Error("The ContextBridge memory file does not match the supported schema version 1.0.0.");
  }

  return parsed;
}

export async function saveMemory(
  folder: vscode.WorkspaceFolder,
  memory: ProjectMemory,
): Promise<void> {
  const directoryUri = vscode.Uri.joinPath(folder.uri, memoryDirectoryName);
  const memoryUri = getMemoryUri(folder);
  await vscode.workspace.fs.createDirectory(directoryUri);

  const temporaryUri = vscode.Uri.joinPath(
    directoryUri,
    `.memory-${randomUUID()}.tmp`,
  );
  const content = new TextEncoder().encode(`${JSON.stringify(memory, null, 2)}\n`);

  try {
    await vscode.workspace.fs.writeFile(temporaryUri, content);
    await vscode.workspace.fs.rename(temporaryUri, memoryUri, { overwrite: true });
  } catch (error) {
    try {
      await vscode.workspace.fs.delete(temporaryUri);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Could not save memory or clean up the temporary memory file.",
      );
    }

    throw error;
  }
}

export async function addRequirement(
  folder: vscode.WorkspaceFolder,
  category: "functional" | "nonFunctional" | "constraints",
  requirement: string,
): Promise<boolean> {
  const text = requirement.trim();
  if (!text) {
    return false;
  }

  return updateMemory(folder, (memory) => addUnique(memory.requirements[category], text));
}

export async function addDecision(
  folder: vscode.WorkspaceFolder,
  decision: string,
  reason: string,
  alternatives: string[],
  relatedFiles: string[],
): Promise<void> {
  await updateMemory(folder, (memory) => {
    memory.decisions.push({
      id: randomUUID(),
      decision: decision.trim(),
      reason: reason.trim(),
      alternatives: normalizeList(alternatives),
      relatedFiles: normalizeList(relatedFiles),
      createdAt: new Date().toISOString(),
      source: "developer",
      confidence: "high",
    });
    return true;
  });
}

export async function updateCurrentTask(
  folder: vscode.WorkspaceFolder,
  currentTask: string,
): Promise<boolean> {
  const task = currentTask.trim();
  if (!task) {
    return false;
  }

  return updateMemory(folder, (memory) => {
    if (memory.developmentState.currentTask === task) {
      return false;
    }

    memory.developmentState.currentTask = task;
    return true;
  });
}

export async function addPendingTask(
  folder: vscode.WorkspaceFolder,
  task: string,
): Promise<boolean> {
  const text = task.trim();
  if (!text) {
    return false;
  }

  return updateMemory(folder, (memory) => addUnique(memory.developmentState.pendingTasks, text));
}

export async function addKnownIssue(
  folder: vscode.WorkspaceFolder,
  issue: string,
): Promise<boolean> {
  const text = issue.trim();
  if (!text) {
    return false;
  }

  return updateMemory(folder, (memory) => addUnique(memory.developmentState.knownIssues, text));
}

export async function addCodingPreference(
  folder: vscode.WorkspaceFolder,
  category: "conventions" | "librariesToAvoid" | "additionalInstructions",
  preference: string,
): Promise<boolean> {
  const text = preference.trim();
  if (!text) {
    return false;
  }

  return updateMemory(folder, (memory) => addUnique(memory.preferences[category], text));
}

export async function refreshProjectAnalysis(
  folder: vscode.WorkspaceFolder,
  analysis: ProjectAnalysis,
): Promise<void> {
  await updateMemory(folder, (memory) => {
    memory.project.name = analysis.projectName;
    memory.project.rootPath = analysis.rootPath;
    memory.project.languages = [...analysis.detectedLanguages];
    memory.project.importantFiles = [...analysis.importantFiles];
    memory.architecture.projectStructure = [...analysis.projectStructure];
    memory.architecture.importantFiles = [...analysis.importantFiles];
    return true;
  });
}

async function updateMemory(
  folder: vscode.WorkspaceFolder,
  update: (memory: ProjectMemory) => boolean,
): Promise<boolean> {
  const key = getMemoryUri(folder).fsPath;
  const previous = memoryUpdateQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => gate);
  memoryUpdateQueues.set(key, queued);

  await previous;
  try {
    const memory = await loadMemory(folder);
    if (!update(memory)) {
      return false;
    }

    memory.metadata.updatedAt = new Date().toISOString();
    await saveMemory(folder, memory);
    return true;
  } finally {
    release();
    if (memoryUpdateQueues.get(key) === queued) {
      memoryUpdateQueues.delete(key);
    }
  }
}

function addUnique(items: string[], value: string): boolean {
  const duplicate = items.some((item) => item.trim().toLocaleLowerCase() === value.toLocaleLowerCase());
  if (duplicate) {
    return false;
  }

  items.push(value);
  return true;
}

function normalizeList(values: string[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) {
      unique.set(trimmed.toLocaleLowerCase(), trimmed);
    }
  }
  return [...unique.values()];
}

export async function memoryFileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    return (stat.type & vscode.FileType.File) !== 0;
  } catch (error) {
    if (isFileNotFound(error)) {
      return false;
    }

    throw error;
  }
}

function isFileNotFound(error: unknown): boolean {
  return error instanceof vscode.FileSystemError && error.code === "FileNotFound";
}

function isProjectMemory(value: unknown): value is ProjectMemory {
  if (!isRecord(value) || value.schemaVersion !== PROJECT_MEMORY_SCHEMA_VERSION) {
    return false;
  }

  const project = value.project;
  const architecture = value.architecture;
  const requirements = value.requirements;
  const developmentState = value.developmentState;
  const preferences = value.preferences;
  const metadata = value.metadata;

  return isRecord(project)
    && isString(project.name)
    && isString(project.description)
    && isString(project.rootPath)
    && isStringArray(project.languages)
    && isStringArray(project.importantFiles)
    && isRecord(architecture)
    && isString(architecture.overview)
    && isStringArray(architecture.projectStructure)
    && isStringArray(architecture.importantFiles)
    && isRecord(requirements)
    && isStringArray(requirements.functional)
    && isStringArray(requirements.nonFunctional)
    && isStringArray(requirements.constraints)
    && Array.isArray(value.decisions)
    && value.decisions.every(isProjectDecision)
    && isRecord(developmentState)
    && isStringArray(developmentState.completedTasks)
    && isString(developmentState.currentTask)
    && isStringArray(developmentState.pendingTasks)
    && isStringArray(developmentState.knownIssues)
    && isRecord(preferences)
    && isStringArray(preferences.conventions)
    && isStringArray(preferences.librariesToAvoid)
    && isStringArray(preferences.additionalInstructions)
    && isRecord(metadata)
    && isString(metadata.createdAt)
    && isString(metadata.updatedAt)
    && isString(metadata.source)
    && (metadata.lastImportedAt === undefined || isString(metadata.lastImportedAt))
    && (metadata.importSource === undefined || isString(metadata.importSource));
}

function isProjectDecision(value: unknown): boolean {
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
