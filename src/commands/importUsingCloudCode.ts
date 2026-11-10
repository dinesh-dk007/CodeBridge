import * as vscode from "vscode";
import { BackendTransferService } from "../services/backendTransferService";
import { parseAndValidateMemoryPackage } from "../utils/packageValidator";
import { importPortablePackage } from "../services/importService";
import { normalizeTransferCode, isValidTransferCode } from "../utils/transferCode";

const noWorkspaceMessage = "No workspace folder is open. Please open a project folder and try again.";

export async function importUsingCloudTransferCode(
  outputChannel: vscode.OutputChannel,
  backendTransferService: BackendTransferService,
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showErrorMessage(noWorkspaceMessage);
    return;
  }

  outputChannel.appendLine("Starting ContextBridge cloud transfer-code import...");

  const code = await vscode.window.showInputBox({
    prompt: "Enter your ContextBridge cloud transfer code",
    placeHolder: "CB-AB12-CD34",
    ignoreFocusOut: true,
  });

  if (!code) {
    outputChannel.appendLine("Cloud transfer-code import cancelled by the user.");
    return;
  }

  const normalizedCode = normalizeTransferCode(code);
  if (!isValidTransferCode(normalizedCode)) {
    outputChannel.appendLine(`Invalid cloud transfer code format: ${normalizedCode}`);
    await vscode.window.showErrorMessage("ContextBridge AI: Invalid transfer code format. Use a code like CB-AB12-CD34.");
    return;
  }

  try {
    const packageFromServer = await backendTransferService.getTransfer(normalizedCode);
    const portablePackage = parseAndValidateMemoryPackage(
      new TextEncoder().encode(JSON.stringify(packageFromServer)),
    );

    const result = await importPortablePackage({
      folder,
      outputChannel,
      portablePackage,
    });

    if (result === "cancelled") {
      outputChannel.appendLine(`Cloud transfer import cancelled for code ${normalizedCode}.`);
      return;
    }

    try {
      await backendTransferService.consumeTransfer(normalizedCode);
      outputChannel.appendLine(`Cloud transfer ${normalizedCode} consumed after successful import.`);
    } catch (consumeError) {
      const message = consumeError instanceof Error ? consumeError.message : String(consumeError);
      outputChannel.appendLine(`Consumption warning after successful import: ${message}`);
      await vscode.window.showWarningMessage(`ContextBridge AI: Imported successfully, but the backend could not consume the transfer code: ${message}`);
    }

    await vscode.window.showInformationMessage("ContextBridge AI: Memory imported successfully from the cloud transfer code.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Cloud transfer-code import failed: ${message}`);

    if (message.toLowerCase().includes("not found")) {
      await vscode.window.showErrorMessage("Transfer code not found. Make sure you entered the correct code.");
      return;
    }

    if (message.toLowerCase().includes("expired")) {
      await vscode.window.showErrorMessage("This ContextBridge transfer code has expired. Please generate a new code.");
      return;
    }

    await vscode.window.showErrorMessage(`ContextBridge AI: ${message}`);
  }
}
