import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { WorldGate } from "../components/WorldGate";
import { SampleBadge } from "../components/SampleBadge";
import {
  ISSUE_COPY,
  isValidProphetLabel,
  storeProphetLabel,
  worldUserMessage,
  type IssueSession,
  type WorldStatus,
} from "../lib/issue";
import { createRegisterProphet, type RegisterProphetInput } from "../lib/launchpad";
import { MOCK_PARENT_NAME } from "../lib/mock";
import { isMockMode } from "../lib/mode";
import { writeErrorMessage } from "../lib/writes";
import { issuePlaceholder, resolveIssueSession } from "./CreatePage";
import {
  createWorldClient,
  type WorldClient,
  type WorldErrorKind,
  type WorldServerSignature,
} from "../lib/world";

export function NamePage() {
  const [params] = useSearchParams();
  const session = useMemo(() => resolveIssueSession(params), [params]);
  return <ClaimNameScreen session={session} />;
}

export function ClaimNameScreen({
  session,
  world: worldProp,
  parentName = import.meta.env.VITE_PARENT_NAME || MOCK_PARENT_NAME,
  registerProphet = createRegisterProphet(),
}: {
  session: IssueSession;
  world?: WorldClient;
  parentName?: string;
  registerProphet?: (input: RegisterProphetInput) => Promise<void>;
}) {
  const navigate = useNavigate();
  // One client per screen. A new one each render makes WorldGate recheck the
  // server and drop the open World ID widget.
  const [world] = useState(() => worldProp ?? createWorldClient());
  const returningProphet = Boolean(session.prophetLabel);
  const [prophetLabel, setProphetLabel] = useState(session.prophetLabel ?? "");
  const [worldStatus, setWorldStatus] = useState<WorldStatus>("idle");
  const [worldError, setWorldError] = useState<WorldErrorKind | null>(null);
  const [verified, setVerified] = useState<WorldServerSignature | null>(null);
  const [registerStatus, setRegisterStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [writeError, setWriteError] = useState<string | null>(null);

  const labelOk = isValidProphetLabel(prophetLabel);
  const registerBusy = registerStatus === "pending";
  const canContinue = (returningProphet || (labelOk && worldStatus === "success")) && !registerBusy;
  const pending =
    registerBusy
      ? ISSUE_COPY.registerPending
      : !returningProphet && worldStatus === "pending"
        ? ISSUE_COPY.pending
        : null;
  const error =
    writeError ??
    (returningProphet || worldStatus === "pending" || registerBusy ? null : worldUserMessage(worldError));
  const fullName = prophetLabel ? `${prophetLabel}.${parentName}` : "";

  return (
    <main className="narrow stack">
      <div className="home-toolbar">
        <h1>{ISSUE_COPY.claimTitle}</h1>
        <SampleBadge />
      </div>
      <p className="faint">{ISSUE_COPY.claimLead}</p>
      <div className="steps">
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
        <p className="faint small">
          Mock session: <Link to="/name?fresh=1">first-time</Link>
          {" · "}
          <Link to="/name?returning=1">returning prophet</Link>
        </p>
      ) : null}

      <form
        className="block create name-hero"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canContinue || registerBusy) return;
          if (!returningProphet && !verified) return;
          void (async () => {
            setWriteError(null);
            if (!returningProphet && verified) {
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
                return;
              }
            }
            if (!returningProphet) storeProphetLabel(prophetLabel);
            navigate("/create");
          })();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input
            aria-label="Name"
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

        {fullName ? <p className="name-preview">{fullName}</p> : null}

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
          <p className="banner-lock" data-testid={registerBusy ? "register-pending" : "world-pending"}>
            {pending}
          </p>
        ) : null}
        {registerStatus === "success" ? (
          <p className="up" data-testid="register-success">
            {ISSUE_COPY.registerSuccess}
          </p>
        ) : null}
        {error ? (
          <p className="banner-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn primary full" disabled={!canContinue || registerBusy}>
          {returningProphet ? ISSUE_COPY.oneTransaction : ISSUE_COPY.continueIssue}
        </button>
      </form>
    </main>
  );
}
