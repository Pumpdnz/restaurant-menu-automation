import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSearchParams } from 'react-router-dom';
import { Video, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import VideosTab from './social-media/VideosTab';
import ManageTab from './social-media/ManageTab';
import ImagesTab from './social-media/ImagesTab';
import PostsTab from './social-media/PostsTab';
import PerformanceTab from './social-media/PerformanceTab';

interface SocialMediaDashboardProps {
  initialTab?: string;
}

const SocialMediaDashboard: React.FC<SocialMediaDashboardProps> = ({ initialTab }) => {
  // Use search params for tab state
  const [searchParams, setSearchParams] = useSearchParams();

  // Get the active tab from URL parameters or use initial/default
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(initialTab || tabFromUrl || 'videos');

  const [tabError, setTabError] = useState<string | null>(null);

  // Update active tab when URL parameters change
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Update active tab when initialTab prop changes
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
      // Update the URL to match the initialTab
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('tab', initialTab);
      setSearchParams(newSearchParams);
    }
  }, [initialTab, setSearchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Update URL with new tab
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', value);
    setSearchParams(newSearchParams);
    // Reset error state when changing tabs
    setTabError(null);
  };

  const handleTabError = (error: Error) => {
    setTabError(error.message || 'An error occurred while loading this tab');
  };

  const handleRetry = () => {
    setTabError(null);
  };

  return (
    <div className="space-y-6 min-h-[calc(100vh+1px)] w-full max-w-full overflow-hidden">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Video className="w-6 h-6 text-primary" />
                <CardTitle>Social Media Content</CardTitle>
              </div>
              <CardDescription>
                Generate and manage AI-powered videos and images for your social media
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap h-auto w-full mb-4">
              <TabsTrigger value="videos" className="sm:flex-[1_0_21%] lg:flex-[1_0_18%]">
                Videos
              </TabsTrigger>
              <TabsTrigger value="images" className="sm:flex-[1_0_21%] lg:flex-[1_0_18%]">
                Images
              </TabsTrigger>
              <TabsTrigger value="manage" className="sm:flex-[1_0_21%] lg:flex-[1_0_18%]">
                Manage
              </TabsTrigger>
              <TabsTrigger value="posts" className="sm:flex-[1_0_21%] lg:flex-[1_0_18%]">
                Posts
              </TabsTrigger>
              <TabsTrigger value="performance" className="sm:flex-[1_0_21%] lg:flex-[1_0_18%]">
                Performance
              </TabsTrigger>
            </TabsList>

            {tabError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <p>{tabError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="w-fit"
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <TabsContent value="videos">
              <VideosTab onError={handleTabError} />
            </TabsContent>

            <TabsContent value="images">
              <ImagesTab onError={handleTabError} />
            </TabsContent>

            <TabsContent value="manage">
              <ManageTab onError={handleTabError} />
            </TabsContent>

            <TabsContent value="posts">
              <PostsTab onError={handleTabError} />
            </TabsContent>

            <TabsContent value="performance">
              <PerformanceTab onError={handleTabError} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SocialMediaDashboard;
