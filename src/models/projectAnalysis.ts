export interface PackageMetadata {
  name?: string;
  version?: string;
  description?: string;
  dependencies?: string[];
  devDependencies?: string[];
}

export interface ProjectAnalysis {
  projectName: string;
  rootPath: string;
  analyzedAt: string;
  detectedLanguages: string[];
  importantFiles: string[];
  projectStructure: string[];
  packageMetadata?: PackageMetadata;
  warnings: string[];
}
