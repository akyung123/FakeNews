import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ISSUE_COPY, readLaunchDraft } from "../lib/issue";
import { resolveIssueSession } from "../lib/issueSession";
import type { RegisterProphetInput } from "../lib/launchpad";
import { MOCK_RETURNING_SESSION, MOCK_WORLD_LAUNCHPAD } from "../lib/mock";
import type { LaunchInput } from "../lib/writes";
import { createWorldClient, type WorldClient } from "../lib/world";
import { CreatePage, IssueScreen } from "./CreatePage";

// Mock mode (no Launchpad in tests): /create issues from the mock wallet.
vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return { ...actual, useAccount: () => ({ address: undefined, status: "disconnected" }) };
});

const PROPHECY = "Coffee lasts until the last pitch";
const TOKEN = "0x1111111111111111111111111111111111111111" as const;

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={["/create"]}>
      <CreatePage />
    </MemoryRouter>,
  );
}

function spies() {
  const registered: RegisterProphetInput[] = [];
  const launched: LaunchInput[] = [];
  const issued: string[] = [];
  return {
    registered,
    launched,
    issued,
    props: {
      registerProphet: async (input: RegisterProphetInput) => {
        registered.push(input);
      },
      launchProphecy: async (input: LaunchInput) => {
        launched.push(input);
        return TOKEN;
      },
      lookupProphet: async () => "",
      onIssued: (id: string) => {
        issued.push(id);
      },
    },
  };
}

/** Renders the screen the way /create does, reading the session from storage. */
function renderScreen(props: ReturnType<typeof spies>["props"], world: WorldClient = createWorldClient({ mock: true })) {
  return render(
    <MemoryRouter>
      <IssueScreen
        session={resolveIssueSession({ search: new URLSearchParams(), mock: true })}
        world={world}
        {...props}
      />
    </MemoryRouter>,
  );
}

async function fillAll(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Prophet name/i), "mina");
  await user.type(screen.getByLabelText(/^Prophecy$/i), PROPHECY);
  await user.type(screen.getByLabelText(/^Short name$/i), "coffee-last");
}

async function claimName(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
  await user.click(await screen.findByRole("button", { name: ISSUE_COPY.register }));
  await waitFor(() => expect(screen.getByTestId("register-success")).toBeInTheDocument());
}

function expectCurrentStep(step: "claim" | "launch") {
  const claim = screen.getByTestId("step-claim");
  const launch = screen.getByTestId("step-launch");
  expect(claim).toHaveTextContent("Claim your name");
  expect(launch).toHaveTextContent("Launch your prophecy");
  const [on, off] = step === "claim" ? [claim, launch] : [launch, claim];
  expect(on).toHaveAttribute("aria-current", "step");
  expect(on).toHaveClass("on");
  expect(off).not.toHaveAttribute("aria-current");
  expect(off).not.toHaveClass("on");
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("Launch screen keeps what was typed", () => {
  it("keeps prophecy and short name after the name is claimed and the page reloads", async () => {
    const user = userEvent.setup();
    const first = renderCreate();
    await fillAll(user);
    await claimName(user);

    // A refresh, or the tab reloading after a trip to the wallet app.
    first.unmount();
    renderCreate();

    expect(screen.getByLabelText(/Prophet name/i)).toHaveValue("mina");
    expect(screen.getByLabelText(/^Prophecy$/i)).toHaveValue(PROPHECY);
    expect(screen.getByLabelText(/^Short name$/i)).toHaveValue("coffee-last");
    expect(screen.getByRole("button", { name: ISSUE_COPY.launch })).toBeEnabled();
  });

  it("goes from a claimed name straight to launch with one more click and the same inputs", async () => {
    const user = userEvent.setup();
    const s = spies();
    renderScreen(s.props);
    expectCurrentStep("claim");
    await fillAll(user);
    await claimName(user);

    expect(s.registered).toHaveLength(1);
    expect(s.launched).toEqual([]);
    expectCurrentStep("launch");
    expect(screen.getByLabelText(/Prophet name/i)).toHaveValue("mina");
    expect(screen.getByLabelText(/Prophet name/i)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/^Prophecy$/i)).toHaveValue(PROPHECY);
    expect(screen.getByLabelText(/^Short name$/i)).toHaveValue("coffee-last");
    expect(screen.getByTestId("register-success")).toHaveTextContent(ISSUE_COPY.launchNext);
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();

    await user.click(screen.getByRole("button", { name: ISSUE_COPY.launch }));
    await waitFor(() => expect(s.issued).toEqual([TOKEN]));
    expect(s.launched).toEqual([{ slug: "coffee-last", prophecy: PROPHECY }]);
    expect(s.registered).toHaveLength(1);
  });

  it("launches after a reload without asking for World or the name claim again", async () => {
    const user = userEvent.setup();
    const before = spies();
    const first = renderScreen(before.props);
    await fillAll(user);
    await claimName(user);
    first.unmount();

    const after = spies();
    renderScreen(after.props);
    expectCurrentStep("launch");
    expect(screen.getByLabelText(/Prophet name/i)).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.launch }));
    await waitFor(() => expect(after.issued).toEqual([TOKEN]));
    expect(after.registered).toEqual([]);
    expect(after.launched).toEqual([{ slug: "coffee-last", prophecy: PROPHECY }]);
  });

  it("keeps typed inputs through a reload before the name is claimed", async () => {
    const user = userEvent.setup();
    const first = renderScreen(spies().props);
    await fillAll(user);
    first.unmount();

    renderScreen(spies().props);
    expectCurrentStep("claim");
    expect(screen.getByLabelText(/Prophet name/i)).toHaveValue("mina");
    expect(screen.getByLabelText(/Prophet name/i)).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText(/^Prophecy$/i)).toHaveValue(PROPHECY);
    expect(screen.getByLabelText(/^Short name$/i)).toHaveValue("coffee-last");
  });

  it("clears the saved inputs once the prophecy is launched", async () => {
    const user = userEvent.setup();
    const s = spies();
    renderScreen(s.props);
    await fillAll(user);
    expect(readLaunchDraft()).toEqual({ prophetLabel: "mina", prophecy: PROPHECY, slug: "coffee-last" });
    await claimName(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.launch }));
    await waitFor(() => expect(s.issued).toEqual([TOKEN]));
    expect(readLaunchDraft()).toBeNull();
  });

  it("keeps the saved inputs when the launch fails", async () => {
    const user = userEvent.setup();
    const s = spies();
    renderScreen({
      ...s.props,
      launchProphecy: async () => {
        throw new Error("Slippage");
      },
    });
    await fillAll(user);
    await claimName(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.launch }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(readLaunchDraft()).toEqual({ prophetLabel: "mina", prophecy: PROPHECY, slug: "coffee-last" });
  });
});

