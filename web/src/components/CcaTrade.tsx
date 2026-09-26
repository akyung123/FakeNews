import { useEffect, useState } from "react";
import { parseEther, type Address } from "viem";
import { getAccount } from "wagmi/actions";
import {
  CCA_COPY,
  FEE_COLLECT_COPY,
  MISSING_ADDRESS_COPY,
  SWAP_SECTION_COPY,
  auctionStatusCopy,
  auctionStatusSubCopy,
  ccaErrorCopyFor,
  claimBlockedCopy,
  collectCcaWrite,
  exitCtaCopy,
  exitDoneCopy,
  exitHelpCopy,
  openMarketBeforeCopy,
  placeBid,
  q96ToEthPerToken,
  raisedProgressCopy,
  registerLocker,
  sendCcaWrite,
  tokenIdFromMigrateReceipt,
  swapExactInSingle,
  swapTokenLine,
  tokenApprovePermit2Write,
  permit2ApproveRouterWrite,
  yourBidCopy,
  checkpoint,
  claimTokens,
  exitBid,
  openMarketResult,
  type AuctionCopyStatus,
  type CcaWriteOptions,
} from "../lib/cca";
import { ccaFeatureFlags, type CcaFeatureFlags } from "../lib/cca/config";
import { loadCcaAuction, type CcaAuctionSnapshot } from "../lib/cca/loadAuction";
import { SEPOLIA_CHAIN_ID } from "../lib/env";
import { graduated } from "../lib/curve";
import { eth, tokens } from "../lib/format";
import { GRADUATION_ETH } from "../lib/mock";
import { isCcaDemoMode } from "../lib/mode";
import { actions, type Coin } from "../lib/store";
import { isChainWriteTarget, liveTokenAddress } from "../lib/writes";
import { wagmiConfig } from "../lib/wagmi";

export type CcaTradeProps = {
  coin: Coin;
  balance: number;
  held: number;
  chain?: boolean;
  demo?: boolean;
  features?: CcaFeatureFlags;
  chainId?: number;
  loadAuction?: (token: Address) => Promise<CcaAuctionSnapshot>;
  writes?: CcaWriteOptions;
};

