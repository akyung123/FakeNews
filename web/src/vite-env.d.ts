/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_FACTORY_ADDRESS: string;
  readonly VITE_LAUNCHPAD_ADDRESS: string;
  readonly VITE_LAUNCHPAD_DEPLOY_BLOCK?: string;
  readonly VITE_HOOK_ADDRESS?: string;
  readonly VITE_LOCKER_ADDRESS?: string;
  readonly VITE_POOL_MANAGER?: string;
  readonly VITE_LBP_STRATEGY?: string;
  readonly VITE_POSITION_MANAGER?: string;
  readonly VITE_UNIVERSAL_ROUTER?: string;
  readonly VITE_CCA_LENS?: string;
  readonly VITE_PARENT_NAME: string;
  readonly VITE_UNIVERSAL_RESOLVER: string;
  readonly VITE_WORLD_APP_ID: string;
  readonly VITE_WORLD_ACTION: string;
  readonly VITE_WORLD_MOCK: string;
  readonly VITE_WORLD_SERVER_URL: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_ROUTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
