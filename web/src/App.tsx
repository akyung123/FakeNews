import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import { WalletButton } from "./components/WalletButton";
import { SampleBadge } from "./components/SampleBadge";
import { webEnv } from "./lib/env";
import { useFollowing } from "./lib/following";
import { eth } from "./lib/format";
import { createReadProphetOf } from "./lib/launchpad";
import { isMockMode } from "./lib/mode";
import { YOU, actions, useStore } from "./lib/store";
import { CoinPage } from "./pages/CoinPage";
import { CreatePage } from "./pages/CreatePage";
import { HomePage } from "./pages/HomePage";
import { MyPage } from "./pages/MyPage";
import { NamePage } from "./pages/NamePage";
import { ProphetPage } from "./pages/ProphetPage";

const readProphetOf = createReadProphetOf();

export function App() {
  const mock = isMockMode();
  const s = useStore();
  const { address, isConnected } = useAccount();
  const [prophetLabel, setProphetLabel] = useState<string | null>(null);
  const following = useFollowing();
  const { pathname, hash } = useLocation();
  // NavLink ignores the hash, so /me and /me#following would both light up.
  const onMe = pathname === "/me";
  const onFollowing = onMe && hash === "#following";
  const held = mock ? Object.values(s.positions[YOU] ?? {}).filter((p) => p.tokens > 1e-6).length : 0;

  useEffect(() => {
    if (!isConnected || !address) {
      setProphetLabel(null);
      return;
    }
    let cancelled = false;
    void readProphetOf(address).then((label) => {
      if (!cancelled) setProphetLabel(label || null);
    }).catch(() => {
      if (!cancelled) setProphetLabel(null);
    });
    return () => { cancelled = true; };
  }, [address, isConnected]);

  const parentName = webEnv.parentName;
  const prophetEns = prophetLabel ? `${prophetLabel}.${parentName}` : null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="logo">
          <span>prophit</span>
        </Link>
        <SampleBadge />

        <nav className="side-nav" aria-label="Main">
          <NavLink to="/" end>
            Home
          </NavLink>
          {prophetEns ? (
            <NavLink to={`/p/${prophetLabel}`}>
              {prophetEns}
            </NavLink>
          ) : null}
          <NavLink to="/name">
            Claim your name
          </NavLink>
          <Link
            to="/me"
            className={onMe && !onFollowing ? "active" : undefined}
            aria-current={onMe && !onFollowing ? "page" : undefined}
          >
            My prophecies{"\u00a0"}<span className="count">{held}</span>
          </Link>
          <Link
            to="/me#following"
            className={onFollowing ? "active" : undefined}
            aria-current={onFollowing ? "page" : undefined}
          >
            Following{"\u00a0"}<span className="count">{following.length}</span>
          </Link>
        </nav>

        <Link to="/create" className="btn primary full side-cta">
          Launch a prophecy
        </Link>

        <div className="side-wallet">
          <WalletButton />
          {mock ? (
            <>
              <p className="faint small">Demo cash</p>
              <p className="strong">{eth(s.balance)}</p>
            </>
          ) : null}
        </div>

        {mock ? (
          <p className="side-foot faint small">
            Demo data lives in this browser.{" "}
            <button type="button" className="link" onClick={() => actions.reset()}>
              Reset demo
            </button>
          </p>
        ) : null}
      </aside>

      <div className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/me" element={<MyPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/name" element={<NamePage />} />
          <Route path="/coin/:id" element={<CoinPage />} />
          <Route path="/n/:name" element={<CoinPage />} />
          <Route path="/p/:name" element={<ProphetPage />} />
        </Routes>
      </div>
    </div>
  );
}
