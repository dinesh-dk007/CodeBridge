import * as vscode from "vscode";
import { updateCurrentTask } from "../services/memoryService";
import { promptForText, runMemoryCommand } from "./memoryCommandUtils";

export async function updateProjectCurrentTask(): Promise<void> {
  await runMemoryCommand(async (folder) => {
    const task = await promptForText("Enter the current development task");
    if (task === undefined || !task.trim()) {
      return;
    }

    const updated = await updateCurrentTask(folder, task);
    await vscode.window.showInformationMessage(
      updated
        ? "ContextBridge AI: Current task updated."
        : "That task is already the current task.",
    );
  });
}
