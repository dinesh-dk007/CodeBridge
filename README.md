# ContextBridge AI

ContextBridge AI is a VS Code extension for creating, managing, and transferring project context between compatible development environments.

The extension helps developers preserve important project knowledge such as requirements, development decisions, current tasks, pending work, known issues, and coding preferences. This context can be exported, transferred using a code, and imported into another compatible environment.

## Features

### Project Analysis

ContextBridge AI can analyze a workspace and create a structured representation of the project context.

### Project Memory

The extension allows developers to maintain important project information, including:

- Project requirements
- Development decisions
- Current tasks
- Pending tasks
- Known issues
- Coding preferences

### Memory Snapshots

Create snapshots of the current project memory to preserve the state of a project at a particular point in time.

### Local Memory Transfer

Project memory can be exported and imported locally, allowing context to be moved between compatible installations.

### Transfer Codes

ContextBridge AI can generate transfer codes that allow project context to be retrieved and imported into another compatible environment.

### Cloud-Based Transfer

The extension supports cloud-backed transfer codes through the ContextBridge backend. Transfer packages are stored persistently in MongoDB Atlas and can be retrieved using their generated transfer code.

Transfer records are designed to expire automatically after their configured validity period.

## Available Commands

The following commands are available through the VS Code Command Palette:

- `ContextBridge: Analyze Project`
- `ContextBridge: Create Memory Snapshot`
- `ContextBridge: Export Memory`
- `ContextBridge: Import Memory`
- `ContextBridge: Generate Transfer Code`
- `ContextBridge: Import Using Transfer Code`
- `ContextBridge: Generate Cloud Transfer Code`
- `ContextBridge: Import Using Cloud Transfer Code`
- `ContextBridge: View Project Memory`
- `ContextBridge: Add Project Requirement`
- `ContextBridge: Add Development Decision`
- `ContextBridge: Update Current Task`
- `ContextBridge: Add Pending Task`
- `ContextBridge: Add Known Issue`
- `ContextBridge: Add Coding Preference`
- `ContextBridge: Refresh Project Analysis`

## Installation

### Install from a VSIX Package

1. Download or build the `.vsix` package.
2. Open Visual Studio Code.
3. Open the Extensions view.
4. Select the `...` menu in the Extensions view.
5. Choose **Install from VSIX...**.
6. Select the ContextBridge AI VSIX package.

After installation, reload VS Code if prompted.

## Development Setup

Clone the repository and install the dependencies:

```bash
npm install
```

Compile the extension:

```bash
npm run compile
```

For development with automatic recompilation:

```bash
npm run watch
```

Press `F5` in Visual Studio Code to launch an Extension Development Host.

## Backend Configuration

Cloud transfer functionality requires the ContextBridge backend to be running.

The extension uses the following configuration:

```json
{
  "contextBridge.backendUrl": "http://localhost:3000"
}
```

The backend URL can be changed through the VS Code Settings interface.

The backend requires a MongoDB connection for persistent cloud transfer storage. Configure the backend environment before starting the server.

Example:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
```

Start the backend:

```bash
cd backend
npm install
npm start
```

You can verify the backend connection by visiting:

```text
http://localhost:3000/health
```

A successful connection returns a response indicating that the database is connected.

## Packaging

Build the extension before packaging:

```bash
npm run compile
```

Create a VSIX package:

```bash
npx @vscode/vsce package
```

This generates a `.vsix` file that can be installed locally in Visual Studio Code.

## Project Structure

```text
CodeBridge/
├── src/
│   ├── commands/
│   ├── models/
│   ├── services/
│   ├── utils/
│   └── extension.ts
├── backend/
│   ├── src/
│   └── package.json
├── dist/
├── package.json
└── README.md
```

## Technology Stack

- TypeScript
- Visual Studio Code Extension API
- Node.js
- MongoDB Atlas
- MongoDB Node.js Driver

## Current Scope

ContextBridge AI currently focuses on VS Code as the first supported development environment.

The broader goal of the project is to provide a portable approach to project context and development memory that can be transferred across compatible AI-assisted development environments.

## Repository

Source code and project updates are maintained in the project repository.

## License

This project is licensed under the MIT License. See the LICENSE file for details.