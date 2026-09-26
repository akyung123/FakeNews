/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_LAUNCHPAD_ADDRESS?: string;
  readonly VITE_PARENT_NAME?: string;
  readonly VITE_UNIVERSAL_RESOLVER?: string;
  readonly VITE_WORLD_APP_ID?: string;
  readonly VITE_WORLD_ACTION?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_ROUTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
