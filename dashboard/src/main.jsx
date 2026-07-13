import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import "./Auth.css";
import AuthenticatedRoot from "./components/AuthenticatedRoot.jsx";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthenticatedRoot />
  </StrictMode>
);
