import * as vscode from "vscode";
import { refreshProjectAnalysis } from "../services/memoryService";
import { scanWorkspace, WorkspaceScanCancelledError } from "../services/workspaceScanner";
import { runMemoryCommand } from "./memoryCommandUtils";

export async function refreshProjectAnalysisCommand(): Promise<void> {
  await runMemoryCommand(async (folder) => {
    try {
      const analysis = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "ContextBridge AI: Refreshing project analysis...",
          cancellable: true,
        },
        async (progress, cancellationToken) => scanWorkspace(folder, {
          cancellationToken,
          onProgress: (message) => progress.report({ message }),
        }),
      );

      await refreshProjectAnalysis(folder, analysis);
      await vscode.window.showInformationMessage(
        "ContextBridge AI: Project analysis refreshed while preserving developer context.",
      );
    } catch (error) {
      if (error instanceof WorkspaceScanCancelledError) {
        await vscode.window.showInformationMessage("Project analysis refresh was cancelled.");
        return;
      }

      throw error;
    }
  });
}
