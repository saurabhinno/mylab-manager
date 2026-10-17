"use client";

import {
  Box,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { CloseOutlined, DragIndicatorOutlined } from "@mui/icons-material";
import { useDragReorder } from "@/components/useDragReorder";

export type SortableReportItem = {
  id: number;
  test_name: string;
  unit: string | null;
  normal_min: number | null;
  normal_max: number | null;
};

export default function SortableParameterTable<T extends SortableReportItem>({
  items,
  results,
  onResultChange,
  onRemove,
  removeDisabled,
  onReorder,
}: {
  items: T[];
  results: Record<number, string>;
  onResultChange: (id: number, value: string) => void;
  onRemove: (item: T) => void;
  removeDisabled: boolean;
  onReorder: (next: T[]) => void;
}) {
  const drag = useDragReorder(items, onReorder);
  const canDrag = items.length > 1;

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            {canDrag && <TableCell width={36} />}
            <TableCell>Parameter</TableCell>
            <TableCell>Reference</TableCell>
            <TableCell>Result</TableCell>
            <TableCell align="right" width={56} />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, index) => {
            const val = results[item.id] ?? "";
            const num = parseFloat(val);
            let flag = "";
            if (val && !isNaN(num) && item.normal_min != null && item.normal_max != null) {
              if (num < item.normal_min) flag = "LOW";
              else if (num > item.normal_max) flag = "HIGH";
            }
            const range =
              item.normal_min != null && item.normal_max != null
                ? `${item.normal_min} – ${item.normal_max}`
                : "";
            const rowDrag = canDrag ? drag.rowProps(index) : {};
            const grip = canDrag ? drag.handleProps(index) : null;
            const dropping =
              canDrag && drag.overIndex === index && drag.dragIndex != null && drag.dragIndex !== index;

            return (
              <TableRow
                key={item.id}
                data-drag-row
                {...rowDrag}
                sx={{
                  opacity: drag.dragIndex === index ? 0.55 : 1,
                  bgcolor: dropping ? "#e8f2fb" : undefined,
                }}
              >
                {canDrag && grip && (
                  <TableCell sx={{ width: 36, px: 0.5 }}>
                    <Box
                      component="span"
                      title="Drag to reorder"
                      {...grip}
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        cursor: "grab",
                        color: "text.disabled",
                        p: 0.5,
                        borderRadius: 1,
                        "&:active": { cursor: "grabbing" },
                        "&:focus-visible": { outline: "2px solid #0f4c81" },
                      }}
                    >
                      <DragIndicatorOutlined fontSize="small" />
                    </Box>
                  </TableCell>
                )}
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {item.test_name}
                  </Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary", fontSize: 12 }}>
                  {[range, item.unit].filter(Boolean).join(" ") || "—"}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      value={val}
                      onChange={(e) => onResultChange(item.id, e.target.value)}
                      sx={{ width: 120 }}
                    />
                    {flag && (
                      <Chip
                        size="small"
                        label={flag}
                        color={flag === "HIGH" ? "error" : "warning"}
                        sx={{ height: 22, fontSize: 10 }}
                      />
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Remove parameter">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={removeDisabled}
                        onClick={() => onRemove(item)}
                        aria-label={`Remove ${item.test_name}`}
                      >
                        <CloseOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
