import React from "react";
import { Excalidraw, MainMenu, THEME } from "@excalidraw/excalidraw";
// Fonts CSS for UI font (Assistant). Drawing fonts are loaded dynamically.
import "@excalidraw/excalidraw/fonts/fonts.css";
import "../styles/excalidraw-overrides.css";

interface CanvasPaneProps {
  initialData: any;
  theme: "light" | "dark";
  onChange: (elements: any[], appState: any, files: any) => void;
  onApiReady: (api: any) => void;
}

export function CanvasPane({
  initialData,
  theme,
  onChange,
  onApiReady,
}: CanvasPaneProps) {
  return (
    <div className="canvas-pane" style={{ width: "100%", height: "100%" }}>
      <Excalidraw
        initialData={initialData}
        onChange={onChange}
        excalidrawAPI={onApiReady}
        theme={theme === "dark" ? THEME.DARK : THEME.LIGHT}
        handleKeyboardGlobally={false}
        UIOptions={{
          canvasActions: {
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: false,
          },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.ToggleTheme />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      </Excalidraw>
    </div>
  );
}
