# ContextBridge AI

ContextBridge AI is a VS Code extension project exploring portable, user-approved project context for AI-assisted software development. It is designed to work through accessible project information and user-provided context; it does not access private AI chat histories or hidden assistant memory.

## Milestones 2–4: Scanner and local project memory

The **ContextBridge: Analyze Project** command scans the first open workspace folder and reports project name, root path, analysis time, file structure, detected languages, important files, and safe root `package.json` metadata. Results appear in the `ContextBridge AI` Output Channel.

The scanner skips common generated/vendor directories, sensitive files (including `.env*`, `id_rsa`, `id_ed25519`, and `credentials.json`), and symbolic links. It reads only root `package.json` content, and extracts only name, version, description, and dependency names. All other project files are listed but not read. Project analysis itself stays local. Backend transfer commands send only a sanitized portable memory package to the configured backend.

**ContextBridge: Create Memory Snapshot** reuses the scanner and stores a version `1.0.0` structured JSON snapshot at `.contextbridge/memory.json`. It initializes requirements, decisions, development state, and preferences as empty values rather than inferring them. If a snapshot already exists, the extension asks before replacing it. The `.contextbridge` directory is created only during snapshot creation, not during analysis.

**ContextBridge: View Project Memory** opens the local `memory.json` file in the editor or explains how to create a snapshot if none exists.

The local memory management commands let developers add requirements, decisions, tasks, issues, and coding preferences. **Refresh Project Analysis** updates scanner-derived project fields while preserving requirements, decisions, development state, and preferences. Update commands require an existing valid memory file; they do not create one automatically.

## Requirements

- Visual Studio Code
- Node.js and npm

## Set up the project

Open this folder in VS Code. In the integrated terminal, install the development dependencies:

```powershell
npm install
```

Compile the extension:

```powershell
npm run compile
```

Successful compilation creates `dist/extension.js`, which is the extension entry point configured in `package.json`.

## Run the extension

1. Open this project folder in VS Code.
2. Press **F5**. VS Code compiles the TypeScript and opens a second window called the Extension Development Host.
3. In that second window, press **Ctrl+Shift+P** to open the Command Palette.
4. Search for `ContextBridge: Analyze Project` and run it to inspect the workspace analysis.
5. To create local structured memory, run `ContextBridge: Create Memory Snapshot`.
6. To view the JSON file, run `ContextBridge: View Project Memory`.

The registered commands are:

- ContextBridge: Analyze Project
- ContextBridge: Create Memory Snapshot
- ContextBridge: Export Memory
- ContextBridge: Import Memory
- ContextBridge: Generate Transfer Code
- ContextBridge: Import Using Transfer Code
- ContextBridge: Generate Cloud Transfer Code
- ContextBridge: Import Using Cloud Transfer Code
- ContextBridge: View Project Memory
- ContextBridge: Add Project Requirement
- ContextBridge: Add Development Decision
- ContextBridge: Update Current Task
- ContextBridge: Add Pending Task
- ContextBridge: Add Known Issue
- ContextBridge: Add Coding Preference
- ContextBridge: Refresh Project Analysis

Analyze Project, Create Memory Snapshot, View Project Memory, the seven local memory management commands, local Memory Export, local Memory Import, the local prototype transfer-code workflow, and the local backend transfer workflow are implemented. AI integrations are not implemented.

## Transfer types

- Local Transfer Codes (Milestone 7): Stored in VS Code global state, usable only on the same machine.
- Backend Transfer Codes (Milestone 8A): Sent to the local Express API.
- Persistent backend storage (Milestone 8B): Transfer records are stored in MongoDB and survive backend restarts. Records expire after 30 minutes; MongoDB TTL cleanup is asynchronous, and the API also checks expiration on retrieval.

To run the backend, open a terminal in `backend`, run `npm install`, copy `.env.example` to `.env`, set `MONGODB_URI`, then run `npm run compile` and `npm start`. The extension's `contextBridge.backendUrl` setting defaults to `http://localhost:3000`. MongoDB provides persistence, but the service is still intended for local use and is not cloud deployment.

**ContextBridge: Import Memory** accepts version `1.0.0` `.contextbridge.json` packages. It scans the current workspace and keeps its project identity and structure, while bringing in portable architecture overview, requirements, decisions, development state, and preferences. If local memory exists, the user chooses merge, replace, or cancel. Merge deduplicates lists, asks about conflicting non-empty current tasks, and prefers the current architecture overview. Import never restores an old workspace path and does not transmit data.

## Development

- `npm run compile` builds the extension once.
- `npm run watch` recompiles TypeScript when source files change.
- `src/extension.ts` is the extension activation entry point.
- `.vscode/launch.json` configures the Extension Development Host launched by F5.
- `.vscode/tasks.json` tells VS Code to compile before launching the extension.

## Scanner limitations

- The scanner analyzes the first folder of a multi-root workspace.
- Only the root-level `package.json` is parsed; package files in nested folders are identified but not read.
- Scanning stops at 30 directory levels to avoid unbounded recursion.
- Language detection is based on file extensions and is not a full source-code parser.
- Filesystem permission or transient file errors are reported as warnings and do not stop the rest of the scan.

## Memory snapshot limitations

- The snapshot is generated deterministically from the scanner and the root `package.json` description; it does not infer requirements, decisions, tasks, or coding preferences.
- Memory is local to the workspace and is not encrypted. Treat workspace storage according to the sensitivity of the project.
- Creating another snapshot requires explicit confirmation before replacing the current `memory.json`.
- Memory updates support schema version `1.0.0`; invalid or unsupported JSON is reported and left unchanged.
- Optional alternatives and related file inputs for decisions are entered as comma-separated values.
- Memory export writes a versioned `.contextbridge.json` package to a user-selected location. It excludes workspace path fields and redacts common credential patterns, but heuristic redaction cannot guarantee detection of every secret.
- Exported project context does not include hidden AI memory or private conversations from other development tools.
- Memory import supports only package version `1.0.0` and limits selected package files to 10 MB.
- Imported context is sanitized for common absolute-path and credential patterns; heuristic filtering cannot guarantee detection of every secret.
