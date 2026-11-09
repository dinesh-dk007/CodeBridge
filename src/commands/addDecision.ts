import * as vscode from "vscode";
import { addDecision } from "../services/memoryService";
import {
  promptForText,
  runMemoryCommand,
  splitOptionalList,
} from "./memoryCommandUtils";

export async function addDevelopmentDecision(): Promise<void> {
  await runMemoryCommand(async (folder) => {
    const decision = await promptForText("Enter the development decision");
    if (!decision?.trim()) {
      return;
    }

    const reason = await promptForText("Why was this decision made?");
    if (!reason?.trim()) {
      return;
    }

    const alternatives = await promptForText(
      "Enter alternatives considered (optional, comma-separated)",
      "e.g. SQLite, PostgreSQL",
    );
    if (alternatives === undefined) {
      return;
    }

    const relatedFiles = await promptForText(
      "Enter related files (optional, comma-separated)",
      "e.g. src/services/storage.ts, package.json",
    );
    if (relatedFiles === undefined) {
      return;
    }

    await addDecision(
      folder,
      decision,
      reason,
      splitOptionalList(alternatives),
      splitOptionalList(relatedFiles),
    );
    await vscode.window.showInformationMessage("ContextBridge AI: Development decision saved.");
  });
}
