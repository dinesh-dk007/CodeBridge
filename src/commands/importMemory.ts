import * as vscode from "vscode";
import { importPortablePackage } from "../services/importService";
import { parseAndValidateMemoryPackage, UnsupportedPackageVersionError } from "../utils/packageValidator";
import { sanitizePortableValue } from "../utils/memorySanitizer";
import { WorkspaceScanCancelledError } from "../services/workspaceScanner";

const noWorkspaceMessage = "No workspace folder is open. Please open a project folder and try again.";
const invalidPackageMessage = "The selected file is not a valid ContextBridge memory package.";
const maxPackageBytes = 10 * 1024 * 1024;

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

    const result = await importPortablePackage({
      folder,
      outputChannel,
      portablePackage,
    });

    if (result === "cancelled") {
      outputChannel.appendLine("Memory import cancelled by the user.");
      return;
    }

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
