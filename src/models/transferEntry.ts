import { MemoryExportPackage } from "./exportPackage";

export interface TransferEntry {
  transferCode: string;
  portablePackage: MemoryExportPackage;
  createdAt: string;
  expiresAt: string;
  projectName: string;
}
