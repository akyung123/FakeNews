import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Address } from "viem";
import { WalletGate } from "../components/WalletGate";
import { WorldGate } from "../components/WorldGate";
import {
  isIssueFormValid,
  isLaunchEnabled,
  isRegisterSubmitEnabled,
  ISSUE_COPY,
  ISSUE_PLACEHOLDER,
  launchButtonLabel,
  prophecyName,
  storeProphetLabel,
  worldUserMessage,
  type IssueSession,
  type RegisterStatus,
} from "../lib/issue";
import { useIssueSession, useProphetLookup, useWalletBoundWorld } from "../lib/issueSession";
import { createReadProphetOf, createRegisterProphet, type RegisterProphetInput } from "../lib/launchpad";
import { MOCK_ISSUE_PLACEHOLDER, MOCK_PARENT_NAME } from "../lib/mock";
import { isMockMode } from "../lib/mode";
import { actions } from "../lib/store";
import { MAX_PROPHECY_BYTES, utf8ByteLength } from "../lib/limits";
import {
  createLaunch,
  refreshCoinFromChain,
  writeErrorMessage,
  writePhaseCopy,
  WRITE_COPY,
  type LaunchInput,
  type WritePhase,
} from "../lib/writes";
import { createWorldClient, type WorldClient } from "../lib/world";

export type IssueScreenProps = {
  /** null: chain mode with no wallet connected. */
  session: IssueSession | null;
  walletConnecting?: boolean;
  world?: WorldClient;
  parentName?: string;
  onIssued?: (id: string) => void;
  registerProphet?: (input: RegisterProphetInput) => Promise<void>;
  launchProphecy?: (input: LaunchInput) => Promise<`0x${string}` | null>;
  lookupProphet?: (wallet: string) => Promise<string>;
};

/** Sample hints in demo mode only, so chain mode never shows a sample prophet name. */
export function issuePlaceholder(mock = isMockMode()) {
  return mock ? MOCK_ISSUE_PLACEHOLDER : ISSUE_PLACEHOLDER;
}

export function CreatePage() {
  const { session, connecting } = useIssueSession();
  return <IssueScreen session={session} walletConnecting={connecting} />;
}

