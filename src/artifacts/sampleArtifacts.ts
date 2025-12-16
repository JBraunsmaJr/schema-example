import type { ArtifactFolder } from "./types";

export const sampleArtifacts: ArtifactFolder = {
  id: "root",
  name: "Artifacts",
  type: "folder",
  tags: [],
  children: [
    {
      id: "fld-1",
      name: "documents",
      type: "folder",
      tags: ["shared"],
      children: [
        { id: "file-1", name: "spec.md", type: "file", tags: ["draft"] },
        { id: "file-2", name: "readme.txt", type: "file", tags: ["public"] },
      ],
    },
    {
      id: "fld-2",
      name: "images",
      type: "folder",
      tags: [],
      children: [
        { id: "file-3", name: "logo.png", type: "file", tags: ["brand"] },
        { id: "file-4", name: "diagram.svg", type: "file", tags: [] },
      ],
    },
  ],
};
