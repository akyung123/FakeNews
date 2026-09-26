// @vitest-environment node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readSepoliaDeployment, sepoliaDeploymentDefine } from "./sepoliaDeployment";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(__dirname, "..");

describe("bundled Sepolia deployment", () => {
  /// The record is outside the Vite project, so this is the only wiring that
  /// puts the deployed addresses into a build with no VITE_* set.
  it("finds the record the deploy script writes at the repo root", () => {
    const record = readSepoliaDeployment(WEB_DIR);
    expect(record, "deployments/sepolia.json should be readable from web/").not.toBeNull();
    expect(record).toHaveProperty("launchpad");
  });

  it("gives define a JSON literal", () => {
    const literal = sepoliaDeploymentDefine(WEB_DIR);
    expect(() => JSON.parse(literal)).not.toThrow();
    expect(JSON.parse(literal)).toMatchObject({ launchpad: expect.any(String) });
  });

  it("is null rather than a throw when nothing is deployed", () => {
    expect(sepoliaDeploymentDefine("/nonexistent-dir-for-this-test")).toBe("null");
  });
});
