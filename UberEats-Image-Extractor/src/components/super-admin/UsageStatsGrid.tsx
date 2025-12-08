import React from 'react';
import { Card, CardContent } from '../ui/card';
import {
  BarChart3,
  FileText,
  Image,
  Search,
  Download,
  Upload,
  Sparkles,
  Store,
  Users,
  Palette,
  Target,
  Zap,
  ArrowRight,
  Settings,
  CreditCard,
  UserPlus,
  CheckCircle,
} from 'lucide-react';
import type { UsageStats } from './UsageExporter';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
  cost?: number;
  category: 'extraction' | 'logo' | 'search' | 'export' | 'image' | 'lead' | 'branding' | 'registration';
}

const categoryColors: Record<StatCardProps['category'], string> = {
  extraction: 'text-blue-600 bg-blue-50',
  logo: 'text-purple-600 bg-purple-50',
  search: 'text-green-600 bg-green-50',
  export: 'text-orange-600 bg-orange-50',
  image: 'text-pink-600 bg-pink-50',
  lead: 'text-cyan-600 bg-cyan-50',
  branding: 'text-amber-600 bg-amber-50',
  registration: 'text-indigo-600 bg-indigo-50',
};

function StatCard({ title, value, icon, subtitle, cost, category }: StatCardProps) {
  const colorClass = categoryColors[category];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
            <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
            )}
            {cost !== undefined && cost > 0 && (
              <p className="text-sm font-medium text-green-600 mt-1">
                ${cost.toFixed(2)}
              </p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${colorClass}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface UsageStatsGridProps {
  stats: UsageStats | null;
  loading?: boolean;
}

export function UsageStatsGrid({ stats, loading }: UsageStatsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-4 pb-3">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-16 mb-1" />
              <div className="h-3 bg-gray-200 rounded w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          No usage data available for the selected period.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Total Credits Used</p>
              <p className="text-4xl font-bold mt-1">${Number(stats.total_credits_used).toFixed(2)}</p>
              <p className="text-purple-200 text-sm mt-1">
                {stats.total_extractions.toLocaleString()} total extractions
              </p>
            </div>
            <div className="p-4 bg-white/10 rounded-xl">
              <BarChart3 className="h-10 w-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extraction Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Extractions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard
            title="Standard Extractions"
            value={stats.total_standard_extractions}
            icon={<FileText className="h-5 w-5" />}
            cost={stats.total_standard_extractions * 0.10}
            subtitle="$0.10 each"
            category="extraction"
          />
          <StatCard
            title="Premium Extractions"
            value={stats.total_premium_extractions}
            icon={<Sparkles className="h-5 w-5" />}
            cost={stats.total_premium_extractions * 0.25}
            subtitle="$0.25 each"
            category="extraction"
          />
          <StatCard
            title="Menu Items Extracted"
            value={stats.total_menu_items_extracted}
            icon={<FileText className="h-5 w-5" />}
            category="extraction"
          />
          <StatCard
            title="Restaurants Created"
            value={stats.total_restaurants_created}
            icon={<Store className="h-5 w-5" />}
            category="extraction"
          />
        </div>
      </div>

      {/* Logo Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Logos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard
            title="Logo Extractions"
            value={stats.total_logos_extracted}
            icon={<Image className="h-5 w-5" />}
            cost={stats.total_logos_extracted * 0.15}
            subtitle="$0.15 each"
            category="logo"
          />
          <StatCard
            title="Logo Processing"
            value={stats.total_logos_processed}
            icon={<Image className="h-5 w-5" />}
            cost={stats.total_logos_processed * 0.20}
            subtitle="$0.20 each"
            category="logo"
          />
        </div>
      </div>

      {/* Search Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Search & Platform
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard
            title="Google Searches"
            value={stats.total_google_search_extractions}
            icon={<Search className="h-5 w-5" />}
            cost={stats.total_google_search_extractions * 0.05}
            subtitle="$0.05 each"
            category="search"
          />
          <StatCard
            title="Platform Details"
            value={stats.total_platform_details_extractions}
            icon={<Search className="h-5 w-5" />}
            cost={stats.total_platform_details_extractions * 0.05}
            subtitle="$0.05 each"
            category="search"
          />
        </div>
      </div>

      {/* Export Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Exports
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard
            title="CSV Downloads"
            value={stats.total_csv_without_images}
            icon={<Download className="h-5 w-5" />}
            cost={stats.total_csv_without_images * 0.01}
            subtitle="$0.01 each"
            category="export"
          />
          <StatCard
            title="CSV with Images"
            value={stats.total_csv_with_images}
            icon={<Download className="h-5 w-5" />}
            cost={stats.total_csv_with_images * 0.02}
            subtitle="$0.02 each"
            category="export"
          />
        </div>
      </div>

      {/* Image Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Images
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard
            title="CDN Uploads"
            value={stats.total_images_uploaded_to_cdn}
            icon={<Upload className="h-5 w-5" />}
            cost={stats.total_images_uploaded_to_cdn * 0.001}
            subtitle="$0.001 each"
            category="image"
          />
          <StatCard
            title="ZIP Downloads"
            value={stats.total_image_zip_downloads}
            icon={<Download className="h-5 w-5" />}
            cost={stats.total_image_zip_downloads * 0.05}
            subtitle="$0.05 each"
            category="image"
          />
          <StatCard
            title="Images Downloaded"
            value={stats.total_images_downloaded}
            icon={<Image className="h-5 w-5" />}
            category="image"
          />
        </div>
      </div>

      {/* Lead Scraping Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Lead Scraping
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard
            title="Scrape Jobs"
            value={stats.total_lead_scrape_jobs}
            icon={<Target className="h-5 w-5" />}
            cost={stats.total_lead_scrape_jobs * 1.00}
            subtitle="$1.00 each"
            category="lead"
          />
          <StatCard
            title="API Calls"
            value={stats.total_lead_scrape_api_calls}
            icon={<Zap className="h-5 w-5" />}
            cost={stats.total_lead_scrape_api_calls * 0.05}
            subtitle="$0.05 each"
            category="lead"
          />
          <StatCard
            title="Leads Converted"
            value={stats.total_leads_converted}
            icon={<ArrowRight className="h-5 w-5" />}
            cost={stats.total_leads_converted * 0.25}
            subtitle="$0.25 each"
            category="lead"
          />
        </div>
      </div>

      {/* Branding Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Branding
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard
            title="Branding Extractions"
            value={stats.total_branding_extractions}
            icon={<Palette className="h-5 w-5" />}
            cost={stats.total_branding_extractions * 0.20}
            subtitle="$0.20 each"
            category="branding"
          />
        </div>
      </div>

      {/* Registration Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Registration (Tracking Only)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard
            title="User Accounts"
            value={stats.total_user_accounts_registered}
            icon={<UserPlus className="h-5 w-5" />}
            category="registration"
          />
          <StatCard
            title="Restaurants"
            value={stats.total_restaurants_registered}
            icon={<Store className="h-5 w-5" />}
            category="registration"
          />
          <StatCard
            title="Menus Uploaded"
            value={stats.total_menus_uploaded}
            icon={<FileText className="h-5 w-5" />}
            category="registration"
          />
          <StatCard
            title="Setups Finalized"
            value={stats.total_setups_finalized}
            icon={<CheckCircle className="h-5 w-5" />}
            category="registration"
          />
        </div>
      </div>
    </div>
  );
}
