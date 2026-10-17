"use client";

import { useRef, useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";
import { moveItem } from "@/lib/reorder";

export type DragRowBindings = {
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
};

export type DragHandleBindings = {
  draggable: true;
  tabIndex: 0;
  role: "button";
  "aria-label": string;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
};

/**
 * Reorder a list by dragging its grip. The grip is the only draggable node,
 * so text fields in the row stay selectable.
 * Arrow keys on the grip move the row as well.
 */
export function useDragReorder<T>(items: T[], onReorder: (next: T[]) => void) {
  const dragIndexRef = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function clearDrag() {
    dragIndexRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  }

  function rowProps(index: number): DragRowBindings {
    return {
      onDragOver: (event: DragEvent) => {
        if (dragIndexRef.current == null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOverIndex((current) => (current === index ? current : index));
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        const raw = event.dataTransfer.getData("text/plain");
        const from = dragIndexRef.current ?? (raw === "" ? null : Number(raw));
        clearDrag();
        if (from == null || !Number.isFinite(from) || from === index) return;
        onReorder(moveItem(items, from, index));
      },
    };
  }

  function handleProps(index: number): DragHandleBindings {
    return {
      draggable: true,
      tabIndex: 0,
      role: "button" as const,
      "aria-label": "Drag to reorder. Use arrow keys to move this row.",
      onDragStart: (event: DragEvent) => {
        dragIndexRef.current = index;
        setDragIndex(index);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
        const row = (event.currentTarget as HTMLElement).closest("[data-drag-row]");
        if (row instanceof HTMLElement) {
          event.dataTransfer.setDragImage(row, 24, 16);
        }
      },
      onDragEnd: () => {
        clearDrag();
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === "ArrowUp" && index > 0) {
          event.preventDefault();
          onReorder(moveItem(items, index, index - 1));
        } else if (event.key === "ArrowDown" && index < items.length - 1) {
          event.preventDefault();
          onReorder(moveItem(items, index, index + 1));
        }
      },
    };
  }

  return { rowProps, handleProps, dragIndex, overIndex };
}
