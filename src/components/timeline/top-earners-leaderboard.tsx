"use client";

import { Coins } from "lucide-react";
import React, { useMemo } from "react";

interface WalletBalance {
  author: string;
  totalEth: number;
  totalUsd: number;
  bucket0Eth: number;
  bucket1Eth: number;
  bucket2Eth: number;
  bucket3Eth: number;
}

interface TopEarnersLeaderboardProps {
  walletBalances: Record<string, WalletBalance>;
  currentEthPrice: number;
  topN?: number;
}

export const TopEarnersLeaderboard: React.FC<TopEarnersLeaderboardProps> = ({
  walletBalances,
  currentEthPrice,
  topN = 10,
}) => {
  // Sort by USD balance and take top N
  const topEarners = useMemo(() => {
    return Object.values(walletBalances)
      .sort((a, b) => b.totalUsd - a.totalUsd)
      .slice(0, topN);
  }, [walletBalances, topN]);

  if (topEarners.length === 0) {
    return null;
  }

  const maxBalance = topEarners[0]?.totalUsd || 1;

  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Coins className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Top Earners (Current Value)</h3>
        <div className="text-xs text-muted-foreground ml-auto">
          @ ${currentEthPrice.toFixed(0)}/ETH
        </div>
      </div>

      <div className="space-y-1.5 h-[400px] overflow-y-auto">
        {topEarners.map((earner, index) => (
          <div
            key={earner.author}
            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
            style={{
              animation: `slideIn 0.2s ease-out ${index * 0.03}s both`,
            }}
          >
            {/* Avatar with rank badge */}
            <div className="relative flex-shrink-0">
              <img
                src={`https://github.com/${earner.author}.png`}
                alt={earner.author}
                className="w-7 h-7 rounded-full"
              />
              {index < 3 && (
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold border border-card ${
                    index === 0
                      ? "bg-yellow-500 text-yellow-950"
                      : index === 1
                      ? "bg-gray-400 text-gray-950"
                      : "bg-orange-500 text-orange-950"
                  }`}
                >
                  {index + 1}
                </div>
              )}
            </div>

            {/* Author */}
            <div className="flex-1 min-w-0 text-sm font-medium truncate">
              {earner.author}
            </div>

            {/* Balance Bar */}
            <div className="hidden sm:block w-24 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{
                  width: `${(earner.totalUsd / maxBalance) * 100}%`,
                }}
              />
            </div>

            {/* ETH Amount */}
            <div className="text-xs text-muted-foreground font-mono whitespace-nowrap">
              {earner.totalEth.toFixed(3)} ETH
            </div>

            {/* USD Amount */}
            <div className="flex-shrink-0 text-sm font-bold font-mono text-primary whitespace-nowrap">
              $
              {earner.totalUsd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};
