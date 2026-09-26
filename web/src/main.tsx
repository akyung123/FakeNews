import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { Web3Provider } from "./providers/Web3Provider";
import "./styles.css";

// Vite BASE_URL is `/` locally or `/<repo>/` on GitHub Pages. React Router matching wants no trailing slash.
function routerBasename(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

const basename = routerBasename(import.meta.env.BASE_URL);

// Wake the World server on app load so the first verification is faster.
// Fire-and-forget: failures are silently ignored.
{
  const worldUrl = (import.meta.env.VITE_WORLD_SERVER_URL || "").replace(/\/+$/, "");
  if (worldUrl) {
    void fetch(`${worldUrl}/health`).catch(() => {});
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Web3Provider>
      {import.meta.env.VITE_ROUTER === "memory" ? (
        <MemoryRouter>
          <App />
        </MemoryRouter>
      ) : (
        <BrowserRouter basename={basename}>
          <App />
        </BrowserRouter>
      )}
    </Web3Provider>
  </StrictMode>,
);
