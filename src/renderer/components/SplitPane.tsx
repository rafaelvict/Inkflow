import React, { useRef, useCallback, useState } from "react";
import "../styles/splitpane.css";

type ViewMode = "split" | "text-only" | "canvas-only";

interface SplitPaneProps {
  mode: ViewMode;
  left: React.ReactNode;
  right: React.ReactNode;
  initialRatio?: number;
}

export function SplitPane({
  mode,
  left,
  right,
  initialRatio = 0.4,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(initialRatio);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = Math.min(
        0.8,
        Math.max(0.2, (e.clientX - rect.left) / rect.width),
      );
      setRatio(newRatio);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  if (mode === "text-only") {
    return <div className="splitpane-single">{left}</div>;
  }
  if (mode === "canvas-only") {
    return <div className="splitpane-single">{right}</div>;
  }

  return (
    <div className="splitpane" ref={containerRef}>
      <div className="splitpane-left" style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>
      <div className="splitpane-divider" onMouseDown={onMouseDown} />
      <div
        className="splitpane-right"
        style={{ width: `${(1 - ratio) * 100}%` }}
      >
        {right}
      </div>
    </div>
  );
}
