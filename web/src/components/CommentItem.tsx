import { Link } from "react-router-dom";
import { ago } from "../lib/format";
import { YOU, type Coin, type Comment } from "../lib/store";

/** A trade memo with a plain Holder badge. */
export function CommentItem({ comment, coin, showCoin }: { comment: Comment; coin: Coin; showCoin?: boolean }) {
  return (
    <li className={`post${comment.user === YOU ? " is-you" : ""}`}>
      <div className="post-body">
        <div className="post-head">
          <strong>{comment.user}</strong>
          <span className="hold">Holder</span>
        </div>
        <p className="post-text">{comment.text}</p>
        <p className="post-meta">
          {showCoin ? (
            <>
              <Link to={`/coin/${coin.id}`}>${coin.ticker}</Link> ·{" "}
            </>
          ) : null}
          {ago(comment.at)}
        </p>
      </div>
    </li>
  );
}
