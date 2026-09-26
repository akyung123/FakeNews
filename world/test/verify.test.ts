import { describe, expect, test } from "bun:test";
import { recoverRegisterSigner } from "../src/sign.ts";
import { HttpError } from "../src/errors.ts";
import { createPortalClient, type PortalClient } from "../src/portal.ts";
import { parseVerifyRequest } from "../src/parse.ts";
import { verifyAndSign } from "../src/verify.ts";
import {
  FIXTURE_LAUNCHPAD,
  FIXTURE_NULLIFIER,
  FIXTURE_WALLET,
  SEPOLIA_CHAIN_ID,
  TEST_SIGNER_ADDRESS,
  testConfig,
  uniquenessProof,
  verifyBody,
} from "./helpers.ts";

function okPortal(nullifier = FIXTURE_NULLIFIER): PortalClient {
  return {
    async verify() {
      return {
        success: true,
        action: "register-prophet",
        nullifier,
        environment: "staging",
        results: [{ identifier: "proof_of_human", success: true, nullifier }],
      };
    },
  };
}

describe("verifyAndSign", () => {
  test("valid proof: mocks Portal, signs INTERFACE section 3 payload", async () => {
    const config = testConfig();
    const result = await verifyAndSign(config, verifyBody(), okPortal());

    expect(result.nullifier).toBe(FIXTURE_NULLIFIER);
    expect(result.serverSig).toMatch(/^0x[0-9a-fA-F]{130}$/);

    const recovered = await recoverRegisterSigner(
      {
        chainId: SEPOLIA_CHAIN_ID,
        launchpad: FIXTURE_LAUNCHPAD,
        wallet: FIXTURE_WALLET,
        nullifier: BigInt(FIXTURE_NULLIFIER),
      },
      result.serverSig,
    );
    expect(recovered).toBe(TEST_SIGNER_ADDRESS);
  });

  test("Portal failure is rejected", async () => {
    const portal: PortalClient = {
      async verify() {
        throw new HttpError(400, "portal_rejected", "All proof verifications failed.");
      },
    };

    try {
      await verifyAndSign(testConfig(), verifyBody(), portal);
      throw new Error("expected portal_rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe("portal_rejected");
    }
  });

  test("Portal HTTP error is rejected", async () => {
    const portalFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          code: "all_verifications_failed",
          detail: "All proof verifications failed.",
        }),
        { status: 400 },
      );

    try {
      await verifyAndSign(
        testConfig(),
        verifyBody(),
        createPortalClient(testConfig(), portalFetch),
      );
      throw new Error("expected portal_rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe("portal_rejected");
      expect((error as HttpError).message).toBe("All proof verifications failed.");
    }
  });

  test("pinned context: matching chainId and launchpad still signs", async () => {
    const config = testConfig({
      chainId: SEPOLIA_CHAIN_ID,
      launchpad: "0x1111111111111111111111111111111111111111",
    });
    const result = await verifyAndSign(
      config,
      verifyBody({ launchpad: "0x1111111111111111111111111111111111111111" }),
      okPortal(),
    );
    expect(result.nullifier).toBe(FIXTURE_NULLIFIER);
  });

  test("pinned context: launchpad match is case-insensitive", async () => {
    const config = testConfig({
      launchpad: "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa",
    });
    const result = await verifyAndSign(
      config,
      verifyBody({ launchpad: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
      okPortal(),
    );
    expect(result.nullifier).toBe(FIXTURE_NULLIFIER);
  });

  test("pinned chainId mismatch is context_mismatch and skips Portal", async () => {
    let called = false;
    const portal: PortalClient = {
      async verify() {
        called = true;
        return { success: true, nullifier: FIXTURE_NULLIFIER };
      },
    };

    try {
      await verifyAndSign(testConfig({ chainId: 1n }), verifyBody(), portal);
      throw new Error("expected context_mismatch");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe("context_mismatch");
    }
    expect(called).toBe(false);
  });

  test("pinned launchpad mismatch is context_mismatch and skips Portal", async () => {
    let called = false;
    const portal: PortalClient = {
      async verify() {
        called = true;
        return { success: true, nullifier: FIXTURE_NULLIFIER };
      },
    };

    try {
      await verifyAndSign(
        testConfig({ launchpad: "0x3333333333333333333333333333333333333333" }),
        verifyBody(),
        portal,
      );
      throw new Error("expected context_mismatch");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe("context_mismatch");
    }
    expect(called).toBe(false);
  });

  test("malformed payload is rejected", () => {
    const cases: unknown[] = [
      null,
      {},
      { wallet: FIXTURE_WALLET, chainId: 11155111, launchpad: FIXTURE_LAUNCHPAD },
      { ...verifyBody(), wallet: "not-an-address" },
      { ...verifyBody(), launchpad: "0x1234" },
      { ...verifyBody(), chainId: 0 },
      { ...verifyBody(), idkitResponse: { protocol_version: "4.0", responses: [] } },
      {
        ...verifyBody(),
        idkitResponse: uniquenessProof({ action: "some-other-action" }),
      },
      {
        ...verifyBody(),
        idkitResponse: {
          protocol_version: "4.0",
          nonce: "0x1",
          session_id: "session_abc",
          responses: [{ identifier: "proof_of_human" }],
        },
      },
    ];

    for (const body of cases) {
      expect(() => parseVerifyRequest(body, "register-prophet")).toThrow(HttpError);
    }
  });
});
