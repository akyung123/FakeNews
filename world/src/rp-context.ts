import { signRequest } from "@worldcoin/idkit-core/signing";
import type { Config } from "./config.ts";

export type RpContext = {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
};

export type RpContextResponse = {
  app_id: string;
  action: string;
  environment: "production" | "staging";
  rp_context: RpContext;
};

export function createRpContext(config: Config): RpContextResponse {
  const signed = signRequest({
    signingKeyHex: config.rpSigningKey,
    action: config.action,
  });

  return {
    app_id: config.appId,
    action: config.action,
    environment: config.environment,
    rp_context: {
      rp_id: config.rpId,
      nonce: signed.nonce,
      created_at: signed.createdAt,
      expires_at: signed.expiresAt,
      signature: signed.sig,
    },
  };
}
