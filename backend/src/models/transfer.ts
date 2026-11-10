import { Model, Schema, model, models } from "mongoose";

export interface PortableContextbridgePackage {
  packageFormat: string;
  packageVersion: string;
  exportedAt: string;
  exportedBy: string;
  project: {
    name: string;
    description: string;
    languages: string[];
    importantFiles: string[];
  };
  memory: {
    architecture: {
      overview: string;
      projectStructure: string[];
      importantFiles: string[];
    };
    requirements: {
      functional: string[];
      nonFunctional: string[];
      constraints: string[];
    };
    decisions: Array<{
      id: string;
      decision: string;
      reason: string;
      alternatives: string[];
      relatedFiles: string[];
      createdAt: string;
      source: string;
      confidence: "high" | "medium" | "low";
    }>;
    developmentState: {
      completedTasks: string[];
      currentTask: string;
      pendingTasks: string[];
      knownIssues: string[];
    };
    preferences: {
      conventions: string[];
      librariesToAvoid: string[];
      additionalInstructions: string[];
    };
  };
}

export interface TransferRecord {
  code: string;
  package: PortableContextbridgePackage;
  createdAt: Date;
  expiresAt: Date;
}

const transferSchema = new Schema<TransferRecord>({
  code: { type: String, required: true, unique: true, index: true, trim: true },
  package: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

transferSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TransferModel: Model<TransferRecord> = models.Transfer
  ? models.Transfer as Model<TransferRecord>
  : model<TransferRecord>("Transfer", transferSchema);
