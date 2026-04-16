import React, { useRef, useCallback } from "react";
import "../styles/tabbar.css";

export interface TabInfo {
  id: string;
  title: string;
  dirty: boolean;
}

interface TabBarProps {
  tabs: TabInfo[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  children?: React.ReactNode;
}

export function TabBar({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onNew,
  onReorder,
  children,
}: TabBarProps) {
  const dragIndexRef = useRef<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      dragIndexRef.current = index;
      e.dataTransfer.effectAllowed = "move";
      // Minimal drag image
      const el = e.currentTarget as HTMLElement;
      e.dataTransfer.setDragImage(el, 40, 15);
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      const fromIndex = dragIndexRef.current;
      if (fromIndex !== null && fromIndex !== toIndex) {
        onReorder(fromIndex, toIndex);
      }
      dragIndexRef.current = null;
    },
    [onReorder],
  );

  return (
    <div
      className="tabbar"
      onDoubleClick={(e) => {
        // Double-click on empty space creates new note
        if ((e.target as HTMLElement).classList.contains("tabbar")) {
          onNew();
        }
      }}
    >
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? "active" : ""}`}
          onClick={() => onSelect(tab.id)}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
        >
          <span className="tab-title">{tab.title || "Sem título"}</span>
          {tab.dirty && <span className="tab-dirty" />}
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
            title="Fechar aba"
          >
            ×
          </button>
        </div>
      ))}
      <button className="tab-new" onClick={onNew} title="Nova nota (Ctrl+N)">
        +
      </button>
      {children}
    </div>
  );
}
