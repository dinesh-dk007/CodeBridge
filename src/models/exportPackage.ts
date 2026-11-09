import { ProjectDecision } from "./projectMemory";

export const MEMORY_EXPORT_PACKAGE_FORMAT = "contextbridge-memory";
export const MEMORY_EXPORT_PACKAGE_VERSION = "1.0.0";

export interface PortableProjectMemory {
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
}

export interface MemoryExportPackage {
  packageFormat: typeof MEMORY_EXPORT_PACKAGE_FORMAT;
  packageVersion: typeof MEMORY_EXPORT_PACKAGE_VERSION;
  exportedAt: string;
  exportedBy: "ContextBridge AI";
  project: {
    name: string;
    description: string;
    languages: string[];
    importantFiles: string[];
  };
  memory: PortableProjectMemory;
}
