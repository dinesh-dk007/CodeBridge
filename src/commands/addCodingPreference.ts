import * as vscode from "vscode";
import { addCodingPreference } from "../services/memoryService";
import { promptForText, reportDuplicateOrSuccess, runMemoryCommand } from "./memoryCommandUtils";

const preferenceCategories = [
  { label: "Coding Convention", value: "conventions" },
  { label: "Library to Avoid", value: "librariesToAvoid" },
  { label: "Additional Instruction", value: "additionalInstructions" },
] as const;

export async function addProjectCodingPreference(): Promise<void> {
  await runMemoryCommand(async (folder) => {
    const selection = await vscode.window.showQuickPick(preferenceCategories, {
      placeHolder: "Choose the coding preference category",
      ignoreFocusOut: true,
    });
    if (!selection) {
      return;
    }

    const preference = await promptForText("Enter the coding preference");
    if (!preference?.trim()) {
      return;
    }

    const added = await addCodingPreference(folder, selection.value, preference);
    await reportDuplicateOrSuccess(
      added,
      "ContextBridge AI: Coding preference added successfully.",
      "That coding preference is already recorded.",
    );
  });
}
