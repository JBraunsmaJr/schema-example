import React, { useMemo, useState } from "react";
import { useArtifacts } from "./ArtifactsProvider";
import type { Artifact, ArtifactFolder } from "./types";
import {
  Box,
  Chip,
  Divider,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DescriptionIcon from "@mui/icons-material/Description";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";

function NodeRow({
  node,
  depth,
  expanded,
  toggle,
  onAddTag,
  onRemoveTag,
}: {
  node: Artifact;
  depth: number;
  expanded: (id: string) => boolean;
  toggle: (id: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
}) {
  const [newTag, setNewTag] = useState("");
  const hasChildren = node.type === "folder" && node.children.length > 0;
  const isExpanded = expanded(node.id);
  return (
    <>
      <ListItem
        disableGutters
        sx={{
          pl: depth * 2,
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
            maxWidth: 260,
            transform: "none",
          },
        }}
        secondaryAction={
          <Stack direction="row" spacing={1} alignItems="center">
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ flexWrap: "wrap", maxWidth: 420 }}
            >
              {(node.tags || []).map((t) => (
                <Chip
                  key={t}
                  label={t}
                  size="small"
                  onDelete={() => onRemoveTag(node.id, t)}
                />
              ))}
            </Stack>
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
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onAddTag(node.id, newTag);
                    setNewTag("");
                  }
                }}
                sx={{ pl: 1, pr: 0.5, fontSize: 14, width: 140 }}
              />
              <Tooltip title="Add tag">
                <IconButton
                  size="small"
                  onClick={() => {
                    onAddTag(node.id, newTag);
                    setNewTag("");
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Paper>
          </Stack>
        }
      >
        <ListItemButton
          onClick={() => (hasChildren ? toggle(node.id) : undefined)}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            {node.type === "folder" ? (
              isExpanded ? (
                <FolderOpenIcon />
              ) : (
                <FolderIcon />
              )
            ) : (
              <DescriptionIcon />
            )}
          </ListItemIcon>
          <ListItemText
            primary={
              <Stack direction="row" alignItems="center" spacing={1}>
                {node.type === "folder" &&
                  (isExpanded ? (
                    <ExpandMoreIcon fontSize="small" />
                  ) : (
                    <ChevronRightIcon fontSize="small" />
                  ))}
                <Typography variant="body1">{node.name}</Typography>
              </Stack>
            }
          />
        </ListItemButton>
      </ListItem>
      {hasChildren &&
        isExpanded &&
        (node as ArtifactFolder).children.map((c) => (
          <NodeRow
            key={c.id}
            node={c}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
          />
        ))}
      <Divider component="li" />
    </>
  );
}

export function ArtifactsTreeView() {
  const { root, addTag, removeTag } = useArtifacts();
  const [open, setOpen] = useState<Record<string, boolean>>({ root: true });
  const expanded = (id: string) => !!open[id];
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  const flat = useMemo(() => [root], [root]);

  return (
    <Box
      sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1 }}
    >
      <Typography variant="h6">Artifacts Tree</Typography>
      <Paper variant="outlined" sx={{ flex: 1, overflow: "auto" }}>
        <List dense disablePadding>
          {flat.map((n) => (
            <NodeRow
              key={n.id}
              node={n}
              depth={0}
              expanded={expanded}
              toggle={toggle}
              onAddTag={addTag}
              onRemoveTag={removeTag}
            />
          ))}
        </List>
      </Paper>
    </Box>
  );
}

export default ArtifactsTreeView;
