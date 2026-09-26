# Prophecy — Product Requirements

**What this is:** the "what and why" of Prophecy, written for the whole team. It is meant for new developers, teammates who do not write code, and anyone judging or trying the product.

**What this is not:** the exact mechanics. Numbers, formulas and contract rules live in [`SPEC.md`](SPEC.md). Settled choices and their reasons live in [`DECISIONS.md`](DECISIONS.md). When this file and those two disagree, they win.

| | |
|---|---|
| Status | Draft. Open for team feedback (see [Open questions](#13-open-questions)) |
| Owner | @akyung123 |
| Network | Sepolia (Ethereum test network). No real money |
| Last updated | 2026-09-26 |

---

## 1. One line

**Launch a prophecy. It starts trading the moment you say it.**

You write one sentence. That sentence becomes a token with its own readable name. Anyone can buy it, and anyone can sell it.

## 2. The idea in plain words

A memecoin is a token that stands for a joke or a picture. People buy it because others are buying it. There is usually nothing behind it and nobody is on record as its author.

Prophecy keeps the fun of a memecoin and swaps the picture for **a one-line sentence**, signed with **a name**:

> `ringo.prophecy.eth` says: *"Every hackathon badge is an ENS name by 2028."*
> That prophecy is `badges-2028.ringo.prophecy.eth`, and you can buy it right now.

Three things make it different from a plain memecoin:

1. **It has an author.** Every prophecy sits under the prophet's name, forever. You can always see who said it first.
2. **It cannot be edited.** Once issued, nobody can change the sentence. Not the prophet, not the team.
3. **It has a readable address.** You find and buy a prophecy by typing its name, not by pasting `0x…`.

What Prophecy does **not** do: it never decides whether a prophecy came true. There is no referee, no "True / False" and no payout to the side that was right. The price shows **how many people are here**, not whether the sentence is true.

## 3. The problem

People want their opinions to carry weight. Today they have few ways to turn "I believe this" into a lasting public record:

| Today | What goes wrong |
|---|---|
| Posting a bold take on social media | Posts can be edited or deleted. There is no lasting authorship record |
| Launching a memecoin | The coin means nothing and has no author on record. The creator can make a new wallet and start over |
| Sharing a token | A token is a 42-character `0x…` address. Hard to read, easy to fake |
| Prediction markets | Need a referee (an oracle) to decide the outcome. Slow, disputed and complicated |

Prophecy gives an opinion three things: **a permanent author**, **a readable name** and **a price that moves when people agree or disagree with their money**.

## 4. What a prophet gets

"Prophet" is the person who issues a prophecy. They get two things:

1. **A permanent record that they said it first.** The prophecy's name hangs under the prophet's name (`badges-2028.ringo.prophecy.eth`) and never expires. Nobody can remove it or claim that label again.
2. **A share of every trade.** Each buy or sell on the prophecy pays a small fee, and part of it goes to the prophet. This keeps going after the prophecy "graduates" to Uniswap (see [section 7](#7-how-it-works)).

What a prophet does **not** get:

- **Free tokens.** A prophet starts with zero. They can buy first in the same step as issuing, at the same price as anyone else.
- **Money for being right.** Fees come from people trading, not from the prophecy coming true. A popular wrong prophecy collects more fees than an ignored right one.
- **Control over the sentence.** After issuing, the prophet cannot edit it either.

## 5. Who it is for

| User | What they want | What they do |
|---|---|---|
| **Memecoin traders** | A new, fast thing to trade that is easy to find and share | Buy or sell, leave a one-line memo with each trade |
| **People with strong opinions** (creators, founders, analysts, fans) | Make a bold public call and have it on record under their name | Verify once, get a prophet name, issue prophecies, collect fees when people trade them |
| **Communities that rally around a shared belief** | A public place to put money behind what the group believes | Buy and hold a prophecy together, point others to it by name |

> **Needs team feedback.** Two groups fit the third row naturally: **political communities** and **religious or cult-like groups**. Both are made of people who want their beliefs to carry weight, which is exactly what Prophecy offers. It is also a sensitive positioning, and we have not agreed on whether to name it publicly. Please comment on the PR.

Who is **not** a target right now:

- People who want to bet on outcomes and be paid when they are right. That is a prediction market, and Prophecy is deliberately not one (DECISIONS #1).
- Anyone who needs mainnet or real money. Everything runs on Sepolia.

## 6. Principles

These are settled. Changing one means a new row in [`DECISIONS.md`](DECISIONS.md), agreed by a person.

1. **No judging.** No oracle, no True / False, no payout. There is no status about the sentence. The only stage the product shows is the market stage (auction, graduated or ended), read from the chain. (#1, #18)
2. **Written once, never edited.** The sentence lives only in that prophecy's own ENS record, and nobody holds the permission to change it. It is not stored in Launchpad storage or in the `Launched` event. There is no deadline. (#5, #18)
3. **The name is the product.** `ringo.prophecy.eth` → the prophet's wallet. `badges-2028.ringo.prophecy.eth` → the prophecy's token. (#8)
4. **One prophet name per person.** A human check (World ID) happens once, when you create your prophet name. Browsing and buying need no check. (#10)
5. **Liquidity cannot be pulled.** When a prophecy sells out on the curve, its money moves into a Uniswap pool and is locked. Nobody can withdraw it; only trading fees come out. (#11)
6. **One network: Sepolia.** (#3)

## 7. How it works

Life of one prophecy, in five steps.

```text
1. Verify      A person proves they are human with World ID.       (once per person)
                 └─ they receive a prophet name:  ringo.prophecy.eth → their wallet

2. Issue       The prophet writes one sentence.
                 └─ a prophecy name is created:   badges-2028.ringo.prophecy.eth → token
                 └─ the sentence is locked forever

3. Trade       Anyone buys or sells by name.
                 └─ buying raises the price, selling lowers it
                 └─ each trade can carry a one-line memo

4. Sold out     All tokens for sale on the curve are bought → "graduation".
                 └─ the money and the rest of the tokens move into a Uniswap pool
                 └─ that pool is locked; trading continues there
```

Nothing is ever deleted. The name keeps pointing at the token at every step.

### The numbers a teammate should know

All of these are demo-sized so people can see things happen during a live event. Full detail: [`SPEC.md`](SPEC.md) "Constants".

| What | Value | What it means for a user |
|---|---|---|
| Tokens per prophecy | 1,000,000,000 | 793.1 million sold on the curve, 206.9 million go to the Uniswap pool at graduation |
| Money needed to graduate | **0.02 test ETH** | A handful of people can graduate a prophecy in one session |
| A 0.001 test ETH buy at launch | about **16.6%** of the curve supply | The first 0.001 ETH buy takes that share; a later buy of the same size takes fewer tokens |
| Fee on every curve trade | **1.25%** | 0.30% to the prophet, 0.95% to the protocol |
| Fee after graduation | 1% Uniswap pool fee | Split 24 : 76 (prophet : protocol) |

**Why the price moves:** there is no order book. The price is set by a formula (a "bonding curve"): every buy leaves fewer tokens for sale, so the next token costs more. Every sell puts tokens back, so the price drops. The formula never runs out of tokens and never needs a referee.

## 8. What each person can do

### A visitor (no wallet needed to look)

- See the list of prophecies: newest first, and top by market cap.
- Open a prophecy by its name and read the sentence, price and recent trades with their memos.
- Open a prophet's page and see everything they have issued (prototype data).

### A buyer (wallet, no World ID)

- Buy a prophecy by name. Choose an amount, see the estimated tokens before confirming.
- Sell some or all of it back.
- Attach an optional one-line memo (up to 140 bytes, about 140 English letters) to a buy or sell, e.g. "0.1 ETH in · here we go" or "sold half · see you at graduation". The memo is part of the trade itself, so every memo is backed by a real trade. (#15)

### A prophet (wallet and World ID)

- Verify with World ID once and pick a prophet name (3–16 letters or digits). If verification is cancelled or fails, issuing stays off. Buying and browsing still work.
- Issue a prophecy: a short name (slug), and one sentence (up to 140 characters).
- Collect their fees at any time from the prophet page.
- Edit display details such as the avatar. The sentence cannot be edited.

What nobody can do, including the team: edit a sentence, move a name to another wallet, delete a prophecy, or withdraw the locked pool money.

## 9. Screens

Four screens. Look: black, navy, gold and paper, Fraunces serif (v2 design, supersedes DECISIONS #2).

| # | Screen | Must show | Must never show |
|---|---|---|---|
| 1 | **Prophecy list** | Name, sentence, price | Any "right / wrong" label |
| 2 | **Issue** | World ID step; the issue button only turns on after verification | An issue button that works without verification |
| 3 | **Prophecy detail** | Found by name; buy and sell; recent trades with memos | True / False, odds, "probability" |
| 4 | **Prophet page** | Wallet, every prophecy under the name, claimable fees | A plain balance screen with nothing to act on |

**On main today.** Helpers in `web/src/lib/ens.ts` can read the `prophecy` text record; list, detail and prophet pages still use prototype data, not live ENS. Nothing in the app's code is the live sentence: sample copy lives in `web/src/lib/mock.ts` for the prototype only.

## 10. Example prophecies

Illustrations for talks, mockups and test data. The live sentences exist only on chain.

| Prophet | Prophecy name | Sentence | Kind |
|---|---|---|---|
| `ringo` | `badges-2028` | Every hackathon badge is an ENS name by 2028 | Tech |
| `ringo` | `two-min` | A two-minute demo has already left the stage | Demo |
| `mina` | `agents-pay-2027` | By 2027 most onchain payments are sent by AI agents | Tech |
| `mina` | `ai-hot100-2027` | A fully AI-generated song tops the Billboard Hot 100 by 2027 | Culture |
| `jun` | `asia-final-2030` | An Asian team plays in the 2030 World Cup final | Sports |
| `jun` | `seoul-snow-xmas` | It snows in Seoul on Christmas Day this year | Everyday |
| `hana` | `ships-by-sunday` | This team ships a working demo before judging starts | Hackathon |

Rules these follow (INTERFACE section 1): prophet names are 3–16 characters of `a-z` and `0-9`; prophecy names are 3–32 characters of `a-z`, `0-9` and `-`; a sentence is 1–140 characters.

## 11. Scope

### In scope for the hackathon

- Prophet names with World ID, one per person.
- Issuing prophecies with a locked sentence (`Launchpad.launch` writes it to ENS). **Not built on main:** the web app does not send that `launch` yet.
- Buy and sell on the bonding curve, with memos. **Not built on main:** the web app does not send real buy or sell transactions.
- Graduation into a locked Uniswap V4 pool, with fees split to the prophet and the protocol.
- The four screens. **On main:** issue can send `registerProphet`; list, detail and prophet pages still use prototype data. Reading live names and sentences from ENS on those screens is not built.
- A 2–4 minute demo (SPEC "Demo"):
  1. Verification succeeds and a prophet name is created.
  2. A sentence is issued and its name points to the token. **Not built on main:** no `launch` transaction from the app.
  3. Another wallet buys by name, and selling lowers the price. **Not built on main:** no on-chain buy or sell from the app.
  4. The prophet page lists every prophecy under the name.
  5. Failure paths: a second wallet cannot issue, editing the sentence fails, cancelling verification blocks issuing.

### Later, if there is time

- A holder-only discussion board (DECISIONS #15 left it for later).
- An agent that drafts a prophecy, with the person verifying again before it is created.
- Paying out fees automatically on every pool trade.

### Out of scope

- Deciding right or wrong. Paying the side that was right.
- Different curves per prophecy.
- Withdrawing liquidity after graduation.
- Mainnet and real money.

## 12. What success looks like

### At the hackathon

| Goal | How we know |
|---|---|
| **The demo is real** | All five demo scenes run as real Sepolia transactions, with links to each one |
| **The names are real** | `ringo.prophecy.eth` and a prophecy name resolve to the right addresses in a tool outside our app |
| **Graduation is real** | At least one prophecy sells out and opens a locked Uniswap pool on Sepolia |
| **People actually use it** | Other hackathon participants buy our prophecies, issue their own and leave memos |

The last goal matters most. If someone asks "why does this matter?", the best answer is on chain: *this many different people bought a prophecy*. Buying is cheap (a 0.001 test ETH buy already moves the price) and needs no verification, so a link or a QR code is enough to get someone started.

### How we measure it

Everything is counted from public on-chain events. There is no tracking server.

| Metric | Source |
|---|---|
| Different wallets that traded | `Trade` events, unique `trader` |
| Prophet names created (one per human) | `ProphetRegistered` events |
| Prophecies issued | `Launched` events |
| Trades with a memo | `Trade` events with a non-empty `memo` |
| Graduations | `Graduated` events |

Targets for each number: **not set yet** (see open questions).

### Getting people to try it at the event

- **Share a link or QR code** to one of our prophecies so people can buy in seconds.
- **Invite participants to issue their own** prophecy under their own prophet name (needs World ID).
- **Not decided:** how people without Sepolia ETH get some (a faucet link, or the team sending small amounts).

## 13. Open questions

Please answer these in the PR or bring them to the team. Once one is answered, the answer goes into [`DECISIONS.md`](DECISIONS.md) as a new row.

| # | Question | Why it matters |
|---|---|---|
| 1 | Do we name political and religious / cult-like communities as target users in public materials? | Strong fit for "opinions that carry weight", but sensitive positioning |
| 2 | A sentence can never be edited or deleted, even by us. What does the app do with an abusive or illegal one? (e.g. hide it in our UI only) | Permanence is a feature, but we still choose what our own screens show |
| 3 | How do event participants without Sepolia ETH get some? | Real users are the main success goal |
| 4 | What are our target numbers for traders, prophets and graduations at the event? | Gives the team something to aim for |
| 5 | Parent name: is `prophecy.eth` free on Sepolia? | Every name hangs under it (DECISIONS "Not decided yet") |
| 6 | Which wallet receives the protocol fee? | Needed before deploying (DECISIONS "Not decided yet") |
| 7 | Do we run the final ENS lock before or during the demo? | Showing the lock live is stronger, but riskier |

## 14. Risks

| Risk | What we do about it |
|---|---|
| People read the price as "the chance this comes true" | Never use words like odds, probability, true or false in the product. The price means "people are here" |
| The World ID server is asleep when the demo starts (free hosting sleeps) | Wake it with a health check right before recording ([`infra/README.md`](../infra/README.md)) |
| Scene 1 can only be recorded once per person (one World ID, one name) | Rehearse on a local or forked chain first ([`PLAN.md`](PLAN.md) section 5) |
| An outside ENS app cannot read Sepolia ENSv2 names yet | Use the lookup script in `infra/` as evidence |

## 15. Where to go next

| If you want to… | Read |
|---|---|
| See what is built today and run it | [`../README.md`](../README.md) |
| Know the exact rules and numbers | [`SPEC.md`](SPEC.md) |
| Know why something is the way it is | [`DECISIONS.md`](DECISIONS.md) |
| Build against another folder | [`INTERFACE.md`](INTERFACE.md) |
| Pick up a task | [`PLAN.md`](PLAN.md) |
| Learn how we work (branches, PRs) | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |
