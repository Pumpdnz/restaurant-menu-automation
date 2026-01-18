import * as React from 'react';
import { useState } from 'react';
import { CityBreakdownTab } from './CityBreakdownTab';
import { AnalyticsFilters } from '@/hooks/useLeadScrapeAnalytics';

interface ReportsTabContentProps {
  onStartScrape: (params: { city: string; cuisine: string; pageOffset?: number }) => void;
}

export function ReportsTabContent({ onStartScrape }: ReportsTabContentProps) {
  const [filters] = useState<AnalyticsFilters>({});

  const handleHeatmapStartScrape = (city: string, cuisine: string, pageOffset?: number) => {
    onStartScrape({ city, cuisine, pageOffset });
  };

  return (
    <div className="space-y-4">
      <CityBreakdownTab
        filters={filters}
        onStartScrape={handleHeatmapStartScrape}
      />
    </div>
  );
}
