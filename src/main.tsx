import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { APP_VERSION_LABEL } from "./version";
import "./index.css";

document.title = `Aisle ${APP_VERSION_LABEL}`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
