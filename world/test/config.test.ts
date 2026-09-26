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
  });

  test("rejects a missing required name", () => {
    expect(() => loadConfig({ ...validEnv, WORLD_APP_ID: "" })).toThrow("Missing WORLD_APP_ID");
  });
});
