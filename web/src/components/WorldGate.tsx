import { type ReactNode, useEffect, useState } from "react";
import { ISSUE_COPY, type WorldStatus } from "../lib/issue";
import { MOCK_IDKIT_RESULT } from "../lib/mock";
import {
  createWorldClient,
  WorldClientError,
  idKitConfigFromRpContext,
  worldClientWithServerFallback,
  worldErrorKindFromIdKit,
  worldStatusFromKind,
  type IdKitResultV4,
  type RpContext,
  type WorldClient,
  type WorldErrorKind,
  type WorldServerSignature,
} from "../lib/world";

type Props = {
  returningProphet: boolean;
  prophetName: string;
  wallet: string;
  world?: WorldClient;
  status: WorldStatus;
  onStatus: (status: WorldStatus) => void;
  onErrorKind: (kind: WorldErrorKind) => void;
  onVerified: (result: WorldServerSignature) => void;
};

export function WorldGate({
  returningProphet,
  prophetName,
  wallet,
  world: worldProp,
  status,
  onStatus,
  onErrorKind,
  onVerified,
}: Props) {
  const [defaultWorld] = useState(() => worldProp ?? createWorldClient());
  const world = worldProp ?? defaultWorld;
  const [resolved, setResolved] = useState<WorldClient | null>(world.isMock ? world : null);

  useEffect(() => {
    if (world.isMock) {
      setResolved(world);
      return;
    }
    let cancelled = false;
    setResolved(null);
    void worldClientWithServerFallback(world).then((next) => {
      if (!cancelled) setResolved(next);
    });
    return () => {
      cancelled = true;
    };
  }, [world]);

  if (returningProphet) {
    return (
      <section className="world-gate" data-testid="world-gate">
        <p className="strong">Human check skipped</p>
        <p className="faint">{ISSUE_COPY.returning}</p>
        <p className="name-preview">{prophetName}</p>
      </section>
    );
  }

  if (!resolved) {
    return (
      <section className="world-gate" data-testid="world-gate">
        <p className="strong">Proof of Human</p>
        <p className="faint">{ISSUE_COPY.worldHelp}</p>
        <p className="faint">{ISSUE_COPY.pending}</p>
      </section>
    );
  }

  if (resolved.isMock) {
    return (
      <MockWorldGate
        wallet={wallet}
        world={resolved}
        status={status}
        onStatus={onStatus}
        onErrorKind={onErrorKind}
        onVerified={onVerified}
      />
    );
  }

  return (
    <LiveWorldGate
      wallet={wallet}
      world={resolved}
      status={status}
      onStatus={onStatus}
      onErrorKind={onErrorKind}
      onVerified={onVerified}
    />
  );
}

function MockWorldGate({
  wallet,
  world,
  status,
  onStatus,
  onErrorKind,
  onVerified,
}: {
  wallet: string;
  world: WorldClient;
  status: WorldStatus;
  onStatus: (status: WorldStatus) => void;
  onErrorKind: (kind: WorldErrorKind) => void;
  onVerified: (result: WorldServerSignature) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function succeed() {
    setBusy(true);
    onStatus("pending");
    try {
      await world.fetchRpContext();
      const result = await world.verifyProof({
        wallet,
        idkitResponse: MOCK_IDKIT_RESULT,
      });
      onVerified(result);
      onStatus("success");
    } catch (error) {
      const kind = error instanceof WorldClientError ? error.kind : "network";
      onErrorKind(kind);
      onStatus(worldStatusFromKind(kind));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="world-gate" data-testid="world-gate">
      <p className="strong">Proof of Human</p>
      <p className="faint">{ISSUE_COPY.worldHelp}</p>
      {status === "pending" ? <p className="faint">{ISSUE_COPY.pending}</p> : null}
      {status === "success" ? (
        <p className="up">Verified. You can issue this prophecy.</p>
      ) : (
        <div className="world-actions">
          <button type="button" className="btn primary" disabled={busy} onClick={() => void succeed()}>
            {ISSUE_COPY.prove}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => {
              onErrorKind("cancelled");
              onStatus("cancelled");
            }}
          >
            {ISSUE_COPY.cancel}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => {
              onErrorKind("portal_rejected");
              onStatus("failed");
            }}
          >
            {ISSUE_COPY.fail}
          </button>
        </div>
      )}
      <p className="faint small">
        Mock World ID (`VITE_WORLD_MOCK=1`). The real IDKit 4 widget drops in when mock is off.
      </p>
    </section>
  );
}

