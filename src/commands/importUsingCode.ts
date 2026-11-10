import * as vscode from "vscode";
import { importPortablePackage } from "../services/importService";
import { TransferService } from "../services/transferService";
import { parseAndValidateMemoryPackage } from "../utils/packageValidator";
import { isValidTransferCode, normalizeTransferCode } from "../utils/transferCode";

const noWorkspaceMessage = "No workspace folder is open. Please open a project folder and try again.";

export async function importUsingTransferCode(
  outputChannel: vscode.OutputChannel,
  transferService: TransferService,
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showErrorMessage(noWorkspaceMessage);
    return;
  }

  outputChannel.appendLine("Starting ContextBridge transfer-code import...");

  const code = await vscode.window.showInputBox({
    prompt: "Enter a ContextBridge transfer code",
    placeHolder: "CB-AB12-CD34",
    ignoreFocusOut: true,
  });

  if (!code) {
    outputChannel.appendLine("Transfer-code import cancelled by the user.");
    return;
  }

  const normalizedCode = normalizeTransferCode(code);
  if (!isValidTransferCode(normalizedCode)) {
    outputChannel.appendLine(`Invalid transfer code format: ${normalizedCode}`);
    await vscode.window.showErrorMessage("ContextBridge AI: Invalid transfer code format. Use a code like CB-AB12-CD34.");
    return;
  }

  try {
    const lookup = await transferService.resolveCode(normalizedCode);

    if (lookup.status === "not_found") {
      outputChannel.appendLine(`Transfer code not found: ${normalizedCode}`);
      await vscode.window.showErrorMessage("Transfer code not found. Make sure you entered the correct code.");
      return;
    }

    if (lookup.status === "expired") {
      outputChannel.appendLine(`Expired transfer code encountered: ${normalizedCode}`);
      await vscode.window.showErrorMessage("This ContextBridge transfer code has expired. Please generate a new code.");
      return;
    }

    const { entry } = lookup;
    try {
      const portablePackage = parseAndValidateMemoryPackage(
        new TextEncoder().encode(JSON.stringify(entry.portablePackage)),
      );
      const result = await importPortablePackage({
        folder,
        outputChannel,
        portablePackage,
      });

      if (result === "cancelled") {
        outputChannel.appendLine(`Import cancelled for transfer code ${normalizedCode}.`);
        return;
      }

      await transferService.removeEntry(normalizedCode);
      outputChannel.appendLine(`Transfer code ${normalizedCode} removed after successful import.`);
      await vscode.window.showInformationMessage("ContextBridge AI: Memory imported successfully from transfer code.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Transfer-code import failed: ${message}`);
      await vscode.window.showErrorMessage(`ContextBridge AI: ${message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Transfer-code lookup failed: ${message}`);
    await vscode.window.showErrorMessage(`ContextBridge AI: Transfer code lookup failed: ${message}`);
  }
}
