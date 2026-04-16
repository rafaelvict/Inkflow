import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";

async function bootstrap() {
  // Register cloud plugin in official builds.
  // In open-source builds, this import is skipped and the app runs offline-only.
  if (import.meta.env.VITE_CLOUD_ENABLED === "true") {
    await import("./cloud/register-cloud-plugin");
  }

  const root = createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
