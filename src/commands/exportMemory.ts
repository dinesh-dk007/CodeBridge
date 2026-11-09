import * as vscode from "vscode";
import { loadMemory, memoryExists, missingMemoryMessage } from "../services/memoryService";
import { createSafeExportFileName, saveMemoryExport } from "../services/exportService";

const noWorkspaceMessage = "No workspace folder is open. Please open a project folder and try again.";

export async function exportMemory(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showErrorMessage(noWorkspaceMessage);
    return;
  }

  outputChannel.appendLine("Starting memory export...");
  try {
    if (!(await memoryExists(folder))) {
      await vscode.window.showInformationMessage(missingMemoryMessage);
      outputChannel.appendLine("Memory export stopped: no project memory was found.");
      return;
    }

    outputChannel.appendLine("Validating project memory...");
    const memory = await loadMemory(folder);
    const destination = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.joinPath(folder.uri, createSafeExportFileName(memory.project.name)),
      filters: { "ContextBridge Memory Package": ["json"] },
      saveLabel: "Export Memory",
      title: "Export ContextBridge Project Memory",
    });

    if (!destination) {
      outputChannel.appendLine("Memory export cancelled.");
      return;
    }

    outputChannel.appendLine("Creating portable package...");
    await saveMemoryExport(destination, memory);
    outputChannel.appendLine("Memory export completed successfully.");
    await vscode.window.showInformationMessage(
      "ContextBridge AI: Memory exported successfully.",
      "Reveal File",
    ).then(async (selection) => {
      if (selection === "Reveal File") {
        await vscode.commands.executeCommand("revealFileInOS", destination);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine("Memory export failed.");
    await vscode.window.showErrorMessage(`ContextBridge AI: Memory export failed: ${message}`);
  }
}
