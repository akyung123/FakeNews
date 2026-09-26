import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { WorldGate } from "../components/WorldGate";
import {
  fromDatetimeLocalValue,
  isIssueFormValid,
  isIssueSubmitEnabled,
  isLaunchEnabled,
  isRegisterSubmitEnabled,
  ISSUE_COPY,
  launchButtonLabel,
  prophecyName,
  readStoredProphetLabel,
  storeProphetLabel,
  toDatetimeLocalValue,
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
  ethInputToWei,
  isFirstBuyTooSmall,
  refreshCoinFromChain,
  writeErrorMessage,
  writePhaseCopy,
  WRITE_COPY,
  ZERO_QUOTE_COPY,
  type LaunchInput,
  type WritePhase,
} from "../lib/writes";
import {
  createWorldClient,
  type WorldClient,
  type WorldErrorKind,
  type WorldServerSignature,
} from "../lib/world";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type IssueScreenProps = {
  session: IssueSession;
  world?: WorldClient;
  now?: number;
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
  world = createWorldClient(),
  now = Date.now(),
  parentName = import.meta.env.VITE_PARENT_NAME || MOCK_PARENT_NAME,
  onIssued,
  registerProphet = createRegisterProphet(),
  launchProphecy,
  lookupProphet,
}: IssueScreenProps) {
  const navigate = useNavigate();
  const readProphet = useMemo(() => lookupProphet ?? createReadProphetOf(), [lookupProphet]);
  const [onChainLabel, setOnChainLabel] = useState("");
  const returningProphet = Boolean(session.prophetLabel || onChainLabel);
  const [prophetLabel, setProphetLabel] = useState(session.prophetLabel ?? "");
  const [prophecy, setProphecy] = useState("");
  const [slug, setSlug] = useState("");
  const [deadlineLocal, setDeadlineLocal] = useState(toDatetimeLocalValue(now + WEEK_MS));
  const [firstBuy, setFirstBuy] = useState("0");
  const [worldStatus, setWorldStatus] = useState<WorldStatus>("idle");
  const [worldError, setWorldError] = useState<WorldErrorKind | null>(null);
  const [verified, setVerified] = useState<WorldServerSignature | null>(null);
  const [registerStatus, setRegisterStatus] = useState<RegisterStatus>("idle");
  const [writeBusy, setWriteBusy] = useState(false);
  const [writePhase, setWritePhase] = useState<WritePhase | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeSuccess, setWriteSuccess] = useState<string | null>(null);

  const deadlineUnix = fromDatetimeLocalValue(deadlineLocal);
  const nowSeconds = Math.floor(now / 1000);
  useEffect(() => {
    let cancelled = false;
    void readProphet(session.wallet).then((label) => {
      if (cancelled || !label) return;
      setOnChainLabel(label);
      setProphetLabel((prev) => prev || label);
    });
    return () => {
      cancelled = true;
    };
  }, [readProphet, session.wallet]);

  const formValid = isIssueFormValid({
    prophetLabel,
    prophecy,
    slug,
    deadlineUnix,
    firstBuy,
    nowSeconds,
  });
  const gate = { returningProphet, worldStatus, formValid, registerStatus };
  const canLaunch = isLaunchEnabled(gate);
  const canRegister = isRegisterSubmitEnabled(gate);
  const canSubmit = isIssueSubmitEnabled(gate);
  const firstBuyTooSmall = isFirstBuyTooSmall(ethInputToWei(firstBuy));
  const registerBusy = registerStatus === "pending";
  const busy = registerBusy || writeBusy;
  const pending = writeBusy
    ? writePhaseCopy(writePhase) ?? WRITE_COPY.pending
    : registerBusy
      ? ISSUE_COPY.registerPending
      : !returningProphet && worldStatus === "pending"
        ? ISSUE_COPY.pending
        : null;
  const error =
    writeError ??
    (returningProphet || worldStatus === "pending" || busy ? null : worldUserMessage(worldError));
  const submitLabel = launchButtonLabel({ returningProphet, worldStatus, canLaunch, canRegister });
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
          if (!canSubmit || busy || (canLaunch && firstBuyTooSmall)) return;
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
                deadline: BigInt(deadlineUnix),
                firstBuyWei: ethInputToWei(firstBuy),
              });
              if (token) {
                actions.create({
                  id: token,
                  token,
                  fromChain: true,
                  prophecy: prophecy.trim(),
                  name: fullName || slug,
                  ticker: slug.toUpperCase().slice(0, 11),
                  firstBuy: Number(firstBuy) || 0,
                });
                await refreshCoinFromChain(token, token).catch(() => undefined);
                if (!returningProphet) storeProphetLabel(prophetLabel);
                setWriteSuccess(WRITE_COPY.launchSuccess);
                if (onIssued) onIssued(token);
                else navigate(`/coin/${token}`);
                return;
              }
              const id = actions.create({
                prophecy: prophecy.trim(),
                name: fullName || slug,
                ticker: slug.toUpperCase().slice(0, 11),
                firstBuy: Number(firstBuy) || 0,
              });
              if (!returningProphet) storeProphetLabel(prophetLabel);
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
            placeholder={MOCK_ISSUE_PLACEHOLDER.prophecy}
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
              placeholder={MOCK_ISSUE_PLACEHOLDER.slug}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
            />
            <span className="faint small">3–32 characters, a–z, 0–9 and hyphen</span>
          </label>
          <label className="field">
            <span>Deadline</span>
            <input
              aria-label="Deadline"
              type="datetime-local"
              value={deadlineLocal}
              onChange={(e) => setDeadlineLocal(e.target.value)}
            />
            <span className="faint small">
              After this time the screen shows Departed. Unix {deadlineUnix || "—"}.
            </span>
          </label>
        </div>

        {fullName ? <p className="name-preview">{fullName}</p> : null}

        <label className="field">
          <span>First buy (ETH, optional)</span>
          <input inputMode="decimal" value={firstBuy} onChange={(e) => setFirstBuy(e.target.value)} />
        </label>

        <WorldGate
          returningProphet={returningProphet}
          prophetName={session.prophetLabel ? `${session.prophetLabel}.${parentName}` : ""}
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
        {firstBuyTooSmall ? (
          <p className="banner-error" role="alert">
            {ZERO_QUOTE_COPY}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn primary full"
          data-testid={canLaunch ? "launch-submit" : canRegister ? "register-submit" : "issue-submit"}
          disabled={!canSubmit || busy || (canLaunch && firstBuyTooSmall)}
        >
          {submitLabel}
        </button>
        {!returningProphet && worldStatus !== "success" ? (
          <p className="faint small">The issue button stays off until World verification succeeds.</p>
        ) : null}
      </form>
    </main>
  );
}
