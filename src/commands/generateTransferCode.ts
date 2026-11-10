import * as vscode from "vscode";
import { createMemoryExportPackage } from "../services/exportService";
import { loadMemory, memoryExists, missingMemoryMessage } from "../services/memoryService";
import { TransferService } from "../services/transferService";

const noWorkspaceMessage = "No workspace folder is open. Please open a project folder and try again.";

export async function generateTransferCode(
  outputChannel: vscode.OutputChannel,
  transferService: TransferService,
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showErrorMessage(noWorkspaceMessage);
    return;
  }

  outputChannel.appendLine("Generating ContextBridge transfer code...");

  try {
    if (!(await memoryExists(folder))) {
      outputChannel.appendLine("Transfer code generation stopped: no project memory was found.");
      await vscode.window.showInformationMessage(missingMemoryMessage);
      return;
    }

    const memory = await loadMemory(folder);
    const portablePackage = createMemoryExportPackage(memory);
    const entry = await transferService.generateTransferEntry(portablePackage);
    const expiresInMinutes = Math.max(1, Math.round((new Date(entry.expiresAt).getTime() - Date.now()) / 60000));
    const message = `ContextBridge transfer code generated: ${entry.transferCode}\nExpires in ${expiresInMinutes} minutes.`;

    outputChannel.appendLine(`Transfer code ${entry.transferCode} saved to the local registry.`);
    outputChannel.appendLine(`Expires at ${entry.expiresAt}.`);

    const choice = await vscode.window.showInformationMessage(message, "Copy Code");
    if (choice === "Copy Code") {
      try {
        await vscode.env.clipboard.writeText(entry.transferCode);
        await vscode.window.showInformationMessage("ContextBridge transfer code copied to the clipboard.");
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Clipboard copy failed: ${detail}`);
        await vscode.window.showErrorMessage(`ContextBridge AI: Could not copy the transfer code: ${detail}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Transfer code generation failed: ${message}`);
    await vscode.window.showErrorMessage(`ContextBridge AI: ${message}`);
  }
}
