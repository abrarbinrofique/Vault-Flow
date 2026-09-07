import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// Swallow the benign "ResizeObserver loop completed with undelivered notifications"
// warning that some libs (react-force-graph, CodeMirror) trigger. Chromium fires
// it as an ErrorEvent which Vite's dev overlay counts as an error badge.
const RO_MSG = "ResizeObserver loop";
window.addEventListener("error", (e) => {
  if (typeof e.message === "string" && e.message.includes(RO_MSG)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = e.reason?.message ?? String(e.reason ?? "");
  if (msg.includes(RO_MSG)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
