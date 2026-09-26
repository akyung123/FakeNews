import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { WorldGate } from "../components/WorldGate";
import {
  clearLaunchDraft,
  isIssueFormValid,
  isIssueSubmitEnabled,
  isLaunchEnabled,
  isNamedProphet,
  isRegisterSubmitEnabled,
  ISSUE_COPY,
  launchButtonLabel,
  prophecyName,
  readLaunchDraft,
  readStoredProphetLabel,
  storeLaunchDraft,
  storeProphetLabel,
  worldUserMessage,
  type IssueSession,
  type RegisterStatus,
  type WorldStatus,
} from "../lib/issue";
import { createReadProphetOf, createRegisterProphet, type RegisterProphetInput } from "../lib/launchpad";
import { MOCK_ISSUE_PLACEHOLDER, MOCK_ISSUE_SESSION, MOCK_PARENT_NAME, MOCK_RETURNING_SESSION } from "../lib/mock";
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
import {
  createWorldClient,
  type WorldClient,
  type WorldErrorKind,
  type WorldServerSignature,
} from "../lib/world";

export type IssueScreenProps = {
  session: IssueSession;
  world?: WorldClient;
  parentName?: string;
  onIssued?: (id: string) => void;
  registerProphet?: (input: RegisterProphetInput) => Promise<void>;
  launchProphecy?: (input: LaunchInput) => Promise<`0x${string}` | null>;
  lookupProphet?: (wallet: string) => Promise<string>;
};

export function resolveIssueSession(search: URLSearchParams, storedLabel = readStoredProphetLabel()): IssueSession {
  if (search.get("returning") === "1") return { ...MOCK_RETURNING_SESSION };
  if (search.get("fresh") === "1") return { ...MOCK_ISSUE_SESSION };
  if (storedLabel) return { wallet: MOCK_ISSUE_SESSION.wallet, prophetLabel: storedLabel };
  return { ...MOCK_ISSUE_SESSION };
}

export function CreatePage() {
  const [params] = useSearchParams();
  const session = useMemo(() => resolveIssueSession(params), [params]);
  return <IssueScreen session={session} />;
}

