/**
 * Read curve().complete on load and watch Graduated so the page flips live.
 * Missing launchpad → mock path (demo / no chain).
 */
import { useState } from "react";
import { useReadContract, useWatchContractEvent } from "wagmi";
import { contracts, hasLaunchpad } from "./contracts";
import {
  applyCurveComplete,
  applyGraduatedEvent,
  mockGraduationState,
  poolIdFromKey,
  type GraduationState,
} from "./graduation";
import { launchpadAbi } from "./launchpadAbi";
import type { Address } from "viem";

export function useGraduation(token: Address | undefined, mockGraduated: boolean): GraduationState {
  const live = hasLaunchpad() && Boolean(token);
  const [fromEvent, setFromEvent] = useState<GraduationState | null>(null);

  const { data: curve } = useReadContract({
    address: contracts.launchpad,
    abi: launchpadAbi,
    functionName: "curve",
    args: token ? [token] : undefined,
    query: { enabled: live },
  });

  const { data: hook } = useReadContract({
    address: contracts.launchpad,
    abi: launchpadAbi,
    functionName: "hook",
    query: { enabled: live },
  });

  useWatchContractEvent({
    address: contracts.launchpad,
    abi: launchpadAbi,
    eventName: "Graduated",
    args: token ? { token } : undefined,
    enabled: live,
    onLogs(logs) {
      const last = logs[logs.length - 1];
      const evToken = last?.args.token;
      const evPoolId = last?.args.poolId;
      if (!evToken || !evPoolId) return;
      setFromEvent((prev) =>
        applyGraduatedEvent(prev ?? { graduated: false, token: evToken }, {
          token: evToken,
          poolId: evPoolId,
          fee: last.args.fee,
          tickSpacing: last.args.tickSpacing,
          hooks: last.args.hooks,
        }),
      );
    },
  });

  if (!live || !token) {
    return token ? mockGraduationState(token, mockGraduated) : { graduated: mockGraduated };
  }

  let next: GraduationState = {
    graduated: false,
    token,
    hooks: hook,
    poolId: poolIdFromKey(token, hook),
  };
  next = applyCurveComplete(next, Boolean(curve?.[4]));
  if (fromEvent?.poolId) {
    next = applyGraduatedEvent(next, {
      token: fromEvent.token ?? token,
      poolId: fromEvent.poolId,
      hooks: fromEvent.hooks,
    });
  }
  return next;
}
