import * as vscode from "vscode";
import * as path from "node:path";
import { PackageMetadata, ProjectAnalysis } from "../models/projectAnalysis";

const ignoredDirectories = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  "venv",
  "__pycache__",
  ".venv",
  ".pytest_cache",
  ".mypy_cache",
  ".tox",
  "bower_components",
  ".turbo",
  ".cache",
  ".contextbridge",
]);

const ignoredFiles = new Set([
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
  "id_rsa",
  "id_ed25519",
  "credentials.json",
]);

const importantFileNames = new Set([
  "package.json",
  "package-lock.json",
  "readme.md",
  "requirements.txt",
  "pyproject.toml",
  "pom.xml",
  "build.gradle",
  "docker-compose.yml",
  "dockerfile",
]);

const languageByExtension: Record<string, string> = {
  ".ts": "TypeScript",
  ".js": "JavaScript",
  ".py": "Python",
  ".java": "Java",
  ".c": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".cxx": "C++",
  ".html": "HTML",
  ".css": "CSS",
  ".json": "JSON",
};

const maxPackageJsonBytes = 1024 * 1024;
const maxDepth = 30;

export class WorkspaceScanCancelledError extends Error {
  constructor() {
    super("Workspace analysis was cancelled.");
    this.name = "WorkspaceScanCancelledError";
  }
}

export interface WorkspaceScannerOptions {
  cancellationToken?: vscode.CancellationToken;
  onProgress?: (message: string) => void;
}

export async function scanWorkspace(
  folder: vscode.WorkspaceFolder,
  options: WorkspaceScannerOptions = {},
): Promise<ProjectAnalysis> {
  const entries: string[] = [];
  const languages = new Set<string>();
  const importantFiles = new Set<string>();
  const warnings: string[] = [];
  const rootUri = folder.uri;
  const rootPath = rootUri.fsPath;
  let packageMetadata: PackageMetadata | undefined;

  const visitDirectory = async (directory: vscode.Uri, depth: number): Promise<void> => {
    throwIfCancelled(options.cancellationToken);

    if (depth > maxDepth) {
      warnings.push(`Maximum scan depth reached at "${relativePath(rootUri, directory)}".`);
      return;
    }

    let children: [string, vscode.FileType][];
    try {
      children = await vscode.workspace.fs.readDirectory(directory);
    } catch (error) {
      if (isCancellation(error, options.cancellationToken)) {
        throw new WorkspaceScanCancelledError();
      }

      warnings.push(`Could not read "${relativePath(rootUri, directory)}": ${errorMessage(error)}`);
      return;
    }

    children.sort(([left], [right]) => left.localeCompare(right));

    for (const [name, type] of children) {
      throwIfCancelled(options.cancellationToken);

      if (isSensitiveFile(name) || isIgnoredSystemFile(name)) {
        continue;
      }

      const childUri = vscode.Uri.joinPath(directory, name);
      const relative = relativePath(rootUri, childUri);
      const isDirectory = (type & vscode.FileType.Directory) !== 0;
      const isSymbolicLink = (type & vscode.FileType.SymbolicLink) !== 0;

      if (isDirectory) {
        if (ignoredDirectories.has(name.toLowerCase()) || isSymbolicLink) {
          continue;
        }

        entries.push(`${relative}/`);
        options.onProgress?.(`Scanning ${relative}/`);
        await visitDirectory(childUri, depth + 1);
        continue;
      }

      if (isSymbolicLink || (type & vscode.FileType.File) === 0) {
        continue;
      }

      entries.push(relative);
      const basename = name.toLowerCase();
      if (importantFileNames.has(basename)) {
        importantFiles.add(relative);
      }

      const language = languageByExtension[path.extname(name).toLowerCase()];
      if (language) {
        languages.add(language);
      }

      if (relative === "package.json") {
        packageMetadata = await readPackageMetadata(childUri, warnings, options.cancellationToken);
      }
    }
  };

  await visitDirectory(rootUri, 0);
  entries.sort((left, right) => left.localeCompare(right));

  return {
    projectName: path.basename(rootPath),
    rootPath,
    analyzedAt: new Date().toISOString(),
    detectedLanguages: [...languages].sort((left, right) => left.localeCompare(right)),
    importantFiles: [...importantFiles].sort((left, right) => left.localeCompare(right)),
    projectStructure: entries,
    packageMetadata,
    warnings,
  };
}

async function readPackageMetadata(
  uri: vscode.Uri,
  warnings: string[],
  token?: vscode.CancellationToken,
): Promise<PackageMetadata | undefined> {
  throwIfCancelled(token);

  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.size > maxPackageJsonBytes) {
      warnings.push("Root package.json was not read because it exceeds the 1 MB metadata limit.");
      return undefined;
    }

    const contents = await vscode.workspace.fs.readFile(uri);
    throwIfCancelled(token);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(contents));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      warnings.push("Root package.json does not contain a JSON object.");
      return undefined;
    }

    const packageJson = parsed as Record<string, unknown>;
    const metadata: PackageMetadata = {};
    for (const key of ["name", "version", "description"] as const) {
      const value = packageJson[key];
      if (typeof value === "string") {
        metadata[key] = value;
      }
    }

    for (const key of ["dependencies", "devDependencies"] as const) {
      const value = packageJson[key];
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        metadata[key] = Object.keys(value);
      }
    }

    return metadata;
  } catch (error) {
    if (isCancellation(error, token)) {
      throw new WorkspaceScanCancelledError();
    }

    const detail = error instanceof SyntaxError ? "invalid JSON" : errorMessage(error);
    warnings.push(`Could not read root package.json: ${detail}`);
    return undefined;
  }
}

function isSensitiveFile(name: string): boolean {
  const normalized = name.toLowerCase();
  return normalized === ".env"
    || normalized.startsWith(".env.")
    || ignoredFiles.has(normalized);
}

function isIgnoredSystemFile(name: string): boolean {
  const normalized = name.toLowerCase();
  return ignoredFiles.has(normalized) || normalized.endsWith(".lockb");
}

function relativePath(root: vscode.Uri, child: vscode.Uri): string {
  return path.relative(root.fsPath, child.fsPath).split(path.sep).join("/");
}

function throwIfCancelled(token?: vscode.CancellationToken): void {
  if (token?.isCancellationRequested) {
    throw new WorkspaceScanCancelledError();
  }
}

function isCancellation(error: unknown, token?: vscode.CancellationToken): boolean {
  return token?.isCancellationRequested === true
    || (error instanceof Error && error.name === "Canceled");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
