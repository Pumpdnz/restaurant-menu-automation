import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface PerformanceTabProps {
  onError?: (error: Error) => void;
}

const PerformanceTab: React.FC<PerformanceTabProps> = ({ onError }) => {
  return (
    <div className="py-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium">Performance Analytics</h3>
        <p className="text-sm text-muted-foreground">
          Track engagement and performance metrics for your social content
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <CardTitle>Analytics & Insights</CardTitle>
          </div>
          <CardDescription>
            View engagement metrics, reach, and performance data across platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Performance analytics coming soon</p>
            <p className="text-xs mt-2">Will include: engagement metrics, reach, impressions, and conversion tracking</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceTab;
