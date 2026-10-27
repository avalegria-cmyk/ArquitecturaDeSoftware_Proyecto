import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./presentation/App.jsx";
import { api } from "./infrastructure/api.js";
import "./presentation/styles.css";
const demo = import.meta.env.VITE_DEMO_MODE === "true";
const service = demo ? (await import("./infrastructure/demo.js")).demoApi : api;
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App api={service} demo={demo} />
  </React.StrictMode>,
);
