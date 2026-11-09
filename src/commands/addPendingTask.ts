import * as vscode from "vscode";
import { addPendingTask } from "../services/memoryService";
import { promptForText, runMemoryCommand } from "./memoryCommandUtils";

export async function addProjectPendingTask(): Promise<void> {
  await runMemoryCommand(async (folder) => {
    const task = await promptForText("Enter the pending task");
    if (!task?.trim()) {
      return;
    }

    const added = await addPendingTask(folder, task);
    await vscode.window.showInformationMessage(
      added
        ? "ContextBridge AI: Pending task added successfully."
        : "That pending task is already recorded.",
    );
  });
}
