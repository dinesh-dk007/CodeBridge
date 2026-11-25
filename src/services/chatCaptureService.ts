import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { ChatPrompt } from "../models/projectMemory";
import { redactSecrets } from "../utils/memorySanitizer";
import {
  addChatPrompts,
  loadMemory,
  memoryDirectoryName,
  memoryExists,
} from "./memoryService";

export const INBOX_FILE_NAME = "inbox.jsonl";
export const MAX_PROMPT_LENGTH = 8000;
const PROCESSING_PREFIX = "inbox-";
const PROCESSING_SUFFIX = ".processing";
const HOOK_CONFIG_NAME = "contextbridge.json";
const HOOK_SCRIPT_NAME = "capture.cjs";
const HOOK_SCRIPT_SOURCE = ["hook", "contextbridge-capture.cjs"];
const PROMPT_ASKED_KEY = "contextbridge.chatCapture.promptAsked";
const DRAIN_DELAY_MS = 250;

export function copilotHomeDirectory(): string {
  return process.env.COPILOT_HOME?.trim() || path.join(os.homedir(), ".copilot");
}

function hookConfigPath(): string {
  return path.join(copilotHomeDirectory(), "hooks", HOOK_CONFIG_NAME);
}

function hookScriptPath(): string {
  return path.join(copilotHomeDirectory(), "contextbridge", HOOK_SCRIPT_NAME);
}

export function buildHookConfig(executablePath: string, scriptPath: string): string {
  const entry = {
    type: "command",
    bash: `${shellQuote(executablePath)} ${shellQuote(scriptPath)}`,
    powershell: `& ${powershellQuote(executablePath)} ${powershellQuote(scriptPath)}`,
    env: { ELECTRON_RUN_AS_NODE: "1" },
    timeoutSec: 10,
  };
  return `${JSON.stringify({ version: 1, hooks: { userPromptSubmitted: [entry] } }, null, 2)}\n`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function powershellQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function isChatCaptureInstalled(): Promise<boolean> {
  try {
    await fs.access(hookConfigPath());
    return true;
  } catch {
    return false;
  }
}

export async function installChatCaptureHook(extensionUri: vscode.Uri): Promise<void> {
  const source = vscode.Uri.joinPath(extensionUri, ...HOOK_SCRIPT_SOURCE).fsPath;
  const script = await fs.readFile(source, "utf8");
  const scriptPath = hookScriptPath();
  const configPath = hookConfigPath();

  await writeFileAtomic(scriptPath, script);
  await writeFileAtomic(configPath, buildHookConfig(process.execPath, scriptPath));
}

export async function removeChatCaptureHook(): Promise<void> {
  await fs.rm(hookConfigPath(), { force: true });
  await fs.rm(hookScriptPath(), { force: true });
  try {
    await fs.rmdir(path.dirname(hookScriptPath()));
  } catch {
    // The folder is not empty or is already gone. Leave it.
  }
}

// After a VS Code update the app path or the bundled script can change. Rewrite the hook to match.
export async function refreshInstalledHook(extensionUri: vscode.Uri): Promise<void> {
  if (await isChatCaptureInstalled()) {
    await installChatCaptureHook(extensionUri);
  }
}

async function writeFileAtomic(target: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, content, "utf8");
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

export function parseInboxLines(contents: string): ChatPrompt[] {
  const prompts: ChatPrompt[] = [];
  for (const line of contents.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    const prompt = toChatPrompt(parsed);
    if (prompt) {
      prompts.push(prompt);
    }
  }
  return prompts;
}

function toChatPrompt(value: unknown): ChatPrompt | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.text !== "string" || !record.id) {
    return undefined;
  }

  const text = redactSecrets(record.text).trim();
  if (!text) {
    return undefined;
  }

  const capturedAt = typeof record.capturedAt === "string" && !Number.isNaN(Date.parse(record.capturedAt))
    ? record.capturedAt
    : new Date().toISOString();
  return {
    id: record.id,
    sessionId: typeof record.sessionId === "string" ? record.sessionId : "unknown",
    capturedAt,
    text: text.length > MAX_PROMPT_LENGTH ? `${text.slice(0, MAX_PROMPT_LENGTH)}… [truncated]` : text,
  };
}

let drainChain: Promise<unknown> = Promise.resolve();

// Moves captured prompts from the inbox into memory.json. Calls run one after another.
export function drainInbox(folder: vscode.WorkspaceFolder): Promise<number> {
  const run = drainChain.then(() => drainInboxNow(folder));
  drainChain = run.catch(() => undefined);
  return run;
}

