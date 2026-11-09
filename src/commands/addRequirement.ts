import * as vscode from "vscode";
import { addRequirement } from "../services/memoryService";
import { promptForText, reportDuplicateOrSuccess, runMemoryCommand } from "./memoryCommandUtils";

const requirementCategories = [
  { label: "Functional", value: "functional" },
  { label: "Non-Functional", value: "nonFunctional" },
  { label: "Constraint", value: "constraints" },
] as const;

export async function addProjectRequirement(): Promise<void> {
  await runMemoryCommand(async (folder) => {
    const selection = await vscode.window.showQuickPick(requirementCategories, {
      placeHolder: "Choose the requirement type",
      ignoreFocusOut: true,
    });
    if (!selection) {
      return;
    }

    const requirement = await promptForText("Enter the project requirement");
    if (!requirement?.trim()) {
      return;
    }

    const added = await addRequirement(folder, selection.value, requirement);
    await reportDuplicateOrSuccess(
      added,
      "ContextBridge AI: Requirement added successfully.",
      "That requirement is already recorded.",
    );
  });
}
