import React, { useMemo, useState } from "react";
import { useArtifacts } from "./ArtifactsProvider";
import type { Artifact } from "./types";
import {
  Box,
  Chip,
  Divider,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

function collectArtifacts(node: Artifact, out: Artifact[] = []): Artifact[] {
  out.push(node);
  if (node.type === "folder")
    node.children.forEach((c) => collectArtifacts(c, out));
  return out;
}

export function ArtifactsTagsView() {
  const { root, allTags, addTag, removeTag } = useArtifacts();
  const [selectedTag, setSelectedTag] = useState<string>("");

  const all = useMemo(() => collectArtifacts(root, []), [root]);
  const items = useMemo(() => {
    const list = all.filter((a) => a.tags && a.tags.length);
    if (!selectedTag) return list;
    return list.filter((a) => a.tags!.includes(selectedTag));
  }, [all, selectedTag]);

  return (
    <Box
      sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1 }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6">Tags</Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Filter:
          </Typography>
          <Select
            size="small"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            displayEmpty
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">
              <em>All tags</em>
            </MenuItem>
            {allTags.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      </Stack>
      <Paper variant="outlined" sx={{ flex: 1, overflow: "auto" }}>
        <List dense disablePadding>
          {items.map((a) => (
            <React.Fragment key={a.id}>
              <ListItem
                sx={{
                  "& .add-tag": {
                    opacity: 0,
                    maxWidth: 0,
                    overflow: "hidden",
                    transform: "scaleX(0.96)",
                    transition:
                      "opacity 150ms ease, max-width 150ms ease, transform 150ms ease",
                  },
                  "&:hover .add-tag, &:focus-within .add-tag": {
                    opacity: 1,
                    maxWidth: 240,
                    transform: "none",
                  },
                }}
                secondaryAction={
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ maxWidth: 480, flexWrap: "wrap" }}
                  >
                    {(a.tags || []).map((t) => (
                      <Chip
                        key={t}
                        label={t}
                        size="small"
                        onDelete={() => removeTag(a.id, t)}
                      />
                    ))}
                    <Paper
                      variant="outlined"
                      className="add-tag"
                      sx={{
                        p: 0.25,
                        display: "flex",
                        alignItems: "center",
                        minWidth: 0,
                      }}
                    >
                      <InputBase
                        placeholder="Add tag"
                        sx={{ pl: 1, pr: 0.5, fontSize: 14, width: 140 }}
                        onKeyDown={(e) => {
                          const input = e.target as HTMLInputElement;
                          if (e.key === "Enter") {
                            addTag(a.id, input.value);
                            input.value = "";
                          }
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          const input =
                            (e.currentTarget.parentElement?.querySelector(
                              "input",
                            ) as HTMLInputElement) || null;
                          if (input && input.value.trim()) {
                            addTag(a.id, input.value);
                            input.value = "";
                          }
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Paper>
                  </Stack>
                }
              >
                <ListItemText primary={a.name} secondary={a.type} />
              </ListItem>
              <Divider component="li" />
            </React.Fragment>
          ))}
          {items.length === 0 && (
            <ListItem>
              <ListItemText primary="No artifacts with tags yet." />
            </ListItem>
          )}
        </List>
      </Paper>
    </Box>
  );
}

export default ArtifactsTagsView;
