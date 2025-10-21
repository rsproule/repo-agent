'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { useAttributionQuartiles } from '@/hooks/use-attribution';
import { cn } from '@/lib/utils';
import type {
  AttributionPreFilters,
  AttributionPostFilters,
  AttributionOverrides,
  Quartile as ExistingQuartile,
} from '@/lib/attribution';

interface Props {
  owner: string;
  repo: string;
  preFilters?: AttributionPreFilters;
  postFilters?: AttributionPostFilters;
  overrides?: AttributionOverrides;
  isEnabled?: boolean;
}

export const QuartilesChart: React.FC<Props> = ({
  owner,
  repo,
  preFilters,
  postFilters,
  overrides,
  isEnabled = true,
}) => {
  const { data: quartiles, isLoading } = useAttributionQuartiles(
    owner,
    repo,
    preFilters,
    postFilters,
    overrides,
    { enabled: isEnabled }
  );

  if (!isEnabled) return null;

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded animate-pulse w-32" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!quartiles || quartiles.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500">
          No quartile data available
        </div>
      </Card>
    );
  }

  const maxCount = Math.max(...quartiles.map(q => q.count));

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">PR Score Quartiles</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quartiles.map((quartile) => (
            <QuartileCard
              key={quartile.quartileIndex}
              quartile={quartile}
              maxCount={maxCount}
            />
          ))}
        </div>
        <div className="text-xs text-gray-500">
          <p>Each quartile represents PRs grouped by their contribution scores.</p>
          <p>Higher quartiles typically represent more impactful contributions.</p>
        </div>
      </div>
    </Card>
  );
};

const QuartileCard: React.FC<{
  quartile: ExistingQuartile;
  maxCount: number;
}> = ({ quartile, maxCount }) => {
  const bucketColors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500'];
  const bucketColorClass = bucketColors[quartile.quartileIndex] || 'bg-gray-500';

  const heightPercentage = maxCount > 0 ? (quartile.count / maxCount) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="h-20 bg-gray-100 rounded flex items-end">
          <div
            className={cn('w-full rounded-b transition-all duration-300', bucketColorClass)}
            style={{ height: `${heightPercentage}%` }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-white drop-shadow-md">
            {quartile.count}
          </span>
        </div>
      </div>
      <div className="text-center space-y-1">
        <div className="text-sm font-medium">
          Bucket {quartile.quartileIndex}
        </div>
        <div className="text-xs text-gray-600">
          {(quartile.aggregatePct * 100).toFixed(1)}% of total
        </div>
        <div className="text-xs text-gray-500">
          Score: {quartile.minPct.toFixed(2)} - {quartile.maxPct.toFixed(2)}
        </div>
      </div>
    </div>
  );
};