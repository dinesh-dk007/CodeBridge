import * as vscode from "vscode";
import { createMemoryExportPackage } from "../services/exportService";
import { BackendTransferService } from "../services/backendTransferService";
import { loadMemory, memoryExists, missingMemoryMessage } from "../services/memoryService";

const noWorkspaceMessage = "No workspace folder is open. Please open a project folder and try again.";

export async function generateCloudTransferCode(
  outputChannel: vscode.OutputChannel,
  backendTransferService: BackendTransferService,
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showErrorMessage(noWorkspaceMessage);
    return;
  }

  outputChannel.appendLine("Generating cloud ContextBridge transfer code...");

  try {
    if (!(await memoryExists(folder))) {
      outputChannel.appendLine("Cloud transfer generation stopped: no project memory was found.");
      await vscode.window.showInformationMessage(missingMemoryMessage);
      return;
    }

    const memory = await loadMemory(folder);
    const portablePackage = createMemoryExportPackage(memory);
    const payload = await backendTransferService.createTransfer(portablePackage);
    const expiresAt = new Date(payload.expiresAt);
    const message = `ContextBridge cloud transfer code generated: ${payload.transferCode}\nExpires at ${expiresAt.toLocaleString()}.`;

    outputChannel.appendLine(`Remote transfer code ${payload.transferCode} created by the backend.`);
    outputChannel.appendLine(`Expires at ${payload.expiresAt}.`);

    const selection = await vscode.window.showInformationMessage(message, "Copy Code");
    if (selection === "Copy Code") {
      try {
        await vscode.env.clipboard.writeText(payload.transferCode);
        await vscode.window.showInformationMessage("ContextBridge cloud transfer code copied to the clipboard.");
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Clipboard copy failed: ${detail}`);
        await vscode.window.showErrorMessage(`ContextBridge AI: Could not copy the cloud transfer code: ${detail}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Cloud transfer code generation failed: ${message}`);
    await vscode.window.showErrorMessage(`ContextBridge AI: ${message}`);
  }
}
