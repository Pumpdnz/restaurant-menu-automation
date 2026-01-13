import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Opportunity } from '@/hooks/useLeadScrapeAnalytics';
import { formatDistanceToNow } from 'date-fns';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onStartScrape: (opportunity: Opportunity) => void;
  onViewDetails?: (opportunity: Opportunity) => void;
}

const priorityColors = {
  high: 'border-l-red-500 bg-red-50/50',
  medium: 'border-l-yellow-500 bg-yellow-50/50',
  low: 'border-l-green-500 bg-green-50/50',
};

const priorityBadgeColors = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const priorityLabels = {
  high: 'High Priority',
  medium: 'Medium Priority',
  low: 'Low Priority',
};

export function OpportunityCard({
  opportunity,
  onStartScrape,
  onViewDetails,
}: OpportunityCardProps) {
  const lastScrapedText = opportunity.last_scraped
    ? formatDistanceToNow(new Date(opportunity.last_scraped), { addSuffix: true })
    : 'Never scraped';

  return (
    <Card className={cn('border-l-4', priorityColors[opportunity.priority])}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              {opportunity.city} - {opportunity.cuisine}
            </CardTitle>
            <Badge
              variant="outline"
              className={cn('mt-1 text-xs', priorityBadgeColors[opportunity.priority])}
            >
              {priorityLabels[opportunity.priority]}
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{opportunity.opportunity_score}</div>
            <div className="text-xs text-muted-foreground">Score</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <span className="text-muted-foreground">Current Leads:</span>
            <span className="ml-2 font-medium">{opportunity.current_leads}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Max Page:</span>
            <span className="ml-2 font-medium">{opportunity.current_max_page}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Suggested Start:</span>
            <span className="ml-2 font-medium">Page {opportunity.suggested_page_offset}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Last Scraped:</span>
            <span className="ml-2 font-medium">{lastScrapedText}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onStartScrape(opportunity)}
          >
            <Play className="h-4 w-4 mr-1" />
            Start Scrape
          </Button>
          {onViewDetails && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewDetails(opportunity)}
            >
              <Info className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
