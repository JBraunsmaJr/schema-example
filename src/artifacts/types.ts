export type ArtifactType = "file" | "folder";

export interface ArtifactBase {
  id: string;
  name: string;
  tags?: string[];
}

export interface ArtifactFolder extends ArtifactBase {
  type: "folder";
  children: Artifact[];
}

export interface ArtifactFile extends ArtifactBase {
  type: "file";
}

export type Artifact = ArtifactFolder | ArtifactFile;

export interface ArtifactsState {
  root: ArtifactFolder;
}

export interface ArtifactsContextValue {
  root: ArtifactFolder;
  addTag: (artifactId: string, tag: string) => void;
  removeTag: (artifactId: string, tag: string) => void;
  getById: (artifactId: string) => Artifact | undefined;
  allTags: string[];
}
