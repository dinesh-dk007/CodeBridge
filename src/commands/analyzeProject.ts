import * as vscode from "vscode";
import { ProjectAnalysis } from "../models/projectAnalysis";
import { scanWorkspace, WorkspaceScanCancelledError } from "../services/workspaceScanner";

const noWorkspaceMessage = "No workspace folder is open. Please open a project folder and try again.";

export async function analyzeProject(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showErrorMessage(noWorkspaceMessage);
    return;
  }

  try {
    const analysis = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "ContextBridge AI: Analyzing project...",
        cancellable: true,
      },
      async (progress, cancellationToken) => scanWorkspace(folder, {
        cancellationToken,
        onProgress: (message) => progress.report({ message }),
      }),
    );

    outputChannel.clear();
    outputChannel.appendLine(formatAnalysis(analysis));
    outputChannel.show(true);
    await vscode.window.showInformationMessage("Project analysis completed successfully.");
  } catch (error) {
    if (error instanceof WorkspaceScanCancelledError) {
      await vscode.window.showInformationMessage("Project analysis was cancelled.");
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Project analysis failed: ${message}`);
  }
}

function formatAnalysis(analysis: ProjectAnalysis): string {
  const lines = [
    "====================================",
    "CONTEXTBRIDGE AI - PROJECT ANALYSIS",
    "====================================",
    "",
    `Project Name: ${analysis.projectName}`,
    `Root: ${analysis.rootPath}`,
    `Analyzed At: ${analysis.analyzedAt}`,
    "",
    "Languages:",
    ...formatList(analysis.detectedLanguages),
    "",
    "Important Files:",
    ...formatList(analysis.importantFiles),
    "",
    "Package Information:",
  ];

  if (analysis.packageMetadata) {
    const metadata = analysis.packageMetadata;
    lines.push(`Name: ${metadata.name ?? "Not specified"}`);
    lines.push(`Version: ${metadata.version ?? "Not specified"}`);
    lines.push(`Description: ${metadata.description ?? "Not specified"}`);
    lines.push("Dependencies:");
    lines.push(...formatList(metadata.dependencies ?? []));
    lines.push("Development Dependencies:");
    lines.push(...formatList(metadata.devDependencies ?? []));
  } else {
    lines.push("No valid root package.json metadata found.");
  }

  lines.push("", "Project Structure:");
  if (analysis.projectStructure.length === 0) {
    lines.push("(No files or folders found.)");
  } else {
    lines.push(...analysis.projectStructure.map((entry) => {
      const depth = entry.split("/").length - 1;
      const name = entry.endsWith("/") ? entry.slice(0, -1).split("/").pop() : entry.split("/").pop();
      return `${"  ".repeat(depth)}${name ?? entry}`;
    }));
  }

  if (analysis.warnings.length > 0) {
    lines.push("", "Warnings:", ...formatList(analysis.warnings));
  }

  return lines.join("\n");
}

function formatList(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- None detected"];
}