export function IssueScreen({
  session,
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
  const readProphet = useMemo(() => lookupProphet ?? createReadProphetOf(), [lookupProphet]);
  const [onChainLabel, setOnChainLabel] = useState("");
  const returningProphet = Boolean(session.prophetLabel || onChainLabel);
  // The inputs outlive a reload (a refresh, or the tab coming back from a wallet
  // app) so a claimed name goes straight on to launch without retyping.
  const [draft] = useState(readLaunchDraft);
  const [prophetLabel, setProphetLabel] = useState(session.prophetLabel ?? draft?.prophetLabel ?? "");
  const [prophecy, setProphecy] = useState(draft?.prophecy ?? "");
  const [slug, setSlug] = useState(draft?.slug ?? "");
  const [worldStatus, setWorldStatus] = useState<WorldStatus>("idle");
  const [worldError, setWorldError] = useState<WorldErrorKind | null>(null);
  const [verified, setVerified] = useState<WorldServerSignature | null>(null);
  const [registerStatus, setRegisterStatus] = useState<RegisterStatus>("idle");
  const [writeBusy, setWriteBusy] = useState(false);
  const [writePhase, setWritePhase] = useState<WritePhase | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeSuccess, setWriteSuccess] = useState<string | null>(null);

  useEffect(() => {
    storeLaunchDraft({ prophetLabel, prophecy, slug });
  }, [prophetLabel, prophecy, slug]);

  useEffect(() => {
    let cancelled = false;
    void readProphet(session.wallet).then((label) => {
      if (cancelled || !label) return;
      setOnChainLabel(label);
      setProphetLabel(label);
    });
    return () => {
      cancelled = true;
    };
  }, [readProphet, session.wallet]);

  const formValid = isIssueFormValid({
    prophetLabel,
    prophecy,
    slug,
  });
  const gate = { returningProphet, worldStatus, formValid, registerStatus };
  const named = isNamedProphet(gate);
  const registeredHere = registerStatus === "success";
  const canLaunch = isLaunchEnabled(gate);
  const canRegister = isRegisterSubmitEnabled(gate);
  const canSubmit = isIssueSubmitEnabled(gate);
  const registerBusy = registerStatus === "pending";
  const busy = registerBusy || writeBusy;
  const pending = writeBusy
    ? writePhaseCopy(writePhase) ?? WRITE_COPY.pending
    : registerBusy
      ? ISSUE_COPY.registerPending
      : !named && worldStatus === "pending"
        ? ISSUE_COPY.pending
        : null;
  const error =
    writeError ??
    (named || worldStatus === "pending" || busy ? null : worldUserMessage(worldError));
  const submitLabel = launchButtonLabel(gate);
  const fullName = prophetLabel && slug ? prophecyName(slug, prophetLabel, parentName) : "";
  const pendingTestId = writeBusy ? "write-pending" : registerBusy ? "register-pending" : "world-pending";

  return (
    <main className="narrow stack">
      <h1>{ISSUE_COPY.title}</h1>
      <p className="faint">{ISSUE_COPY.lead}</p>
      <div className="steps" data-testid="issue-steps">
        <span
          className={`step${named ? " done" : " on"}`}
          data-testid="step-claim"
          aria-current={named ? undefined : "step"}
        >
          {ISSUE_COPY.launchStep1}
        </span>
        <span
          className={`step${named ? " on" : ""}`}
          data-testid="step-launch"
          aria-current={named ? "step" : undefined}
        >
          {ISSUE_COPY.launchStep2}
        </span>
      </div>

      {world.isMock ? (
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
              if (!verified) return;
              setRegisterStatus("pending");
              try {
                await registerProphet({
                  label: prophetLabel,
                  nullifier: verified.nullifier,
                  serverSig: verified.serverSig,
                });
                storeProphetLabel(prophetLabel);
                setRegisterStatus("success");
              } catch (err) {
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
                clearLaunchDraft();
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
              clearLaunchDraft();
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
            placeholder={MOCK_ISSUE_PLACEHOLDER.prophetLabel}
            readOnly={named}
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
            placeholder={MOCK_ISSUE_PLACEHOLDER.prophecy}
            onChange={(e) => setProphecy(e.target.value)}
          />
          <span className="faint small">{utf8ByteLength(prophecy)}/{MAX_PROPHECY_BYTES} · written once, then locked</span>
        </label>

        <div className="row2">
          <label className="field">
            <span>Short name</span>
            <input
              aria-label="Short name"
              value={slug}
              maxLength={32}
              placeholder={MOCK_ISSUE_PLACEHOLDER.slug}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
            />
            <span className="faint small">
              Becomes {slug || "short"}.{prophetLabel || "name"}.{parentName} · a–z, 0–9, hyphen · can't be changed
            </span>
          </label>
        </div>

        {fullName ? <p className="name-preview">{fullName}</p> : null}

        {registeredHere ? null : (
          <WorldGate
            returningProphet={returningProphet}
            prophetName={returningProphet ? `${prophetLabel}.${parentName}` : ""}
            wallet={session.wallet}
            world={world}
            status={worldStatus}
            onStatus={(status) => {
              setWorldStatus(status);
              if (status === "pending" || status === "success") setWorldError(null);
            }}
            onErrorKind={setWorldError}
            onVerified={setVerified}
          />
        )}

        {pending ? (
          <p className="banner-lock" data-testid={pendingTestId}>
            {pending}
          </p>
        ) : null}
        {registerStatus === "success" ? (
          <p className="up" data-testid="register-success">
            {ISSUE_COPY.registerSuccess} {ISSUE_COPY.launchNext}
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
        {!named && worldStatus !== "success" ? (
          <p className="faint small">The button stays off until World verification succeeds.</p>
        ) : null}
      </form>
    </main>
  );
}