async function drainInboxNow(folder: vscode.WorkspaceFolder): Promise<number> {
  if (!(await memoryExists(folder))) {
    return 0;
  }

  const directory = vscode.Uri.joinPath(folder.uri, memoryDirectoryName);
  const inbox = vscode.Uri.joinPath(directory, INBOX_FILE_NAME);
  try {
    // Rename first. The hook then starts a fresh inbox file and no line is lost.
    await vscode.workspace.fs.rename(
      inbox,
      vscode.Uri.joinPath(directory, `${PROCESSING_PREFIX}${randomUUID()}${PROCESSING_SUFFIX}`),
    );
  } catch (error) {
    if (!(error instanceof vscode.FileSystemError && error.code === "FileNotFound")) {
      throw error;
    }
  }

  const entries = await vscode.workspace.fs.readDirectory(directory);
  const pending = entries
    .filter(([name, type]) => (type & vscode.FileType.File) !== 0
      && name.startsWith(PROCESSING_PREFIX) && name.endsWith(PROCESSING_SUFFIX))
    .map(([name]) => vscode.Uri.joinPath(directory, name));

  let added = 0;
  for (const file of pending) {
    const contents = new TextDecoder().decode(await vscode.workspace.fs.readFile(file));
    added += await addChatPrompts(folder, parseInboxLines(contents));
    await vscode.workspace.fs.delete(file);
  }
  return added;
}

export function registerChatCapture(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
): void {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  statusBar.command = "contextbridge.viewProjectMemory";
  context.subscriptions.push(statusBar);

  const folder = vscode.workspace.workspaceFolders?.[0];
  let timer: NodeJS.Timeout | undefined;

  const updateStatusBar = async (): Promise<void> => {
    try {
      if (!folder || !(await isChatCaptureInstalled()) || !(await memoryExists(folder))) {
        statusBar.hide();
        return;
      }

      const count = (await loadMemory(folder)).chatPrompts?.length ?? 0;
      statusBar.text = `$(comment-discussion) ContextBridge: ${count}`;
      statusBar.tooltip = `${count} Copilot chat prompt${count === 1 ? "" : "s"} saved in project memory. Click to open.`;
      statusBar.show();
    } catch {
      statusBar.hide();
    }
  };

  const drainAndUpdate = async (): Promise<void> => {
    if (!folder) {
      return;
    }

    try {
      const added = await drainInbox(folder);
      if (added > 0) {
        outputChannel.appendLine(`Saved ${added} Copilot chat prompt(s) to project memory.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Could not save captured chat prompts: ${message}`);
    }
    await updateStatusBar();
  };

  const scheduleDrain = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => void drainAndUpdate(), DRAIN_DELAY_MS);
  };
  context.subscriptions.push({ dispose: () => clearTimeout(timer) });

  if (folder) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, `${memoryDirectoryName}/${INBOX_FILE_NAME}`),
    );
    watcher.onDidCreate(scheduleDrain);
    watcher.onDidChange(scheduleDrain);
    context.subscriptions.push(watcher);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("contextbridge.enableChatCapture", async () => {
      try {
        await installChatCaptureHook(context.extensionUri);
        await drainAndUpdate();
        const hasMemory = folder ? await memoryExists(folder) : false;
        await vscode.window.showInformationMessage(
          hasMemory
            ? "ContextBridge AI: Copilot chat capture is on. New prompts are saved to project memory."
            : "ContextBridge AI: Copilot chat capture is on. Run “ContextBridge: Create Memory Snapshot” in a project to start saving its prompts.",
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`ContextBridge AI: Could not enable chat capture: ${message}`);
      }
    }),
    vscode.commands.registerCommand("contextbridge.disableChatCapture", async () => {
      try {
        await removeChatCaptureHook();
        await updateStatusBar();
        await vscode.window.showInformationMessage("ContextBridge AI: Copilot chat capture is off. Saved prompts stay in project memory.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`ContextBridge AI: Could not disable chat capture: ${message}`);
      }
    }),
  );

  void (async () => {
    try {
      await refreshInstalledHook(context.extensionUri);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Could not refresh the Copilot chat capture hook: ${message}`);
    }
    await drainAndUpdate();
    await askToEnable(context, folder);
  })();
}

async function askToEnable(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder | undefined,
): Promise<void> {
  if (!folder || context.globalState.get<boolean>(PROMPT_ASKED_KEY)
    || await isChatCaptureInstalled() || !(await memoryExists(folder))) {
    return;
  }

  await context.globalState.update(PROMPT_ASKED_KEY, true);
  const choice = await vscode.window.showInformationMessage(
    "ContextBridge AI can save your Copilot chat prompts into this project's memory. This adds a hook file in ~/.copilot/hooks. Turn it on?",
    "Turn On",
    "Not Now",
  );
  if (choice === "Turn On") {
    await vscode.commands.executeCommand("contextbridge.enableChatCapture");
  }
}
