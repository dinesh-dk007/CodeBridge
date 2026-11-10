import { MongoServerError } from "mongodb";
import { PortableContextbridgePackage, TransferModel, TransferRecord } from "../models/transfer";
import { generateTransferCode, normalizeTransferCode } from "../utils/transferCode";

export const DEFAULT_TRANSFER_TTL_MS = 30 * 60 * 1000;
const MAX_CODE_GENERATION_ATTEMPTS = 5;

export interface TransferLookupResult {
  transfer?: Pick<TransferRecord, "code" | "package" | "createdAt" | "expiresAt">;
  expired: boolean;
}

export async function createTransfer(packageData: PortableContextbridgePackage): Promise<TransferRecord> {
  await cleanExpiredTransfers();

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const createdAt = new Date();
    const record = {
      code: generateTransferCode([]),
      package: packageData,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + DEFAULT_TRANSFER_TTL_MS),
    };

    try {
      return await TransferModel.create(record);
    } catch (error) {
      if (isDuplicateCodeError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Could not generate a unique transfer code. Please try again.");
}

export async function getTransfer(code: string): Promise<TransferLookupResult> {
  const normalized = normalizeTransferCode(code);
  const transfer = await TransferModel.findOne({ code: normalized })
    .select({ _id: 0, __v: 0 })
    .lean()
    .exec();

  if (!transfer) {
    return { expired: false };
  }

  if (transfer.expiresAt.getTime() <= Date.now()) {
    await TransferModel.deleteOne({ code: normalized }).exec();
    return { expired: true };
  }

  return { transfer, expired: false };
}

export async function deleteTransfer(code: string): Promise<boolean> {
  const normalized = normalizeTransferCode(code);
  const result = await TransferModel.deleteOne({ code: normalized }).exec();
  return result.deletedCount > 0;
}

export async function cleanExpiredTransfers(): Promise<void> {
  await TransferModel.deleteMany({ expiresAt: { $lte: new Date() } }).exec();
}

function isDuplicateCodeError(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === 11000;
}
