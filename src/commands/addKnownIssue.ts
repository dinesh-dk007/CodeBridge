import * as vscode from "vscode";
import { addKnownIssue } from "../services/memoryService";
import { promptForText, runMemoryCommand } from "./memoryCommandUtils";

export async function addProjectKnownIssue(): Promise<void> {
  await runMemoryCommand(async (folder) => {
    const issue = await promptForText("Enter the known issue");
    if (!issue?.trim()) {
      return;
    }

    const added = await addKnownIssue(folder, issue);
    await vscode.window.showInformationMessage(
      added
        ? "ContextBridge AI: Known issue added successfully."
        : "That known issue is already recorded.",
    );
  });
}