export function IssueScreen({
  session,
  walletConnecting = false,
  world: worldProp,
  parentName = import.meta.env.VITE_PARENT_NAME || MOCK_PARENT_NAME,
  onIssued,
  registerProphet = createRegisterProphet(),
  launchProphecy,
  lookupProphet,
}: IssueScreenProps) {
  const navigate = useNavigate();
  // One client per screen. A new one each render makes WorldGate recheck the
  // server and drop the open World ID widget.
  const [world] = useState(() => worldProp ?? createWorldClient());
  const wallet = session?.wallet ?? null;
  const presetLabel = session?.prophetLabel ?? null;
  const readProphet = useMemo(() => lookupProphet ?? createReadProphetOf(), [lookupProphet]);
  const { lookup, retry: retryLookup, refresh: refreshLookup } = useProphetLookup(wallet, presetLabel, readProphet);
  const onChainLabel = lookup.status === "ready" ? lookup.label : "";
  const walletReady = Boolean(wallet) && lookup.status === "ready";
  const returningProphet = Boolean(onChainLabel);
  const {
    walletRef,
    worldStatus,
    worldError,
    verified,
    onStatus: onWorldStatus,
    onErrorKind: onWorldError,
    onVerified: onWorldVerified,
    reset: resetWorld,
  } = useWalletBoundWorld(wallet);
  const [typedLabel, setProphetLabel] = useState(presetLabel ?? "");
  // A wallet that already has a name keeps it; the field is read-only then.
  const prophetLabel = onChainLabel || typedLabel;
  const [prophecy, setProphecy] = useState("");
  const [slug, setSlug] = useState("");
  const [registerStatus, setRegisterStatus] = useState<RegisterStatus>("idle");
  const [writeBusy, setWriteBusy] = useState(false);
  const [writePhase, setWritePhase] = useState<WritePhase | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeSuccess, setWriteSuccess] = useState<string | null>(null);

  // A different wallet is a different person on chain: drop its World result,
  // name claim and banners.
  const [stateWallet, setStateWallet] = useState(wallet);
  if (stateWallet !== wallet) {
    setStateWallet(wallet);
    resetWorld();
    setProphetLabel(presetLabel ?? "");
    setRegisterStatus("idle");
    setWriteError(null);
    setWriteSuccess(null);
  }

  const formValid = isIssueFormValid({
    prophetLabel,
    prophecy,
    slug,
  });
  const gate = { returningProphet, worldStatus, formValid, registerStatus };
  const canLaunch = walletReady && isLaunchEnabled(gate);
  const canRegister = walletReady && isRegisterSubmitEnabled(gate);
  const canSubmit = canLaunch || canRegister;
  const registerBusy = registerStatus === "pending";
  const busy = registerBusy || writeBusy;
  const pending = writeBusy
    ? writePhaseCopy(writePhase) ?? WRITE_COPY.pending
    : registerBusy
      ? ISSUE_COPY.registerPending
      : walletReady && !returningProphet && worldStatus === "pending"
        ? ISSUE_COPY.pending
        : null;
  const error =
    writeError ??
    (returningProphet || worldStatus === "pending" || busy ? null : worldUserMessage(worldError));
  const submitLabel = !wallet
    ? ISSUE_COPY.connectWallet
    : launchButtonLabel({ returningProphet, worldStatus, canLaunch, canRegister });
  const fullName = prophetLabel && slug ? prophecyName(slug, prophetLabel, parentName) : "";
  const pendingTestId = writeBusy ? "write-pending" : registerBusy ? "register-pending" : "world-pending";

  return (
    <main className="narrow stack">
      <h1>{ISSUE_COPY.title}</h1>
      <p className="faint">{ISSUE_COPY.lead}</p>
      <div className="steps" data-testid="issue-steps">
        {returningProphet ? (
          <span className="step on">{ISSUE_COPY.oneTransaction}</span>
        ) : (
          <>
            <span className={`step${worldStatus !== "success" ? " on" : ""}`}>{ISSUE_COPY.step1}</span>
            <span className={`step${worldStatus === "success" ? " on" : ""}`}>{ISSUE_COPY.step2}</span>
          </>
        )}
      </div>

      {world.isMock && isMockMode() ? (
        <p className="faint small" data-testid="mock-session-switch">
          Mock session: <Link to="/create?fresh=1">first-time</Link>
          {" · "}
          <Link to="/create?returning=1">returning prophet</Link>
        </p>
      ) : null}

      <form
        className="block create"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit || busy) return;
          void (async () => {
            setWriteError(null);
            if (canRegister) {
              if (!verified || !wallet) return;
              const signer = wallet;
              setRegisterStatus("pending");
              try {
                await registerProphet({
                  wallet: signer as Address,
                  label: prophetLabel,
                  nullifier: verified.nullifier,
                  serverSig: verified.serverSig,
                });
                if (walletRef.current !== signer) return;
                storeProphetLabel(signer, prophetLabel);
                setRegisterStatus("success");
                void refreshLookup();
              } catch (err) {
                if (walletRef.current !== signer) return;
                const message = writeErrorMessage(err, "registerProphet");
                setRegisterStatus(message ? "failed" : "idle");
                setWriteError(message);
              }
              return;
            }
            if (!canLaunch) return;
            setWriteBusy(true);
            setWritePhase("wallet");
            setWriteSuccess(null);
            try {
              const runLaunch =
                launchProphecy ??
                ((input: LaunchInput) => createLaunch({ onPhase: setWritePhase })(input));
              const token = await runLaunch({
                slug,
                prophecy: prophecy.trim(),
              });
              if (token) {
                actions.create({
                  id: token,
                  token,
                  fromChain: true,
                  prophecy: prophecy.trim(),
                  name: fullName || slug,
                  ticker: slug.toUpperCase().slice(0, 11),
                  firstBuy: 0,
                });
                await refreshCoinFromChain(token, token).catch(() => undefined);
                setWriteSuccess(WRITE_COPY.launchSuccess);
                if (onIssued) onIssued(token);
                else navigate(`/coin/${token}`);
                return;
              }
              const id = actions.create({
                prophecy: prophecy.trim(),
                name: fullName || slug,
                ticker: slug.toUpperCase().slice(0, 11),
                firstBuy: 0,
              });
              if (onIssued) onIssued(id);
              else navigate(`/coin/${id}`);
            } catch (err) {
              setWriteError(writeErrorMessage(err));
            } finally {
              setWriteBusy(false);
              setWritePhase(null);
            }
          })();
        }}
      >
        <p className="banner-lock">{ISSUE_COPY.immutable}</p>

        <label className="field">
          <span>Prophet name</span>
          <input
            aria-label="Prophet name"
            value={prophetLabel}
            maxLength={16}
            placeholder={issuePlaceholder().prophetLabel}
            readOnly={returningProphet}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setProphetLabel(e.target.value.toLowerCase())}
          />
          <span className="faint small">3–16 characters, a–z and 0–9. Becomes {prophetLabel || "name"}.{parentName}</span>
        </label>

        <label className="field">
          <span>Prophecy</span>
          <textarea
            aria-label="Prophecy"
            rows={3}
            value={prophecy}
            placeholder={issuePlaceholder().prophecy}
            onChange={(e) => setProphecy(e.target.value)}
          />
          <span className="faint small">{utf8ByteLength(prophecy)}/{MAX_PROPHECY_BYTES} · written once, then locked</span>
        </label>

        <div className="row2">
          <label className="field">
            <span>Slug</span>
            <input
              aria-label="Slug"
              value={slug}
              maxLength={32}
              placeholder={issuePlaceholder().slug}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
            />
            <span className="faint small">3–32 characters, a–z, 0–9 and hyphen</span>
          </label>
        </div>

        {fullName ? <p className="name-preview">{fullName}</p> : null}

        {wallet && walletReady ? (
          <WorldGate
            key={wallet}
            returningProphet={returningProphet}
            prophetName={onChainLabel ? `${onChainLabel}.${parentName}` : ""}
            wallet={wallet}
            world={world}
            status={worldStatus}
            onStatus={onWorldStatus}
            onErrorKind={onWorldError}
            onVerified={onWorldVerified}
          />
        ) : (
          <WalletGate hasWallet={Boolean(wallet)} connecting={walletConnecting} lookup={lookup} onRetry={retryLookup} />
        )}

        {pending ? (
          <p className="banner-lock" data-testid={pendingTestId}>
            {pending}
          </p>
        ) : null}
        {registerStatus === "success" ? (
          <p className="up" data-testid="register-success">
            {ISSUE_COPY.registerSuccess}
          </p>
        ) : null}
        {writeSuccess ? (
          <p className="up" data-testid="write-success">
            {writeSuccess}
          </p>
        ) : null}
        {error ? (
          <p className="banner-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn primary full"
          data-testid={canLaunch ? "launch-submit" : canRegister ? "register-submit" : "issue-submit"}
          disabled={!canSubmit || busy}
        >
          {submitLabel}
        </button>
        {walletReady && !returningProphet && worldStatus !== "success" ? (
          <p className="faint small">The issue button stays off until World verification succeeds.</p>
        ) : null}
      </form>
    </main>
  );
}
