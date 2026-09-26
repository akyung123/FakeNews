import { Link } from "react-router-dom";
import { ago, mcap, pct, trend } from "../lib/format";
import { YOU, marketCap, type Coin, type Comment } from "../lib/store";

/** A holder's post with the badge that makes the feed: their entry and how it's doing right now. */
export function CommentItem({ comment, coin, showCoin }: { comment: Comment; coin: Coin; showCoin?: boolean }) {
  const change = marketCap(coin) / comment.entryMcap - 1;
  return (
    <li className={`post${comment.user === YOU ? " is-you" : ""}`}>
      <div className="post-body">
        <div className="post-head">
          <strong>{comment.user}</strong>
          <span className={`hold ${trend(change)}`}>Holder {pct(change)}</span>
        </div>
        <p className="post-text">{comment.text}</p>
        <p className="post-meta">
          {showCoin ? (
            <>
              <Link to={`/coin/${coin.id}`}>${coin.ticker}</Link> ·{" "}
            </>
          ) : null}
          bought at {mcap(comment.entryMcap)} MC · {ago(comment.at)}
        </p>
      </div>
    </li>
  );
}
