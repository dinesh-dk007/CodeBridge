# Extension packaging notes

## Build a local VSIX

From the repository root, run:

```powershell
npm run compile
npx @vscode/vsce package
```

The `vscode:prepublish` script runs the TypeScript compiler before VSIX creation. The `.vscodeignore` file excludes development-only sources and the standalone backend while leaving `dist/` in the package as the extension runtime.

## Icon

No extension icon currently exists. When one is designed, place a 128 × 128 PNG at `images/icon.png` and set `"icon": "images/icon.png"` in the root `package.json`.

## Repository and license

The manifest repository URL is taken from the configured Git remote. No license file is currently present; add the project’s chosen license before marketplace distribution and configure its identifier in `package.json`.