export function CcaTrade({
  coin,
  balance,
  held,
  chain = false,
  demo: demoOverride,
  features,
  chainId,
  loadAuction = loadCcaAuction,
  writes,
}: CcaTradeProps) {
  const demo = demoOverride ?? isCcaDemoMode();
  const flags = features ?? ccaFeatureFlags();
  const writeTarget = isChainWriteTarget(coin);
  const token = liveTokenAddress(coin.id, coin.token);
  const [snap, setSnap] = useState<CcaAuctionSnapshot | null>(null);
  const [budget, setBudget] = useState("0.001");
  const [maxPrice, setMaxPrice] = useState("1100");
  const [swapSide, setSwapSide] = useState<"buy" | "sell">("buy");
  const [swapAmount, setSwapAmount] = useState("0.001");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function reload() {
    if (!chain || !writeTarget || !token) return;
    try {
      setSnap(await loadAuction(token));
    } catch {
      setSnap(null);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, writeTarget, token]);

  const prototype = demo && (!chain || !writeTarget || !snap?.auction);
  const mockComplete = graduated(coin) || Boolean(coin.complete);
  const copyStatus: AuctionCopyStatus = snap?.auction
    ? snap.copyStatus
    : demo
      ? mockComplete
        ? "pool_open"
        : "live"
      : "not_funded";
  let connectedChainId: number | undefined = chainId;
  if (connectedChainId == null) {
    try {
      connectedChainId = getAccount(wagmiConfig).chainId;
    } catch {
      connectedChainId = undefined;
    }
  }
  const wrongChain = !demo && connectedChainId != null && connectedChainId !== SEPOLIA_CHAIN_ID;
  const writesBlocked = Boolean(pending) || wrongChain;
  const view = snap?.view;
  const raisedWei = view?.currencyRaised ?? parseEther(Math.max(0, coin.ethRaised).toFixed(18));
  const goalReached = view?.goalReached ?? mockComplete;
  const header = auctionStatusCopy(
    copyStatus,
    copyStatus === "not_started"
      ? { n: Number(view ? view.startBlock - (view.endBlock - BigInt(view.blocksRemaining)) : 0n) }
      : { blocks: view?.blocksRemaining ?? 0 },
  );
  const sub = auctionStatusSubCopy(copyStatus) ?? (copyStatus === "market_failed" ? CCA_COPY.marketFailedHelp : undefined);
  const clearing = view ? q96ToEthPerToken(view.clearingPriceQ96) : undefined;
  const symbol = `$${coin.ticker}`;
  const showBid = copyStatus === "live" || copyStatus === "not_started" || copyStatus === "sold_out";
  const showSettle = copyStatus === "ended_not_finalized" || copyStatus === "graduated" || copyStatus === "failed" || copyStatus === "market_failed";
  const showMarket = flags.migrate && copyStatus === "graduated" && !snap?.poolOpen && !snap?.marketFailed;
  const showSwap = flags.swap && copyStatus === "pool_open";
  const showFees = flags.collect && (copyStatus === "pool_open" || (copyStatus === "graduated" && !snap?.poolOpen));
  const showSwapHint = flags.swap && !showSwap && (copyStatus === "live" || copyStatus === "graduated" || copyStatus === "failed");
  const showFeeHint = !showFees && flags.collect;
  const refundWei = snap?.refundWei ?? 0n;
  const openBids = (snap?.bids ?? []).filter((row) => row.bid.exitedBlock === 0n);

  async function run(label: string, work: () => Promise<unknown>, done: string) {
    if (pending) return;
    setPending(label);
    setError(null);
    setSuccess(null);
    try {
      const result = await work();
      setSuccess(typeof result === "string" ? result : done);
      await reload();
    } catch (err) {
      setError(
        ccaErrorCopyFor(err, {
          claimBlock: view?.claimBlock,
          migrationBlock: view?.migrationBlock,
          SYMBOL: symbol,
        }),
      );
    } finally {
      setPending(null);
    }
  }

  function mockBid() {
    const value = Number(budget) || 0;
    if (value <= 0) return;
    actions.buy(coin.id, Math.min(value, balance));
    setSuccess(CCA_COPY.bidPlaced);
  }

  return (
    <section className="block trade">
      <h2>{header}</h2>
      {sub ? <p className="faint">{sub}</p> : null}
      {copyStatus === "market_failed" ? <p className="faint">{CCA_COPY.marketFailedBody}</p> : null}
      <p className="faint">{raisedProgressCopy(raisedWei)}</p>
      <p className="faint small">
        {goalReached || mockComplete ? CCA_COPY.finalClearingPrice : CCA_COPY.currentClearingPrice}
        {clearing ? ` · ${clearing} ETH` : ""}
      </p>
      <p className="faint small">{CCA_COPY.clearingPriceHelp}</p>
      {snap?.auction && snap.missing.length ? <p className="faint small">{MISSING_ADDRESS_COPY}</p> : null}

      {pending ? <p className="banner-lock">{pending}</p> : null}
      {success ? <p className="up">{success}</p> : null}
      {error ? (
        <p className="banner-error" role="alert">
          {error}
        </p>
      ) : null}

      {showBid ? (
        <>
          <label className="field">
            <span>{CCA_COPY.budgetEth}</span>
            <input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>
          <label className="field">
            <span>{CCA_COPY.maxPricePerToken}</span>
            <input inputMode="decimal" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </label>
          <p className="faint small">{CCA_COPY.bidHelp}</p>
          {Number(budget) > 0 ? <p className="faint">{yourBidCopy(budget, maxPrice)}</p> : null}
          <button
            type="button"
            className="btn primary full"
            disabled={writesBlocked || !(Number(budget) > 0) || copyStatus === "not_started" || copyStatus === "sold_out" || (!demo && !snap?.auction)}
            onClick={() => {
              if (demo && (prototype || !snap?.auction)) {
                mockBid();
                return;
              }
              if (!snap?.auction) return;
              const auction = snap.auction;
              const owner = snap.owner ?? getAccount(wagmiConfig).address;
              if (!owner) return;
              void run(CCA_COPY.placingBid, () => placeBid({
                auction,
                owner,
                budgetEth: budget,
                maxPricePerTokenEth: maxPrice,
                floorPriceQ96: snap.floorPriceQ96,
                tickSpacingQ96: snap.tickSpacingQ96,
              }, writes), CCA_COPY.bidPlaced);
            }}
          >
            {pending === CCA_COPY.placingBid ? CCA_COPY.placingBid : CCA_COPY.placeBid}
          </button>
        </>
      ) : null}

      {showSettle ? (
        <>
          {copyStatus === "ended_not_finalized" && snap?.auction ? (
            <button
              type="button"
              className="btn primary full"
              disabled={writesBlocked}
              onClick={() => void run(CCA_COPY.settingFinalPrice, () => checkpoint(snap.auction!, writes), CCA_COPY.finalClearingPrice)}
            >
              {pending === CCA_COPY.settingFinalPrice ? CCA_COPY.settingFinalPrice : CCA_COPY.setFinalPrice}
            </button>
          ) : null}
          {openBids.length > 0 || (demo && prototype) ? (
            <>
              <p className="faint small">{exitHelpCopy(goalReached, refundWei)}</p>
              <button
                type="button"
                className="btn primary full"
                disabled={writesBlocked || (!demo && openBids.length === 0)}
                onClick={() => {
                  if (demo && (prototype || !snap?.auction)) {
                    setSuccess(exitDoneCopy(goalReached));
                    return;
                  }
                  const first = openBids[0];
                  if (!first || !snap?.auction) return;
                  const auction = snap.auction;
                  void run(CCA_COPY.sendingEth, () => exitBid(auction, first.id, writes), exitDoneCopy(goalReached));
                }}
              >
                {pending === CCA_COPY.sendingEth
                  ? CCA_COPY.sendingEth
                  : success === exitDoneCopy(goalReached)
                    ? CCA_COPY.ethReturned
                    : exitCtaCopy(goalReached, refundWei)}
              </button>
            </>
          ) : (
            <p className="up">{CCA_COPY.ethReturned}</p>
          )}
          {goalReached && copyStatus !== "failed" ? (
            <>
              {view ? <p className="faint small">{claimBlockedCopy(view.claimBlock)}</p> : null}
              <button
                type="button"
                className="btn primary full"
                disabled={writesBlocked}
                onClick={() => {
                  if (demo && (prototype || !snap?.auction)) {
                    setSuccess(CCA_COPY.tokensClaimed);
                    return;
                  }
                  if (!snap?.auction) return;
                  const auction = snap.auction;
                  const first = snap.bids.find((row) => row.bid.exitedBlock !== 0n) ?? snap.bids[0];
                  if (!first) return;
                  void run(CCA_COPY.claiming, () => claimTokens(auction, first.id, writes), CCA_COPY.tokensClaimed);
                }}
              >
                {pending === CCA_COPY.claiming ? CCA_COPY.claiming : CCA_COPY.claimTokens}
              </button>
            </>
          ) : null}
        </>
      ) : null}

      {showMarket && snap?.auction && snap.lbpStrategy ? (
        <>
          <p className="faint">{CCA_COPY.openMarketHelp}</p>
          {view && !view.canOpenMarket ? <p className="faint small">{openMarketBeforeCopy(view.migrationBlock)}</p> : null}
          <button
            type="button"
            className="btn primary full"
            disabled={writesBlocked || (view ? !view.canOpenMarket : false)}
            onClick={() => {
              void run(CCA_COPY.openingMarket, async () => {
                const { outcome, receipt } = await openMarketResult(snap.auction!, writes, snap.lbpStrategy);
                if (outcome === "failed") return CCA_COPY.marketFailedToast;
                if (snap.locker) {
                  const tokenId = tokenIdFromMigrateReceipt(receipt, snap.locker, snap.positionManager);
                  if (tokenId != null) {
                    setSnap((current) =>
                      current
                        ? { ...current, tokenId, needsRegister: true, poolOpen: true }
                        : current,
                    );
                  }
                }
                return CCA_COPY.marketOpen;
              }, CCA_COPY.marketOpen);
            }}
          >
            {pending === CCA_COPY.openingMarket ? CCA_COPY.openingMarket : CCA_COPY.openMarket}
          </button>
        </>
      ) : null}

      {showSwap ? (
        <>
          <h2>{SWAP_SECTION_COPY.title}</h2>
          <p className="faint small">{SWAP_SECTION_COPY.feeNote}</p>
          <div className="tabs">
            <button type="button" className={swapSide === "buy" ? "on buy" : ""} onClick={() => { setSwapSide("buy"); setSwapAmount("0.001"); }}>
              Buy
            </button>
            <button type="button" className={swapSide === "sell" ? "on sell" : ""} onClick={() => { setSwapSide("sell"); setSwapAmount("1"); }}>
              Sell
            </button>
          </div>
          <label className="field">
            <span>{swapSide === "buy" ? SWAP_SECTION_COPY.youPayEth : swapTokenLine(SWAP_SECTION_COPY.youSellToken, symbol)}</span>
            <input inputMode="decimal" value={swapAmount} onChange={(e) => setSwapAmount(e.target.value)} />
          </label>
          <p className="faint">
            {swapSide === "buy"
              ? swapTokenLine(SWAP_SECTION_COPY.youGetAboutToken, symbol, tokens(Number(swapAmount) || 0))
              : swapTokenLine(SWAP_SECTION_COPY.youGetAboutEth.replace("{amount} ETH", "{amount} ETH"), symbol, swapAmount)}
          </p>
          {swapSide === "sell" && chain && writeTarget ? (
            <>
              <p className="faint small">{swapTokenLine(SWAP_SECTION_COPY.allowHelper, symbol)}</p>
              <button
                type="button"
                className="btn full"
                disabled={writesBlocked || !token}
                onClick={() => {
                  if (!token) return;
                  void run(
                    SWAP_SECTION_COPY.allowing,
                    () => sendCcaWrite(tokenApprovePermit2Write(token), "approve", writes),
                    swapTokenLine(SWAP_SECTION_COPY.allowed, symbol),
                  );
                }}
              >
                {swapTokenLine(SWAP_SECTION_COPY.allowUniswap, symbol)}
              </button>
              <p className="faint small">{swapTokenLine(SWAP_SECTION_COPY.confirmHelper, symbol)}</p>
              <button
                type="button"
                className="btn full"
                disabled={writesBlocked || !token}
                onClick={() => {
                  if (!token) return;
                  void run(
                    SWAP_SECTION_COPY.confirming,
                    () => sendCcaWrite(permit2ApproveRouterWrite(token), "permit2.approve", writes),
                    SWAP_SECTION_COPY.readyToSell,
                  );
                }}
              >
                {swapTokenLine(SWAP_SECTION_COPY.confirmSale, symbol)}
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={`btn ${swapSide === "buy" ? "primary" : "sell"} full`}
            disabled={writesBlocked || !(Number(swapAmount) > 0) || (!demo && (!token || !snap?.hook))}
            onClick={() => {
              const amount = Number(swapAmount) || 0;
              if (demo && (prototype || !token || !snap?.hook)) {
                if (swapSide === "buy") actions.buy(coin.id, Math.min(amount, balance));
                else actions.sell(coin.id, Math.min(held, amount));
                setSuccess(
                  swapSide === "buy"
                    ? swapTokenLine(SWAP_SECTION_COPY.bought, symbol, tokens(amount))
                    : swapTokenLine(SWAP_SECTION_COPY.sold, symbol, String(amount)),
                );
                return;
              }
              if (!token || !snap?.hook) return;
              const amountIn = parseEther(swapAmount || "0");
              if (swapSide === "buy" && amount > balance) {
                setError(SWAP_SECTION_COPY.notEnoughEth);
                return;
              }
              void run(
                swapSide === "buy" ? SWAP_SECTION_COPY.buying : SWAP_SECTION_COPY.selling,
                () => swapExactInSingle({
                  token,
                  hooks: snap.hook!,
                  zeroForOne: swapSide === "buy",
                  amountIn,
                  amountOutMinimum: 0n,
                  deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
                }, writes),
                swapSide === "buy"
                  ? swapTokenLine(SWAP_SECTION_COPY.bought, symbol, tokens(amount))
                  : swapTokenLine(SWAP_SECTION_COPY.sold, symbol, swapAmount),
              );
            }}
          >
            {swapSide === "buy"
              ? (pending === SWAP_SECTION_COPY.buying ? SWAP_SECTION_COPY.buying : swapTokenLine(SWAP_SECTION_COPY.buySymbol, symbol))
              : (pending === SWAP_SECTION_COPY.selling ? SWAP_SECTION_COPY.selling : swapTokenLine(SWAP_SECTION_COPY.sellSymbol, symbol))}
          </button>
        </>
      ) : showSwapHint ? (
        <p className="faint small">{SWAP_SECTION_COPY.beforeOpen}</p>
      ) : null}

      {showFees ? (
        <>
          <h2>{FEE_COLLECT_COPY.title}</h2>
          {copyStatus !== "pool_open" ? (
            <p className="faint">{FEE_COLLECT_COPY.beforeOpen}</p>
          ) : snap?.needsRegister ? (
            <>
              <p className="faint">{FEE_COLLECT_COPY.registerHelper}</p>
              <button
                type="button"
                className="btn primary full"
                disabled={writesBlocked || !snap.locker || !token || snap.tokenId == null}
                onClick={() => {
                  if (!snap.locker || !token || snap.tokenId == null) return;
                  void run(
                    FEE_COLLECT_COPY.settingUp,
                    () => registerLocker(snap.locker!, token, snap.tokenId!, writes),
                    FEE_COLLECT_COPY.feeCollectionReady,
                  );
                }}
              >
                {pending === FEE_COLLECT_COPY.settingUp ? FEE_COLLECT_COPY.settingUp : FEE_COLLECT_COPY.setupFeeCollection}
              </button>
            </>
          ) : (
            <>
              <p className="faint">{FEE_COLLECT_COPY.helper}</p>
              <button
                type="button"
                className="btn primary full"
                disabled={writesBlocked || !snap?.locker || !token}
                onClick={() => {
                  if (demo && (prototype || !snap?.locker || !token)) {
                    setSuccess(FEE_COLLECT_COPY.feesSent);
                    return;
                  }
                  if (!snap?.locker || !token) return;
                  void run(
                    FEE_COLLECT_COPY.collectingFees,
                    () => sendCcaWrite(collectCcaWrite(snap.locker!, token), "collect", writes),
                    FEE_COLLECT_COPY.feesSent,
                  );
                }}
              >
                {pending === FEE_COLLECT_COPY.collectingFees ? FEE_COLLECT_COPY.collectingFees : FEE_COLLECT_COPY.collectFees}
              </button>
            </>
          )}
        </>
      ) : showFeeHint ? (
        <p className="faint small">{FEE_COLLECT_COPY.beforeOpen}</p>
      ) : null}

      {demo ? <p className="faint small">Cash {eth(balance)}</p> : null}
    </section>
  );
}

export function mockRaisedProgress(coin: Coin): string {
  const raised = Math.min(GRADUATION_ETH, Math.max(0, coin.ethRaised));
  return raisedProgressCopy(parseEther(raised.toFixed(18)));
}