function LiveWorldGate({
  wallet,
  world,
  status,
  onStatus,
  onErrorKind,
  onVerified,
}: {
  wallet: string;
  world: WorldClient;
  status: WorldStatus;
  onStatus: (status: WorldStatus) => void;
  onErrorKind: (kind: WorldErrorKind) => void;
  onVerified: (result: WorldServerSignature) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="world-gate" data-testid="world-gate">
      <p className="strong">Proof of Human</p>
      <p className="faint">{ISSUE_COPY.worldHelp}</p>
      {status === "success" ? (
        <p className="up">Verified. You can issue this prophecy.</p>
      ) : (
        <>
          {status === "pending" ? <p className="faint">{ISSUE_COPY.pending}</p> : null}
          <button
            type="button"
            className="btn primary"
            disabled={status === "pending"}
            onClick={() => {
              onStatus("pending");
              setOpen(true);
            }}
          >
            {ISSUE_COPY.prove}
          </button>
        </>
      )}
      {open ? (
        <IdKitHost
          wallet={wallet}
          world={world}
          onClose={(next) => {
            setOpen(next);
            if (!next && status === "pending") {
              onErrorKind("cancelled");
              onStatus("cancelled");
            }
          }}
          onVerified={onVerified}
          onStatus={onStatus}
          onErrorKind={onErrorKind}
        />
      ) : null}
    </section>
  );
}

type IdKitWidget = (props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app_id: string;
  action: string;
  environment: "production" | "staging";
  rp_context: RpContext;
  allow_legacy_proofs: boolean;
  preset: unknown;
  handleVerify: (result: IdKitResultV4) => Promise<void>;
  onSuccess: () => void;
  onError: (code: string) => void;
}) => ReactNode;

function IdKitHost({
  wallet,
  world,
  onClose,
  onVerified,
  onStatus,
  onErrorKind,
}: {
  wallet: string;
  world: WorldClient;
  onClose: (open: boolean) => void;
  onVerified: (result: WorldServerSignature) => void;
  onStatus: (status: WorldStatus) => void;
  onErrorKind: (kind: WorldErrorKind) => void;
}) {
  const [Widget, setWidget] = useState<IdKitWidget | null>(null);
  const [preset, setPreset] = useState<unknown>(null);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [idKitApp, setIdKitApp] = useState<{
    appId: string;
    action: string;
    environment: "production" | "staging";
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [idkit, envelope] = await Promise.all([import("@worldcoin/idkit"), world.fetchRpContext()]);
        if (cancelled) return;
        setWidget(() => idkit.IDKitRequestWidget as unknown as IdKitWidget);
        setPreset(idkit.proofOfHuman({ signal: wallet }));
        setRpContext(envelope.rp_context);
        setIdKitApp(idKitConfigFromRpContext(envelope));
      } catch (error) {
        if (!cancelled) {
          const kind = error instanceof WorldClientError ? error.kind : "network";
          setLoadError(ISSUE_COPY.checkFailed);
          onErrorKind(kind);
          onStatus(worldStatusFromKind(kind));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet, world, onStatus]);

  if (loadError) return <p className="banner-error">{loadError}</p>;
  if (!Widget || !rpContext || !idKitApp) return <p className="faint">{ISSUE_COPY.pending}</p>;

  return (
    <Widget
      open
      onOpenChange={onClose}
      app_id={idKitApp.appId}
      action={idKitApp.action}
      environment={idKitApp.environment}
      rp_context={rpContext}
      allow_legacy_proofs
      preset={preset}
      handleVerify={async (result) => {
        try {
          const verified = await world.verifyProof({
            wallet,
            idkitResponse: result,
          });
          onVerified(verified);
        } catch (error) {
          const kind = error instanceof WorldClientError ? error.kind : "network";
          onErrorKind(kind);
          onStatus(worldStatusFromKind(kind));
          throw error;
        }
      }}
      onSuccess={() => onStatus("success")}
      onError={(code) => {
        const kind = worldErrorKindFromIdKit(code);
        onErrorKind(kind);
        onStatus(worldStatusFromKind(kind));
      }}
    />
  );
}
