import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { WorldGate } from "../components/WorldGate";
import { SampleBadge } from "../components/SampleBadge";
import {
  ISSUE_COPY,
  isValidProphetLabel,
  storeProphetLabel,
  worldErrorKindFromRegisterProphet,
  worldUserMessage,
  type IssueSession,
  type WorldStatus,
} from "../lib/issue";
import { MOCK_ISSUE_PLACEHOLDER, MOCK_PARENT_NAME } from "../lib/mock";
import { resolveIssueSession } from "./CreatePage";
import {
  createWorldClient,
  type Hex,
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
  world = createWorldClient(),
  parentName = import.meta.env.VITE_PARENT_NAME || MOCK_PARENT_NAME,
  registerProphet,
}: {
  session: IssueSession;
  world?: WorldClient;
  parentName?: string;
  registerProphet?: (input: { label: string; nullifier: Hex; serverSig: Hex }) => Promise<void>;
}) {
  const navigate = useNavigate();
  const returningProphet = Boolean(session.prophetLabel);
  const [prophetLabel, setProphetLabel] = useState(session.prophetLabel ?? "");
  const [worldStatus, setWorldStatus] = useState<WorldStatus>("idle");
  const [worldError, setWorldError] = useState<WorldErrorKind | null>(null);
  const [verified, setVerified] = useState<WorldServerSignature | null>(null);

  const labelOk = isValidProphetLabel(prophetLabel);
  const canContinue = returningProphet || (labelOk && worldStatus === "success");
  const pending = !returningProphet && worldStatus === "pending" ? ISSUE_COPY.pending : null;
  const error = returningProphet || worldStatus === "pending" ? null : worldUserMessage(worldError);
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
            <span className="step on">{ISSUE_COPY.step1}</span>
            <span className="step">{ISSUE_COPY.step2}</span>
          </>
        )}
      </div>

      {world.isMock ? (
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
          if (!canContinue) return;
          void (async () => {
            if (!returningProphet && verified && registerProphet) {
              try {
                await registerProphet({
                  label: prophetLabel,
                  nullifier: verified.nullifier,
                  serverSig: verified.serverSig,
                });
              } catch (err) {
                const kind = worldErrorKindFromRegisterProphet(err);
                setWorldError(kind);
                setWorldStatus("failed");
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
            placeholder={MOCK_ISSUE_PLACEHOLDER.prophetLabel}
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
          <p className="banner-lock" data-testid="world-pending">
            {pending}
          </p>
        ) : null}
        {error ? (
          <p className="banner-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn primary full" disabled={!canContinue}>
          {returningProphet ? ISSUE_COPY.oneTransaction : ISSUE_COPY.continueIssue}
        </button>
      </form>
    </main>
  );
}
