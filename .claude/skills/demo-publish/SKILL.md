---
name: demo-publish
description: Build the web app and republish the demo page. Use after a web change that should be visible in the shared demo.
---

# Publish the demo

1. `cd web && bun install && bun run build`. It must pass (`tsc --noEmit` runs first).
2. **Single-file preview** (no hosting)
   - Build with `VITE_ROUTER=memory bun run build`, which uses a memory router so the page works as one file.
   - Inline `dist/assets/*.css` and `*.js` into `dist/index.html`.
   - Publish that file to the same artifact URL as before, so the link does not change.
3. **Hosted demo**
   - Deploy `web/dist` to the static host.
   - Set `VITE_*` variables in the host, never in the repo.
4. **Smoke test** with a browser (Playwright if available)
   - The home page loads.
   - A prophecy opens by name.
   - Buy and sell update the price.
   - Nothing on screen is hardcoded that should come from ENS.
5. Put the demo URL in the PR description.
