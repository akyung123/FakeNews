/**
 * Permit2 `IAllowanceTransfer`, the second step before a token → ETH swap.
 * INTERFACE_CCA §4.7: (1) token `approve` to Permit2, once per token;
 * (2) `permit2.approve(token, router, amount, expiration)`.
 *
 * Sepolia Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`.
 * https://github.com/Uniswap/permit2/blob/cc56ad0/src/interfaces/IAllowanceTransfer.sol#L123
 */
export const permit2Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
  {
    type: "error",
    name: "InsufficientAllowance",
    inputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "error",
    name: "AllowanceExpired",
    inputs: [{ name: "deadline", type: "uint256" }],
  },
] as const;

/** `uint160` cap on a Permit2 allowance amount. */
export const PERMIT2_MAX_AMOUNT = (1n << 160n) - 1n;

/** `uint48` cap on a Permit2 expiration. */
export const PERMIT2_MAX_EXPIRATION = (1n << 48n) - 1n;
