import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The deploy script writes the Sepolia record at the repo root, outside this
 * Vite project, so `import.meta.glob` cannot reach it. `vite.config.ts` reads it
 * through here and bundles it as `__SEPOLIA_DEPLOYMENT__`, which is what lets a
 * demo build know the deployed addresses with no VITE_* variables set.
 *
 * Node only: never import this from application code.
 */
export const DEPLOYMENT_CANDIDATES = [
  "../deployments/sepolia.json",
  "../contracts/deployments/sepolia.json",
] as const;

export function readSepoliaDeployment(fromDir: string): Record<string, unknown> | null {
  for (const candidate of DEPLOYMENT_CANDIDATES) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(resolve(fromDir, candidate), "utf8"));
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      // not deployed yet, or not readable: try the next candidate
    }
  }
  return null;
}

/** What `define` needs: a JSON literal, or `null` when nothing is deployed. */
export function sepoliaDeploymentDefine(fromDir: string): string {
  return JSON.stringify(readSepoliaDeployment(fromDir));
}
