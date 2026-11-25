"use strict";
// ContextBridge AI: Copilot "userPromptSubmitted" hook.
// Appends each chat prompt to .contextbridge/inbox.jsonl of the project that has a memory.json.
// The ContextBridge extension moves the inbox lines into memory.json.
// This script never blocks or fails the chat: it always prints {} and exits with code 0.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_INPUT_CHARS = 2_000_000;
const MAX_PROMPT_CHARS = 20_000;
const MEMORY_RELATIVE = path.join(".contextbridge", "memory.json");
const INBOX_RELATIVE = path.join(".contextbridge", "inbox.jsonl");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  if (input.length < MAX_INPUT_CHARS) {
    input += chunk;
  }
});
process.stdin.on("error", finish);
process.stdin.on("end", () => {
  try {
    capture(input);
  } catch {
    // Capture is best effort. A failure must never reach the chat.
  }
  finish();
});

function finish() {
  process.stdout.write("{}\n");
}

function capture(raw) {
  const event = JSON.parse(raw);
  const prompt = event.prompt;
  if (typeof prompt !== "string" || prompt.trim() === "") {
    return;
  }

  const sessionId = String(event.sessionId ?? event.session_id ?? "unknown");
  const timestamp = event.timestamp;
  const capturedAt = Number.isNaN(new Date(timestamp).getTime()) ? new Date() : new Date(timestamp);
  const root = findProjectRoot(typeof event.cwd === "string" ? event.cwd : process.cwd());
  if (!root) {
    return;
  }

  const text = prompt.length > MAX_PROMPT_CHARS ? prompt.slice(0, MAX_PROMPT_CHARS) : prompt;
  const id = crypto.createHash("sha256").update(`${sessionId}\n${String(timestamp)}\n${prompt}`).digest("hex").slice(0, 32);
  const line = `${JSON.stringify({ id, sessionId, capturedAt: capturedAt.toISOString(), text })}\n`;
  fs.appendFileSync(path.join(root, INBOX_RELATIVE), line, { encoding: "utf8", mode: 0o600 });
}

function findProjectRoot(start) {
  let current = path.resolve(start);
  for (;;) {
    if (isFile(path.join(current, MEMORY_RELATIVE))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function isFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}
