import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Share2 } from 'lucide-react';

interface PostsTabProps {
  onError?: (error: Error) => void;
}

const PostsTab: React.FC<PostsTabProps> = ({ onError }) => {
  return (
    <div className="py-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium">Social Media Posts</h3>
        <p className="text-sm text-muted-foreground">
          Schedule and publish content to social platforms
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Share2 className="w-5 h-5 text-primary" />
            <CardTitle>Post Management</CardTitle>
          </div>
          <CardDescription>
            Create, schedule, and publish posts across multiple social media platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Share2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Social media publishing features coming soon</p>
            <p className="text-xs mt-2">Will integrate with Instagram, Facebook, TikTok, and more</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PostsTab;
