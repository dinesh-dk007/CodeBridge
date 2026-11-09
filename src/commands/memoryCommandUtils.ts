import * as vscode from "vscode";
import {
  memoryExists,
  MissingProjectMemoryError,
  missingMemoryMessage,
} from "../services/memoryService";

const noWorkspaceMessage = "No workspace folder is open. Please open a project folder and try again.";

export async function runMemoryCommand(
  action: (folder: vscode.WorkspaceFolder) => Promise<void>,
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showErrorMessage(noWorkspaceMessage);
    return;
  }

  try {
    if (!(await memoryExists(folder))) {
      await vscode.window.showInformationMessage(missingMemoryMessage);
      return;
    }

    await action(folder);
  } catch (error) {
    if (error instanceof MissingProjectMemoryError) {
      await vscode.window.showInformationMessage(missingMemoryMessage);
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`ContextBridge AI: Memory update failed: ${message}`);
  }
}

export async function promptForText(
  prompt: string,
  placeHolder?: string,
): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt,
    placeHolder,
    ignoreFocusOut: true,
  });
}

export function splitOptionalList(value: string | undefined): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

export function reportDuplicateOrSuccess(
  added: boolean,
  successMessage: string,
  duplicateMessage: string,
): Thenable<string | undefined> {
  return vscode.window.showInformationMessage(added ? successMessage : duplicateMessage);
}
