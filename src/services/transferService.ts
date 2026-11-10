import * as vscode from "vscode";
import { MemoryExportPackage } from "../models/exportPackage";
import { TransferEntry } from "../models/transferEntry";
import { validateMemoryExportPackage } from "./exportService";
import { generateTransferCode, isValidTransferCode, normalizeTransferCode } from "../utils/transferCode";

export const TRANSFER_REGISTRY_KEY = "contextbridge.transfer.registry.v1";
export const DEFAULT_TRANSFER_TTL_MINUTES = 30;
export const DEFAULT_TRANSFER_TTL_MS = DEFAULT_TRANSFER_TTL_MINUTES * 60 * 1000;

export type TransferLookupResult =
  | { status: "valid"; entry: TransferEntry }
  | { status: "expired" }
  | { status: "not_found" };

export function createTransferService(context: vscode.ExtensionContext): TransferService {
  return new TransferService(context.globalState);
}

export class TransferService {
  constructor(private readonly storage: vscode.Memento) {}

  async generateTransferEntry(portablePackage: MemoryExportPackage): Promise<TransferEntry> {
    validateMemoryExportPackage(portablePackage);

    const registry = await this.readRegistry();
    const projectName = portablePackage.project.name.trim() || "contextbridge-project";
    let candidate = generateTransferCode();

    while (registry.some((entry) => entry.transferCode === candidate)) {
      candidate = generateTransferCode();
    }

    const createdAt = new Date().toISOString();
    const entry: TransferEntry = {
      transferCode: candidate,
      portablePackage,
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + DEFAULT_TRANSFER_TTL_MS).toISOString(),
      projectName,
    };

    await this.updateRegistry([...registry, entry]);
    return entry;
  }

  async resolveCode(code: string): Promise<TransferLookupResult> {
    const normalized = normalizeTransferCode(code);
    if (!isValidTransferCode(normalized)) {
      return { status: "not_found" };
    }

    const registry = this.storage.get<TransferEntry[]>(TRANSFER_REGISTRY_KEY, []);
    const matching = registry.filter((entry) => entry.transferCode === normalized);
    const activeEntries = matching.filter((entry) => new Date(entry.expiresAt).getTime() > Date.now());
    const expiredEntries = matching.filter((entry) => new Date(entry.expiresAt).getTime() <= Date.now());

    if (expiredEntries.length > 0) {
      await this.updateRegistry(registry.filter((entry) => !expiredEntries.some((expired) => expired.transferCode === entry.transferCode)));
      return { status: "expired" };
    }

    const activeRegistry = registry.filter((entry) => new Date(entry.expiresAt).getTime() > Date.now());
    if (activeRegistry.length !== registry.length) {
      await this.updateRegistry(activeRegistry);
    }

    if (activeEntries.length === 0) {
      return { status: "not_found" };
    }

    return { status: "valid", entry: activeEntries[0] };
  }

  async removeEntry(code: string): Promise<void> {
    const normalized = normalizeTransferCode(code);
    const registry = await this.readRegistry();
    const nextRegistry = registry.filter((entry) => entry.transferCode !== normalized);
    await this.updateRegistry(nextRegistry);
  }

  async readRegistry(): Promise<TransferEntry[]> {
    const registry = this.storage.get<TransferEntry[]>(TRANSFER_REGISTRY_KEY, []);
    const now = Date.now();
    const activeRegistry = registry.filter((entry) => new Date(entry.expiresAt).getTime() > now);
    if (activeRegistry.length !== registry.length) {
      await this.updateRegistry(activeRegistry);
    }
    return activeRegistry;
  }

  private async updateRegistry(entries: TransferEntry[]): Promise<void> {
    await this.storage.update(TRANSFER_REGISTRY_KEY, entries);
  }
}
