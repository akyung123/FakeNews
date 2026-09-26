/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_FACTORY_ADDRESS: string;
  readonly VITE_ROUTER?: string;
}
