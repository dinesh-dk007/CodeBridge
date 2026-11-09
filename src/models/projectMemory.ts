export const PROJECT_MEMORY_SCHEMA_VERSION = "1.0.0";

export type DecisionConfidence = "high" | "medium" | "low";

export interface ProjectDecision {
  id: string;
  decision: string;
  reason: string;
  alternatives: string[];
  relatedFiles: string[];
  createdAt: string;
  source: string;
  confidence: DecisionConfidence;
}

export interface ProjectMemory {
  schemaVersion: string;
  project: {
    name: string;
    description: string;
    rootPath: string;
    languages: string[];
    importantFiles: string[];
  };
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
  decisions: ProjectDecision[];
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
  metadata: {
    createdAt: string;
    updatedAt: string;
    source: string;
    lastImportedAt?: string;
    importSource?: string;
  };
}
