import * as vscode from "vscode";
import { createProjectMemory, getMemoryUri, memoryFileExists, saveMemory } from "../services/memoryService";
import { scanWorkspace, WorkspaceScanCancelledError } from "../services/workspaceScanner";

const noWorkspaceMessage = "No workspace folder is open. Please open a project folder and try again.";
const replaceSnapshotOption = "Replace existing snapshot";
const cancelOption = "Cancel";

export async function createMemorySnapshot(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showErrorMessage(noWorkspaceMessage);
    return;
  }

  try {
    const analysis = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "ContextBridge AI: Creating project memory snapshot...",
        cancellable: true,
      },
      async (progress, cancellationToken) => scanWorkspace(folder, {
        cancellationToken,
        onProgress: (message) => progress.report({ message }),
      }),
    );

    const memoryUri = getMemoryUri(folder);
    if (await memoryFileExists(memoryUri)) {
      const choice = await vscode.window.showWarningMessage(
        "A ContextBridge memory snapshot already exists. Replacing it will overwrite its contents.",
        { modal: true },
        replaceSnapshotOption,
        cancelOption,
      );
      if (choice !== replaceSnapshotOption) {
        return;
      }
    }

    const memory = createProjectMemory(analysis);
    await saveMemory(folder, memory);
    await vscode.window.showInformationMessage(
      "ContextBridge AI: Project memory snapshot created successfully.",
    );
  } catch (error) {
    if (error instanceof WorkspaceScanCancelledError) {
      await vscode.window.showInformationMessage("Project memory snapshot creation was cancelled.");
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Could not create project memory snapshot: ${message}`);
  }
}
