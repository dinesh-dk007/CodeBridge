import * as vscode from "vscode";
import {
  MemoryExportPackage,
  PortableProjectMemory,
} from "../models/exportPackage";
import { ProjectAnalysis } from "../models/projectAnalysis";
import { ProjectDecision, ProjectMemory } from "../models/projectMemory";
import { createProjectMemory, getMemoryUri, loadMemory, memoryFileExists, saveMemory } from "./memoryService";
import { sanitizePortableValue } from "../utils/memorySanitizer";
import { scanWorkspace } from "./workspaceScanner";

export const IMPORT_SOURCE = "ContextBridge portable memory package";
export const DEFAULT_ARCHITECTURE_OVERVIEW = "Architecture details have not yet been documented.";

export type CurrentTaskChoice = "keepCurrent" | "useImported";
export type ImportWorkflowResult = "imported" | "cancelled";

const contextChoices = [
  { label: "Merge Imported Context", value: "merge" },
  { label: "Replace Existing Context", value: "replace" },
  { label: "Cancel", value: "cancel" },
] as const;

const taskChoices = [
  { label: "Keep Current Workspace Task", value: "keepCurrent" },
  { label: "Use Imported Task", value: "useImported" },
] as const;

export async function importPortablePackage(options: {
  folder: vscode.WorkspaceFolder;
  outputChannel: vscode.OutputChannel;
  portablePackage: MemoryExportPackage;
  existingMemory?: ProjectMemory;
  explicitStrategy?: "merge" | "replace" | "create" | "cancel";
  explicitCurrentTaskChoice?: CurrentTaskChoice;
}): Promise<ImportWorkflowResult> {
  const hasExistingMemory = options.existingMemory !== undefined || await memoryFileExists(getMemoryUri(options.folder));
  const currentMemory = options.existingMemory ?? (hasExistingMemory ? await loadMemory(options.folder) : undefined);

  let strategy: "merge" | "replace" | "create" | "cancel" = options.explicitStrategy ?? "create";
  if (!options.explicitStrategy && currentMemory) {
    const selectedStrategy = await vscode.window.showQuickPick(contextChoices, {
      placeHolder: "Choose how to apply the imported context",
      ignoreFocusOut: true,
    });
    if (!selectedStrategy || selectedStrategy.value === "cancel") {
      options.outputChannel.appendLine("Memory import cancelled.");
      return "cancelled";
    }
    strategy = selectedStrategy.value;
  }

  const analysis = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "ContextBridge AI: Analyzing workspace for import...",
      cancellable: true,
    },
    async (progress, cancellationToken) => scanWorkspace(options.folder, {
      cancellationToken,
      onProgress: (message) => progress.report({ message }),
    }),
  );

  let currentTaskChoice = options.explicitCurrentTaskChoice;
  if (!currentTaskChoice && strategy === "merge"
    && currentMemory?.developmentState.currentTask.trim()
    && options.portablePackage.memory.developmentState.currentTask.trim()) {
    const selectedTask = await vscode.window.showQuickPick(taskChoices, {
      placeHolder: "Both memories have a current task. Which one should be kept?",
      ignoreFocusOut: true,
    });
    if (!selectedTask) {
      options.outputChannel.appendLine("Memory import cancelled.");
      return "cancelled";
    }
    currentTaskChoice = selectedTask.value;
  }

  const result = prepareImportedMemory(
    analysis,
    options.portablePackage,
    currentMemory,
    currentTaskChoice,
  );

  if (strategy === "replace") {
    replacePortableContext(result, options.portablePackage.memory);
  }

  await saveMemory(options.folder, result);
  options.outputChannel.appendLine("Memory import completed successfully.");
  return "imported";
}

export function prepareImportedMemory(
  analysis: ProjectAnalysis,
  sourcePackage: MemoryExportPackage,
  existingMemory?: ProjectMemory,
  currentTaskChoice?: CurrentTaskChoice,
): ProjectMemory {
  const imported = sanitizePortableValue(sourcePackage.memory) as PortableProjectMemory;
  const memory = existingMemory ? cloneMemory(existingMemory) : createProjectMemory(analysis);

  applyWorkspaceAnalysis(memory, analysis);
  applyImportedContext(memory, imported, existingMemory !== undefined, currentTaskChoice);
  const importedAt = new Date().toISOString();
  memory.metadata.updatedAt = importedAt;
  memory.metadata.lastImportedAt = importedAt;
  memory.metadata.importSource = IMPORT_SOURCE;
  return memory;
}

