import { ProjectMemory } from "../models/projectMemory";

const machineSpecificKeys = new Set([
  "rootpath",
  "workspacepath",
  "absolutepath",
  "machinepath",
]);
const sensitiveKeys = /(?:api.?key|password|passwd|secret|credential|private.?key|access.?token)/i;
const privateKeyBlock = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;
const sensitiveAssignment = /\b(api[_-]?key|password|passwd|secret|credential|token|access[_-]?token)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;
const commonSecretToken = /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{15,})\b/g;
const windowsAbsolutePath = /(?:[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*|\\\\[^\\\s]+\\[^\\\s]+)/g;
const unixHomePath = /(?:\/Users\/|\/home\/|\/root\/|\/private\/|\/Volumes\/|\/mnt\/)[^\s"'`,;)}\]]+/g;
const unixAbsolutePath = /(?<![:\w])\/(?!\/)(?:[^/\s"'<>|?*]+\/)*[^/\s"'<>|?*]+/g;

export function sanitizeProjectMemory(memory: ProjectMemory): Omit<ProjectMemory, "project"> & {
  project: Omit<ProjectMemory["project"], "rootPath">;
} {
  return sanitizePortableValue(memory) as Omit<ProjectMemory, "project"> & {
    project: Omit<ProjectMemory["project"], "rootPath">;
  };
}

export function sanitizePortableValue(value: unknown): unknown {
  return sanitizeValue(value);
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (key && (machineSpecificKeys.has(normalizeKey(key)) || sensitiveKeys.test(key))) {
    return undefined;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item)).filter((item) => item !== undefined);
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const sanitized = sanitizeValue(childValue, childKey);
      if (sanitized !== undefined) {
        result[childKey] = sanitized;
      }
    }
    return result;
  }

  return value;
}

function sanitizeString(value: string): string {
  return value
    .replace(privateKeyBlock, "[private key omitted]")
    .replace(sensitiveAssignment, "$1$2[REDACTED]")
    .replace(commonSecretToken, "[REDACTED]")
    .replace(windowsAbsolutePath, "[local path omitted]")
    .replace(unixHomePath, "[local path omitted]")
    .replace(unixAbsolutePath, "[local path omitted]");
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-z]/gi, "").toLowerCase();
}
