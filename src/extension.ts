import * as vscode from "vscode";
import { analyzeProject } from "./commands/analyzeProject";
import { exportMemory } from "./commands/exportMemory";
import { generateCloudTransferCode } from "./commands/generateCloudTransferCode";
import { generateTransferCode } from "./commands/generateTransferCode";
import { importMemory } from "./commands/importMemory";
import { importUsingCloudTransferCode } from "./commands/importUsingCloudCode";
import { importUsingTransferCode } from "./commands/importUsingCode";
import { addProjectCodingPreference } from "./commands/addCodingPreference";
import { addDevelopmentDecision } from "./commands/addDecision";
import { addProjectKnownIssue } from "./commands/addKnownIssue";
import { addProjectPendingTask } from "./commands/addPendingTask";
import { addProjectRequirement } from "./commands/addRequirement";
import { createMemorySnapshot } from "./commands/createMemorySnapshot";
import { refreshProjectAnalysisCommand } from "./commands/refreshProjectAnalysis";
import { updateProjectCurrentTask } from "./commands/updateCurrentTask";
import { viewProjectMemory } from "./commands/viewProjectMemory";
import { BackendTransferService } from "./services/backendTransferService";
import { createTransferService } from "./services/transferService";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("ContextBridge AI");
  const transferService = createTransferService(context);
  const backendTransferService = new BackendTransferService();
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand("contextbridge.analyzeProject", () => analyzeProject(outputChannel)),
    vscode.commands.registerCommand("contextbridge.createMemorySnapshot", createMemorySnapshot),
    vscode.commands.registerCommand("contextbridge.viewProjectMemory", viewProjectMemory),
    vscode.commands.registerCommand("contextbridge.addProjectRequirement", addProjectRequirement),
    vscode.commands.registerCommand("contextbridge.addDevelopmentDecision", addDevelopmentDecision),
    vscode.commands.registerCommand("contextbridge.updateCurrentTask", updateProjectCurrentTask),
    vscode.commands.registerCommand("contextbridge.addPendingTask", addProjectPendingTask),
    vscode.commands.registerCommand("contextbridge.addKnownIssue", addProjectKnownIssue),
    vscode.commands.registerCommand("contextbridge.addCodingPreference", addProjectCodingPreference),
    vscode.commands.registerCommand("contextbridge.refreshProjectAnalysis", refreshProjectAnalysisCommand),
    vscode.commands.registerCommand("contextbridge.exportMemory", () => exportMemory(outputChannel)),
    vscode.commands.registerCommand("contextbridge.importMemory", () => importMemory(outputChannel)),
    vscode.commands.registerCommand("contextbridge.generateTransferCode", () => generateTransferCode(outputChannel, transferService)),
    vscode.commands.registerCommand("contextbridge.importUsingTransferCode", () => importUsingTransferCode(outputChannel, transferService)),
    vscode.commands.registerCommand("contextbridge.generateCloudTransferCode", () => generateCloudTransferCode(outputChannel, backendTransferService)),
    vscode.commands.registerCommand("contextbridge.importUsingCloudTransferCode", () => importUsingCloudTransferCode(outputChannel, backendTransferService)),
  );
}
