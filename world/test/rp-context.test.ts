import { describe, expect, test } from "bun:test";
import { computeRpSignatureMessage } from "@worldcoin/idkit-core/signing";
import { bytesToHex, hexToBytes, recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createRpContext } from "../src/rp-context.ts";
import { TEST_RP_KEY, testConfig } from "./helpers.ts";

describe("IDKit 4 rp-context", () => {
  test("matches the official compute_rp_signature_message vectors", () => {
    const nonce = hexToBytes("0x008ae1aa597fa146ebd3aa2ceddf360668dea5e526567e92b0321816a4e895bd");

    expect(bytesToHex(computeRpSignatureMessage(nonce, 1700000000, 1700000300))).toBe(
      "0x01008ae1aa597fa146ebd3aa2ceddf360668dea5e526567e92b0321816a4e895bd000000006553f100000000006553f22c",
    );

    expect(
      bytesToHex(computeRpSignatureMessage(nonce, 1700000000, 1700000300, "test-action")),
    ).toBe(
      "0x01008ae1aa597fa146ebd3aa2ceddf360668dea5e526567e92b0321816a4e895bd000000006553f100000000006553f22c00aa0ce59768ae5b1c52f07a9387f14f09f277422c0d2f8a268c7bad0c60a46a",
    );
  });

  test("returns the RpContext fields IDKit 4 needs", async () => {
    const config = testConfig();
    const body = createRpContext(config);

    expect(body.app_id).toBe(config.appId);
    expect(body.action).toBe(config.action);
    expect(body.environment).toBe(config.environment);
    expect(body.rp_context.rp_id).toBe(config.rpId);
    expect(body.rp_context.nonce).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(body.rp_context.signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
    expect(body.rp_context.expires_at - body.rp_context.created_at).toBe(300);

    const recovered = await recoverMessageAddress({
      message: {
        raw: computeRpSignatureMessage(
          hexToBytes(body.rp_context.nonce as `0x${string}`),
          body.rp_context.created_at,
          body.rp_context.expires_at,
          config.action,
        ),
      },
      signature: body.rp_context.signature as `0x${string}`,
    });
    expect(recovered).toBe(privateKeyToAccount(TEST_RP_KEY).address);
  });
});
