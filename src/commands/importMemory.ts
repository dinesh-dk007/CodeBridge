import * as vscode from "vscode";
import { CurrentTaskChoice, prepareImportedMemory, replacePortableContext } from "../services/importService";
import {
  getMemoryUri,
  loadMemory,
  memoryFileExists,
  saveMemory,
} from "../services/memoryService";
import { scanWorkspace, WorkspaceScanCancelledError } from "../services/workspaceScanner";
import { parseAndValidateMemoryPackage, UnsupportedPackageVersionError } from "../utils/packageValidator";
import { sanitizePortableValue } from "../utils/memorySanitizer";

const noWorkspaceMessage = "No workspace folder is open. Please open a project folder and try again.";
const invalidPackageMessage = "The selected file is not a valid ContextBridge memory package.";
const maxPackageBytes = 10 * 1024 * 1024;
const contextChoices = [
  { label: "Merge Imported Context", value: "merge" },
  { label: "Replace Existing Context", value: "replace" },
  { label: "Cancel", value: "cancel" },
] as const;
const taskChoices = [
  { label: "Keep Current Workspace Task", value: "keepCurrent" },
  { label: "Use Imported Task", value: "useImported" },
] as const;

export async function importMemory(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showErrorMessage(noWorkspaceMessage);
    return;
  }

  outputChannel.appendLine("Starting memory import...");
  try {
    const [selectedFile] = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: "Import Memory",
      title: "Select a ContextBridge memory package",
      filters: {
        "ContextBridge Memory Package": ["contextbridge.json"],
        "JSON Files": ["json"],
      },
    }) ?? [];
    if (!selectedFile) {
      outputChannel.appendLine("Memory import cancelled.");
      return;
    }

    outputChannel.appendLine("Validating ContextBridge package...");
    const stat = await vscode.workspace.fs.stat(selectedFile);
    if (stat.size > maxPackageBytes) {
      throw new Error("The selected package exceeds the 10 MB import limit.");
    }
    const packageBytes = await vscode.workspace.fs.readFile(selectedFile);
    const parsedPackage = parseAndValidateMemoryPackage(packageBytes);
    const safePackage = sanitizePortableValue(parsedPackage);
    const portablePackage = parseAndValidateMemoryPackage(
      new TextEncoder().encode(JSON.stringify(safePackage)),
    );

    const hasExistingMemory = await memoryFileExists(getMemoryUri(folder));
    const existingMemory = hasExistingMemory ? await loadMemory(folder) : undefined;
    let strategy: "merge" | "replace" | "create" = "create";

    if (existingMemory) {
      const selectedStrategy = await vscode.window.showQuickPick(contextChoices, {
        placeHolder: "Choose how to apply the imported context",
        ignoreFocusOut: true,
      });
      if (!selectedStrategy || selectedStrategy.value === "cancel") {
        outputChannel.appendLine("Memory import cancelled.");
        return;
      }
      strategy = selectedStrategy.value;
    }

    outputChannel.appendLine("Analyzing current workspace...");
    const analysis = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "ContextBridge AI: Analyzing workspace for import...",
        cancellable: true,
      },
      async (progress, cancellationToken) => scanWorkspace(folder, {
        cancellationToken,
        onProgress: (message) => progress.report({ message }),
      }),
    );

    let currentTaskChoice: CurrentTaskChoice | undefined;
    if (strategy === "merge"
      && existingMemory?.developmentState.currentTask.trim()
      && portablePackage.memory.developmentState.currentTask.trim()) {
      const selectedTask = await vscode.window.showQuickPick(taskChoices, {
        placeHolder: "Both memories have a current task. Which one should be kept?",
        ignoreFocusOut: true,
      });
      if (!selectedTask) {
        outputChannel.appendLine("Memory import cancelled.");
        return;
      }
      currentTaskChoice = selectedTask.value;
    }

    outputChannel.appendLine("Preparing imported context...");
    const result = prepareImportedMemory(
      analysis,
      portablePackage,
      existingMemory,
      currentTaskChoice,
    );
    if (strategy === "replace") {
      replacePortableContext(result, portablePackage.memory);
    }

    outputChannel.appendLine("Saving project memory...");
    await saveMemory(folder, result);
    outputChannel.appendLine("Memory import completed successfully.");
    await vscode.window.showInformationMessage("ContextBridge AI: Memory imported successfully.");
  } catch (error) {
    if (error instanceof WorkspaceScanCancelledError) {
      outputChannel.appendLine("Memory import cancelled during workspace analysis.");
      return;
    }

    if (error instanceof UnsupportedPackageVersionError) {
      outputChannel.appendLine("Memory import stopped: unsupported package version.");
      await vscode.window.showErrorMessage(`ContextBridge AI: ${error.message}`);
      return;
    }

    if (error instanceof Error && error.message === invalidPackageMessage) {
      await vscode.window.showErrorMessage(invalidPackageMessage);
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine("Memory import failed.");
    await vscode.window.showErrorMessage(`ContextBridge AI: Memory import failed: ${message}`);
  }
}
