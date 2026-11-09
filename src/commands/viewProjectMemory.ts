import * as vscode from "vscode";
import { getMemoryUri, memoryFileExists } from "../services/memoryService";

const noWorkspaceMessage = "No workspace folder is open. Please open a project folder and try again.";

export async function viewProjectMemory(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showErrorMessage(noWorkspaceMessage);
    return;
  }

  try {
    const memoryUri = getMemoryUri(folder);
    if (!(await memoryFileExists(memoryUri))) {
      await vscode.window.showInformationMessage(
        "No project memory snapshot was found. Run “ContextBridge: Create Memory Snapshot” first.",
      );
      return;
    }

    const document = await vscode.workspace.openTextDocument(memoryUri);
    await vscode.window.showTextDocument(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Could not open project memory: ${message}`);
  }
}
