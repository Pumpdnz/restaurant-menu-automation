import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { BarChart3, Download } from 'lucide-react';
import { Button } from '../ui/button';

export function SuperAdminUsage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usage Statistics</h2>
          <p className="text-gray-500">Monitor usage and prepare billing data</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Usage Data
        </Button>
      </div>

      {/* Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
            Coming in Phase 4
          </CardTitle>
          <CardDescription>
            Usage statistics and billing preparation will be implemented in Phase 4 of the Super Admin Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500 space-y-2">
            <p>Planned metrics:</p>
            <ul className="list-disc list-inside ml-2">
              <li>Total credits used per organization</li>
              <li>Extraction counts (Standard & Premium)</li>
              <li>Menu items extracted</li>
              <li>Logo extractions and processing</li>
              <li>CSV downloads (with/without images)</li>
              <li>Image uploads and downloads</li>
              <li>Date range filtering</li>
              <li>Export to CSV for billing</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}