import { loadConfig, signerAddress } from "./config.ts";
import { createHandler } from "./http.ts";

const config = loadConfig();
const handler = createHandler(config);

Bun.serve({
  port: config.port,
  hostname: "0.0.0.0",
  fetch: handler,
});

console.log(`prophecy-world listening on :${config.port}`);
console.log(`signer ${signerAddress(config)}`);
