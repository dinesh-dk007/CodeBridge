import * as vscode from "vscode";
import { MemoryExportPackage } from "../models/exportPackage";
import { validateMemoryExportPackage } from "./exportService";
import { isValidTransferCode, normalizeTransferCode } from "../utils/transferCode";

export interface BackendTransferResponse {
  success: boolean;
  transferCode?: string;
  expiresAt?: string;
  error?: string;
}

export interface BackendTransferPackageResponse {
  success: boolean;
  package?: MemoryExportPackage;
  error?: string;
}

export class BackendTransferService {
  async createTransfer(portablePackage: MemoryExportPackage): Promise<{ transferCode: string; expiresAt: string }> {
    validateMemoryExportPackage(portablePackage);

    const response = await this.request<BackendTransferResponse>("POST", "/api/transfers", portablePackage);
    const transferCode = typeof response.transferCode === "string"
      ? normalizeTransferCode(response.transferCode)
      : "";
    if (response.success !== true
      || !isValidTransferCode(transferCode)
      || typeof response.expiresAt !== "string"
      || Number.isNaN(Date.parse(response.expiresAt))) {
      throw new Error(response.error ?? "The backend did not return a valid transfer code.");
    }

    return {
      transferCode,
      expiresAt: response.expiresAt,
    };
  }

  async getTransfer(code: string): Promise<MemoryExportPackage> {
    const response = await this.request<BackendTransferPackageResponse>("GET", `/api/transfers/${encodeURIComponent(code)}`);
    if (!response.success || !response.package) {
      throw new Error(response.error ?? "The backend did not return a valid package.");
    }

    return response.package;
  }

  async consumeTransfer(code: string): Promise<void> {
    const response = await this.request<{ success: boolean; error?: string }>("DELETE", `/api/transfers/${encodeURIComponent(code)}`);
    if (!response.success) {
      throw new Error(response.error ?? "The transfer could not be consumed.");
    }
  }

  private async request<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
    const baseUrl = this.resolveBaseUrl();
    const url = `${baseUrl}${path}`;

    const headers = new Headers({
      "Content-Type": "application/json",
    });

    const requestInit: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined && method !== "GET") {
      requestInit.body = JSON.stringify(body);
    }

    let result: Response;
    try {
      result = await fetch(url, {
        ...requestInit,
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not connect to the ContextBridge backend at ${baseUrl}. Ensure the server is running. (${detail})`);
    }

    if (!result.ok) {
      const payload = await this.readJsonSafely(result);
      const error = typeof payload?.error === "string"
        ? payload.error
        : `Request failed with status ${result.status}`;
      throw new Error(error);
    }

    try {
      return await result.json() as T;
    } catch {
      throw new Error("The ContextBridge backend returned an invalid response.");
    }
  }

  private readJsonSafely(result: Response): Promise<Record<string, unknown> | null> {
    return result.text().then((text) => {
      if (!text) {
        return null;
      }

      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return null;
      }
    });
  }

  private resolveBaseUrl(): string {
    const configuredValue = vscode.workspace.getConfiguration("contextBridge").get<string>("backendUrl", "http://localhost:3000");
    const trimmed = configuredValue.trim();
    if (!trimmed) {
      throw new Error("The ContextBridge backend URL is not configured.");
    }

    try {
      const parsed = new URL(trimmed);
      if ((parsed.protocol !== "http:" && parsed.protocol !== "https:")
        || parsed.username
        || parsed.password
        || parsed.search
        || parsed.hash) {
        throw new Error("The ContextBridge backend URL must be a valid HTTP or HTTPS base URL.");
      }
      return parsed.toString().replace(/\/$/, "");
    } catch {
      throw new Error(`The ContextBridge backend URL is invalid: ${trimmed}`);
    }
  }
}