describe("Launch screen steps and fields", () => {
  it("skips step 1 for a returning prophet and keeps the name read-only", () => {
    render(
      <MemoryRouter>
        <IssueScreen session={MOCK_RETURNING_SESSION} world={createWorldClient({ mock: true })} lookupProphet={async () => ""} />
      </MemoryRouter>,
    );
    expectCurrentStep("launch");
    expect(screen.getByLabelText(/Prophet name/i)).toHaveValue("ringo");
    expect(screen.getByLabelText(/Prophet name/i)).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    expect(screen.getByRole("button", { name: ISSUE_COPY.launch })).toBeDisabled();
  });

  it("uses the on-chain name over a saved draft name for a returning wallet", async () => {
    sessionStorage.setItem(
      "prophecy:launch-draft",
      JSON.stringify({ prophetLabel: "other", prophecy: PROPHECY, slug: "coffee-last" }),
    );
    renderScreen({ ...spies().props, lookupProphet: async () => "mina" });
    await waitFor(() => expect(screen.getByLabelText(/Prophet name/i)).toHaveValue("mina"));
    expectCurrentStep("launch");
    expect(screen.getByLabelText(/Prophet name/i)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/^Prophecy$/i)).toHaveValue(PROPHECY);
  });

  it("labels the slug as Short name and previews the full name", async () => {
    const user = userEvent.setup();
    renderScreen(spies().props);
    expect(screen.queryByLabelText(/^Slug$/i)).toBeNull();
    expect(document.body.textContent).toContain(
      "Becomes short.name.prophecy.eth · a–z, 0–9, hyphen · can't be changed",
    );
    await fillAll(user);
    expect(document.body.textContent).toContain(
      "Becomes coffee-last.mina.prophecy.eth · a–z, 0–9, hyphen · can't be changed",
    );
    expect(document.querySelector(".name-preview")).toHaveTextContent("coffee-last.mina.prophecy.eth");
  });
});

describe("Launch screen with a blocked World server", () => {
  it("shows the ad blocker message instead of switching to mock World ID", async () => {
    const world = createWorldClient({
      mock: false,
      serverUrl: "http://world.test",
      launchpad: MOCK_WORLD_LAUNCHPAD,
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    renderScreen(spies().props, world);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "We can't reach the World server. If you use an ad blocker, turn it off for this site and try again.",
      ),
    );
    expect(screen.queryByText(/Mock World ID/)).toBeNull();
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    expect(screen.getByRole("button", { name: ISSUE_COPY.retry })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ISSUE_COPY.disabledLaunch })).toBeDisabled();
  });
});