function applyWorkspaceAnalysis(memory: ProjectMemory, analysis: ProjectAnalysis): void {
  memory.project.name = analysis.projectName;
  memory.project.description = analysis.packageMetadata?.description ?? "";
  memory.project.rootPath = analysis.rootPath;
  memory.project.languages = [...analysis.detectedLanguages];
  memory.project.importantFiles = [...analysis.importantFiles];
  memory.architecture.projectStructure = [...analysis.projectStructure];
  memory.architecture.importantFiles = [...analysis.importantFiles];
}

function applyImportedContext(
  target: ProjectMemory,
  imported: PortableProjectMemory,
  merge: boolean,
  currentTaskChoice?: CurrentTaskChoice,
): void {
  const keepCurrentOverview = merge && target.architecture.overview.trim().length > 0
    && target.architecture.overview !== DEFAULT_ARCHITECTURE_OVERVIEW;
  if (!keepCurrentOverview && imported.architecture.overview.trim()) {
    target.architecture.overview = imported.architecture.overview;
  }

  target.requirements.functional = mergeUnique(
    target.requirements.functional,
    imported.requirements.functional,
  );
  target.requirements.nonFunctional = mergeUnique(
    target.requirements.nonFunctional,
    imported.requirements.nonFunctional,
  );
  target.requirements.constraints = mergeUnique(
    target.requirements.constraints,
    imported.requirements.constraints,
  );
  target.decisions = mergeDecisions(target.decisions, imported.decisions);

  target.developmentState.completedTasks = mergeUnique(
    target.developmentState.completedTasks,
    imported.developmentState.completedTasks,
  );
  target.developmentState.pendingTasks = mergeUnique(
    target.developmentState.pendingTasks,
    imported.developmentState.pendingTasks,
  );
  target.developmentState.knownIssues = mergeUnique(
    target.developmentState.knownIssues,
    imported.developmentState.knownIssues,
  );

  const currentTask = target.developmentState.currentTask.trim();
  const importedTask = imported.developmentState.currentTask.trim();
  if (!currentTask || !importedTask || currentTaskChoice === "useImported") {
    target.developmentState.currentTask = importedTask || currentTask;
  } else if (currentTaskChoice === "keepCurrent") {
    target.developmentState.currentTask = currentTask;
  }

  target.preferences.conventions = mergeUnique(
    target.preferences.conventions,
    imported.preferences.conventions,
  );
  target.preferences.librariesToAvoid = mergeUnique(
    target.preferences.librariesToAvoid,
    imported.preferences.librariesToAvoid,
  );
  target.preferences.additionalInstructions = mergeUnique(
    target.preferences.additionalInstructions,
    imported.preferences.additionalInstructions,
  );
}

export function replacePortableContext(
  target: ProjectMemory,
  imported: PortableProjectMemory,
): void {
  target.architecture.overview = imported.architecture.overview;
  target.requirements = {
    functional: [...imported.requirements.functional],
    nonFunctional: [...imported.requirements.nonFunctional],
    constraints: [...imported.requirements.constraints],
  };
  target.decisions = imported.decisions.map((decision) => ({ ...decision }));
  target.developmentState = {
    completedTasks: [...imported.developmentState.completedTasks],
    currentTask: imported.developmentState.currentTask,
    pendingTasks: [...imported.developmentState.pendingTasks],
    knownIssues: [...imported.developmentState.knownIssues],
  };
  target.preferences = {
    conventions: [...imported.preferences.conventions],
    librariesToAvoid: [...imported.preferences.librariesToAvoid],
    additionalInstructions: [...imported.preferences.additionalInstructions],
  };
}

function mergeUnique(existing: string[], incoming: string[]): string[] {
  const result = [...existing];
  const known = new Set(existing.map(normalizeForDuplicateCheck));
  for (const item of incoming) {
    const normalized = normalizeForDuplicateCheck(item);
    if (normalized && !known.has(normalized)) {
      result.push(item);
      known.add(normalized);
    }
  }
  return result;
}

function mergeDecisions(existing: ProjectDecision[], incoming: ProjectDecision[]): ProjectDecision[] {
  const result = [...existing];
  const ids = new Set(existing.map((decision) => decision.id).filter(Boolean));
  const decisionTexts = new Set(existing.map((decision) => normalizeForDuplicateCheck(decision.decision)));

  for (const decision of incoming) {
    if ((decision.id && ids.has(decision.id))
      || decisionTexts.has(normalizeForDuplicateCheck(decision.decision))) {
      continue;
    }
    result.push({ ...decision });
    if (decision.id) {
      ids.add(decision.id);
    }
    decisionTexts.add(normalizeForDuplicateCheck(decision.decision));
  }

  return result;
}

function normalizeForDuplicateCheck(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function cloneMemory(memory: ProjectMemory): ProjectMemory {
  return JSON.parse(JSON.stringify(memory)) as ProjectMemory;
}
