import * as React from 'react';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CityBreakdownTab } from './CityBreakdownTab';
import { OpportunitiesTab } from './OpportunitiesTab';
import { AnalyticsFilters, Opportunity } from '@/hooks/useLeadScrapeAnalytics';
import { Grid, Target } from 'lucide-react';

interface ReportsTabContentProps {
  onStartScrape: (params: { city: string; cuisine: string; pageOffset?: number }) => void;
}

export function ReportsTabContent({ onStartScrape }: ReportsTabContentProps) {
  const [subTab, setSubTab] = useState('breakdown');
  const [filters] = useState<AnalyticsFilters>({});

  const handleOpportunityStartScrape = (opportunity: Opportunity) => {
    onStartScrape({
      city: opportunity.city,
      cuisine: opportunity.cuisine,
      pageOffset: opportunity.suggested_page_offset,
    });
  };

  const handleHeatmapStartScrape = (city: string, cuisine: string, pageOffset?: number) => {
    onStartScrape({ city, cuisine, pageOffset });
  };

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="breakdown" className="gap-1">
            <Grid className="h-4 w-4" />
            City Breakdown
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-1">
            <Target className="h-4 w-4" />
            Opportunities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="mt-4">
          <CityBreakdownTab
            filters={filters}
            onStartScrape={handleHeatmapStartScrape}
          />
        </TabsContent>

        <TabsContent value="opportunities" className="mt-4">
          <OpportunitiesTab
            filters={filters}
            onStartScrape={handleOpportunityStartScrape}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
