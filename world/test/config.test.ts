import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config.ts";
import { TEST_RP_KEY, TEST_SIGNER_KEY } from "./helpers.ts";

const validEnv = {
  WORLD_APP_ID: "app_test_prophecy",
  WORLD_ACTION: "register-prophet",
  WORLD_RP_ID: "rp_test_prophecy",
  WORLD_RP_SIGNING_KEY: TEST_RP_KEY,
  WORLD_SIGNER_KEY: TEST_SIGNER_KEY,
};

describe("loadConfig", () => {
  test("reads names from env only", () => {
    const config = loadConfig({ ...validEnv, WORLD_ENVIRONMENT: "staging", PORT: "8788" });
    expect(config.appId).toBe("app_test_prophecy");
    expect(config.action).toBe("register-prophet");
    expect(config.rpId).toBe("rp_test_prophecy");
    expect(config.environment).toBe("staging");
    expect(config.portalBaseUrl).toBe("https://staging-developer.worldcoin.org");
    expect(config.port).toBe(8788);
    expect(config.chainId).toBeUndefined();
    expect(config.launchpad).toBeUndefined();
  });

  test("reads optional WORLD_CHAIN_ID and WORLD_LAUNCHPAD_ADDRESS", () => {
    const config = loadConfig({
      ...validEnv,
      WORLD_CHAIN_ID: "11155111",
      WORLD_LAUNCHPAD_ADDRESS: "0x1111111111111111111111111111111111111111",
    });
    expect(config.chainId).toBe(11155111n);
    expect(config.launchpad).toBe("0x1111111111111111111111111111111111111111");
  });

  test("rejects a missing required name", () => {
    expect(() => loadConfig({ ...validEnv, WORLD_APP_ID: "" })).toThrow("Missing WORLD_APP_ID");
  });

  test("rejects invalid optional context names", () => {
    expect(() => loadConfig({ ...validEnv, WORLD_CHAIN_ID: "0" })).toThrow(
      "WORLD_CHAIN_ID must be a positive integer",
    );
    expect(() => loadConfig({ ...validEnv, WORLD_LAUNCHPAD_ADDRESS: "0x1234" })).toThrow(
      "WORLD_LAUNCHPAD_ADDRESS must be a 20-byte hex address",
    );
  });
});
