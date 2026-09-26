import { type ReactNode, useEffect, useState } from "react";
import { ISSUE_COPY, type WorldStatus } from "../lib/issue";
import { MOCK_IDKIT_RESULT } from "../lib/mock";
import {
  createWorldClient,
  worldStatusFromIdKitError,
  type IdKitResultV4,
  type RpContext,
  type WorldClient,
  type WorldServerSignature,
} from "../lib/world";

type Props = {
  returningProphet: boolean;
  prophetName: string;
  wallet: string;
  world?: WorldClient;
  status: WorldStatus;
  onStatus: (status: WorldStatus) => void;
  onVerified: (result: WorldServerSignature) => void;
};

export function WorldGate({
  returningProphet,
  prophetName,
  wallet,
  world = createWorldClient(),
  status,
  onStatus,
  onVerified,
}: Props) {
  if (returningProphet) {
    return (
      <section className="world-gate" data-testid="world-gate">
        <p className="strong">Human check skipped</p>
        <p className="faint">{ISSUE_COPY.returning}</p>
        <p className="name-preview">{prophetName}</p>
      </section>
    );
  }

  if (world.isMock) {
    return (
      <MockWorldGate
        wallet={wallet}
        world={world}
        status={status}
        onStatus={onStatus}
        onVerified={onVerified}
      />
    );
  }

  return (
    <LiveWorldGate
      wallet={wallet}
      world={world}
      status={status}
      onStatus={onStatus}
      onVerified={onVerified}
    />
  );
}

function MockWorldGate({
  wallet,
  world,
  status,
  onStatus,
  onVerified,
}: {
  wallet: string;
  world: WorldClient;
  status: WorldStatus;
  onStatus: (status: WorldStatus) => void;
  onVerified: (result: WorldServerSignature) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function succeed() {
    setBusy(true);
    onStatus("pending");
    try {
      const rpContext = await world.fetchRpContext({ wallet });
      const result = await world.verifyProof({
        wallet,
        rpContext,
        idkitResponse: MOCK_IDKIT_RESULT,
      });
      onVerified(result);
      onStatus("success");
    } catch {
      onStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="world-gate" data-testid="world-gate">
      <p className="strong">Proof of Human</p>
      <p className="faint">{ISSUE_COPY.worldHelp}</p>
      {status === "success" ? (
        <p className="up">Verified. You can issue this prophecy.</p>
      ) : (
        <div className="world-actions">
          <button type="button" className="btn primary" disabled={busy} onClick={() => void succeed()}>
            {ISSUE_COPY.prove}
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => onStatus("cancelled")}>
            {ISSUE_COPY.cancel}
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => onStatus("failed")}>
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
  onVerified,
}: {
  wallet: string;
  world: WorldClient;
  status: WorldStatus;
  onStatus: (status: WorldStatus) => void;
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
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            onStatus("pending");
            setOpen(true);
          }}
        >
          {ISSUE_COPY.prove}
        </button>
      )}
      {open ? (
        <IdKitHost
          wallet={wallet}
          world={world}
          onClose={(next) => {
            setOpen(next);
            if (!next && status === "pending") onStatus("cancelled");
          }}
          onVerified={onVerified}
          onStatus={onStatus}
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
}: {
  wallet: string;
  world: WorldClient;
  onClose: (open: boolean) => void;
  onVerified: (result: WorldServerSignature) => void;
  onStatus: (status: WorldStatus) => void;
}) {
  const [Widget, setWidget] = useState<IdKitWidget | null>(null);
  const [preset, setPreset] = useState<unknown>(null);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [idkit, ctx] = await Promise.all([
          import("@worldcoin/idkit"),
          world.fetchRpContext({ wallet }),
        ]);
        if (cancelled) return;
        setWidget(() => idkit.IDKitRequestWidget as unknown as IdKitWidget);
        setPreset(idkit.proofOfHuman({ signal: wallet }));
        setRpContext(ctx);
      } catch {
        if (!cancelled) {
          setLoadError("Could not start World ID. Check VITE_WORLD_APP_ID and the world server.");
          onStatus("failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet, world, onStatus]);

  if (loadError) return <p className="banner-error">{loadError}</p>;
  if (!Widget || !rpContext) return <p className="faint">Preparing World ID…</p>;

  return (
    <Widget
      open
      onOpenChange={onClose}
      app_id={world.appId}
      action={world.action}
      rp_context={rpContext}
      allow_legacy_proofs
      preset={preset}
      handleVerify={async (result) => {
        const verified = await world.verifyProof({
          wallet,
          rpContext,
          idkitResponse: result,
        });
        onVerified(verified);
      }}
      onSuccess={() => onStatus("success")}
      onError={(code) => onStatus(worldStatusFromIdKitError(code))}
    />
  );
}
