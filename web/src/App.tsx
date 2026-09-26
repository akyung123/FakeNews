import { Link, NavLink, Route, Routes } from "react-router-dom";
import { WalletButton } from "./components/WalletButton";
import { SampleBadge } from "./components/SampleBadge";
import { eth } from "./lib/format";
import { isMockMode } from "./lib/mode";
import { YOU, actions, useStore } from "./lib/store";
import { CoinPage } from "./pages/CoinPage";
import { CreatePage } from "./pages/CreatePage";
import { HomePage } from "./pages/HomePage";
import { MyPage } from "./pages/MyPage";
import { NamePage } from "./pages/NamePage";
import { ProphetPage } from "./pages/ProphetPage";

export function App() {
  const mock = isMockMode();
  const s = useStore();
  const held = mock ? Object.values(s.positions[YOU] ?? {}).filter((p) => p.tokens > 1e-6).length : 0;
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="logo">
          <span>prophecy</span>
        </Link>
        <SampleBadge />

        <nav className="side-nav" aria-label="Main">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/p/ringo">
            ringo.prophecy.eth
          </NavLink>
          <NavLink to="/name">
            Claim your name
          </NavLink>
          <NavLink to="/me">
            My prophecies <span className="count">{held}</span>
          </NavLink>
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
