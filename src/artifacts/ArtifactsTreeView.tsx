import { useMemo, useState } from "react";
import { useArtifacts } from "./ArtifactsProvider";
import type { Artifact, ArtifactFile, ArtifactFolder } from "./types";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteIcon from "@mui/icons-material/Delete";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

function NodeRow({
  node,
  depth,
  expanded,
  toggle,
  onAddTag,
  onRemoveTag,
  selected,
  onToggleSelect,
  onDownload,
  onPreview,
  onDelete,
}: {
  node: Artifact;
  depth: number;
  expanded: (id: string) => boolean;
  toggle: (id: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  selected: (id: string) => boolean;
  onToggleSelect: (id: string) => void;
  onDownload: (node: Artifact) => void;
  onPreview: (node: ArtifactFile) => void;
  onDelete: (node: Artifact) => void;
}) {
  const [newTag, setNewTag] = useState("");
  const hasChildren = node.type === "folder" && node.children.length > 0;
  const isExpanded = expanded(node.id);
  const isSelected = selected(node.id);
  return (
    <>
      <ListItem
        disableGutters
        sx={{
          pl: depth * 2,
          "& .row-actions": {
            opacity: 0,
            maxWidth: 0,
            overflow: "hidden",
            transition: "opacity 150ms ease, max-width 150ms ease",
          },
          "&:hover .row-actions, &:focus-within .row-actions": {
            opacity: 1,
            maxWidth: 120, // Enough for 3 small icon buttons
          },
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
          <Stack direction="row" spacing={0} alignItems="center">
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ flexWrap: "wrap", maxWidth: 420, mr: 1 }}
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
            <Stack
              direction="row"
              className="row-actions"
              spacing={0.5}
              alignItems="center"
              sx={{ ml: 0.5 }}
            >
              {node.type === "file" && (
                <Tooltip title="Preview">
                  <IconButton
                    size="small"
                    onClick={() => onPreview(node as ArtifactFile)}
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Download">
                <IconButton size="small" onClick={() => onDownload(node)}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" onClick={() => onDelete(node)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        }
      >
        <Checkbox
          size="small"
          checked={isSelected}
          onChange={() => onToggleSelect(node.id)}
          sx={{ ml: 1 }}
        />
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
            selected={selected}
            onToggleSelect={onToggleSelect}
            onDownload={onDownload}
            onPreview={onPreview}
            onDelete={onDelete}
          />
        ))}
      <Divider component="li" />
    </>
  );
}

export function ArtifactsTreeView() {
  const { root, addTag, removeTag } = useArtifacts();
  const [open, setOpen] = useState<Record<string, boolean>>({ root: true });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<ArtifactFile | null>(null);

  const expanded = (id: string) => !!open[id];
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  const isSelected = (id: string) => selectedIds.has(id);
  const toggleSelect = (id: string) => {
    const getAllIds = (node: Artifact): string[] => {
      let ids = [node.id];
      if (node.type === "folder") {
        for (const child of node.children) {
          ids = ids.concat(getAllIds(child));
        }
      }
      return ids;
    };

    const getArtifactById = (node: Artifact, targetId: string): Artifact | null => {
      if (node.id === targetId) return node;
      if (node.type === "folder") {
        for (const child of node.children) {
          const found = getArtifactById(child, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const targetArtifact = getArtifactById(root, id);
    if (!targetArtifact) return;

    const idsToToggle = getAllIds(targetArtifact);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      const isCurrentlySelected = next.has(id);

      if (isCurrentlySelected) {
        idsToToggle.forEach((tid) => next.delete(tid));
      } else {
        idsToToggle.forEach((tid) => next.add(tid));
      }
      return next;
    });
  };

  const handleDownload = (node: Artifact) => {
    console.log(`Mock: Downloading ${node.type} "${node.name}" (ID: ${node.id})`);
    alert(`Mock download: ${node.name}`);
  };

  const handleDelete = (node: Artifact) => {
    console.log(`Mock: Deleting ${node.type} "${node.name}" (ID: ${node.id})`);
    alert(`Mock delete: ${node.name}`);
  };

  const handleDownloadSelected = () => {
    console.log(`Mock: Downloading selected items as ZIP:`, Array.from(selectedIds));
    alert(`Mock download selected (${selectedIds.size} items) as ZIP`);
    setSelectedIds(new Set());
  };

  const flat = useMemo(() => [root], [root]);

  return (
    <Box
      sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1 }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 1 }}
      >
        <Typography variant="h6">Artifacts Tree</Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<DownloadIcon />}
          disabled={selectedIds.size === 0}
          onClick={handleDownloadSelected}
        >
          Download Selected ({selectedIds.size})
        </Button>
      </Stack>
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
              selected={isSelected}
              onToggleSelect={toggleSelect}
              onDownload={handleDownload}
              onPreview={setPreviewFile}
              onDelete={handleDelete}
            />
          ))}
        </List>
      </Paper>

      <Dialog
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{previewFile?.name}</DialogTitle>
        <DialogContent dividers>
          {previewFile?.name.endsWith(".md") ? (
            <Box sx={{ "& pre": { p: 1, bgcolor: "grey.100", overflow: "auto" } }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {previewFile.content || ""}
              </ReactMarkdown>
            </Box>
          ) : (
            <Typography
              component="pre"
              sx={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
            >
              {previewFile?.content}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewFile(null)}>Close</Button>
          <Button
            startIcon={<DownloadIcon />}
            onClick={() => {
              if (previewFile) handleDownload(previewFile);
            }}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ArtifactsTreeView;
