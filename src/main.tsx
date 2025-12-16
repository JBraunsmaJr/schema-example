import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ArtifactsProvider } from "./artifacts/ArtifactsProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ArtifactsProvider>
      <App />
    </ArtifactsProvider>
  </StrictMode>,
);
