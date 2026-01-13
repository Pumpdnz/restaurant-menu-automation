import * as React from 'react';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HeatmapGrid } from './visualizations/HeatmapGrid';
import { StatCard } from './visualizations/StatCard';
import {
  useAnalyticsCoverage,
  useAnalyticsHeatmap,
  useAnalyticsSummary,
  AnalyticsFilters
} from '@/hooks/useLeadScrapeAnalytics';
import {
  Download,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  BarChart3,
  Users,
  MapPin,
  Utensils
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface CityBreakdownTabProps {
  filters: AnalyticsFilters;
  onStartScrape?: (city: string, cuisine: string, pageOffset?: number) => void;
}

// Top 10 cuisines to track
const TOP_CUISINES = [
  { slug: 'bbq', label: 'BBQ' },
  { slug: 'burger', label: 'Burger' },
  { slug: 'chinese', label: 'Chinese' },
  { slug: 'indian', label: 'Indian' },
  { slug: 'italian', label: 'Italian' },
  { slug: 'mexican', label: 'Mexican' },
  { slug: 'pizza', label: 'Pizza' },
  { slug: 'pollo', label: 'Pollo' },
  { slug: 'thai', label: 'Thai' },
  { slug: 'vietnamese', label: 'Viet' },
];

// Get color class based on total pages scraped
function getCoverageColor(totalPages: number): string {
  if (totalPages === 0) return 'bg-muted text-muted-foreground';
  if (totalPages >= 10) return 'bg-green-600 text-white';
  if (totalPages >= 8) return 'bg-green-500 text-gray-900';
  if (totalPages >= 5) return 'bg-green-400 text-white';
  if (totalPages >= 3) return 'bg-yellow-400 text-gray-900';
  if (totalPages >= 1) return 'bg-orange-400 text-white';
  return 'bg-red-300 text-gray-900';
}

// Visual indicator for pages 1-10 (used for cuisine-level rows)
interface PageIndicatorsProps {
  pagesScraped: number[];
  pageJobs?: Record<number, string>; // Map of page number to job ID
  onPageClick?: (page: number) => void;
  onScrapedPageClick?: (jobId: string) => void;
}

function PageIndicators({ pagesScraped, pageJobs, onPageClick, onScrapedPageClick }: PageIndicatorsProps) {
  const scrapedSet = new Set(pagesScraped);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((page) => {
        const isScraped = scrapedSet.has(page);
        const jobId = pageJobs?.[page];
        const canClickScraped = isScraped && jobId && onScrapedPageClick;
        const canClickUnscraped = !isScraped && onPageClick;
        return (
          <button
            key={page}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (canClickScraped) {
                // Open job detail in new tab
                window.open(`/leads/${jobId}`, '_blank');
              } else if (canClickUnscraped) {
                onPageClick(page);
              }
            }}
            className={`w-7 h-5 rounded-sm text-[10px] flex items-center justify-center font-medium transition-all ${
              isScraped
                ? canClickScraped
                  ? 'bg-green-500 text-white hover:bg-green-600 cursor-pointer'
                  : 'bg-green-500 text-white cursor-default'
                : canClickUnscraped
                  ? 'bg-muted text-muted-foreground hover:bg-blue-400 hover:text-white cursor-pointer'
                  : 'bg-muted text-muted-foreground cursor-default'
            }`}
            title={
              isScraped
                ? canClickScraped
                  ? `Page ${page}: Scraped - Click to view job`
                  : `Page ${page}: Scraped`
                : canClickUnscraped
                  ? `Click to scrape page ${page}`
                  : `Page ${page}: Not scraped`
            }
          >
            {page}
          </button>
        );
      })}
    </div>
  );
}

// Cuisine coverage indicators for city-level rows
interface CuisineCoverageProps {
  city: string;
  cuisines: { name: string; pages_scraped: number[]; page_jobs?: Record<number, string> }[];
  onCuisineClick?: (cuisineSlug: string) => void;
}

function CuisineCoverageIndicators({ city, cuisines, onCuisineClick }: CuisineCoverageProps) {
  // Create a map of cuisine slug -> pages scraped count
  const cuisinePageCounts = new Map<string, number>();
  cuisines.forEach(c => {
    // Normalize cuisine name to match slug format
    const normalized = c.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    cuisinePageCounts.set(normalized, c.pages_scraped.length);
    // Also try exact match
    cuisinePageCounts.set(c.name.toLowerCase(), c.pages_scraped.length);
  });

  return (
    <div className="flex gap-0.5">
      {TOP_CUISINES.map(({ slug, label }) => {
        // Try to find matching cuisine data
        const pageCount = cuisinePageCounts.get(slug) ||
                         cuisinePageCounts.get(slug.replace(/-/g, '')) ||
                         0;
        const canStartScrape = pageCount === 0 && onCuisineClick;
        const canViewLeads = pageCount > 0;
        return (
          <button
            key={slug}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (canStartScrape) {
                onCuisineClick(slug);
              } else if (canViewLeads) {
                // Open leads list filtered by city/cuisine in new tab
                window.open(`/leads?city=${encodeURIComponent(city)}&cuisine=${encodeURIComponent(slug)}`, '_blank');
              }
            }}
            className={`w-7 h-5 rounded-sm text-[9px] flex items-center justify-center font-medium transition-all ${getCoverageColor(pageCount)} ${
              canStartScrape
                ? 'hover:bg-blue-400 hover:text-white cursor-pointer'
                : canViewLeads
                  ? 'hover:opacity-80 cursor-pointer'
                  : ''
            }`}
            title={
              canStartScrape
                ? `Click to scrape ${label}`
                : canViewLeads
                  ? `${label}: ${pageCount} page${pageCount !== 1 ? 's' : ''} scraped - Click to view leads`
                  : `${label}: ${pageCount} page${pageCount !== 1 ? 's' : ''} scraped`
            }
          >
            {label.slice(0, 3)}
          </button>
        );
      })}
    </div>
  );
}

export function CityBreakdownTab({ filters, onStartScrape }: CityBreakdownTabProps) {
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary(filters);
  const { data: coverage, isLoading: coverageLoading } = useAnalyticsCoverage(filters);
  const { data: heatmap, isLoading: heatmapLoading } = useAnalyticsHeatmap(filters);

  // Compute all city names for expand all functionality
  const allCityNames = useMemo(() => {
    return coverage?.map(c => c.city) || [];
  }, [coverage]);

  const isAllExpanded = expandedCities.size === allCityNames.length && allCityNames.length > 0;

  const toggleCity = (city: string) => {
    const newExpanded = new Set(expandedCities);
    if (newExpanded.has(city)) {
      newExpanded.delete(city);
    } else {
      newExpanded.add(city);
    }
    setExpandedCities(newExpanded);
  };

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      // Collapse all
      setExpandedCities(new Set());
    } else {
      // Expand all
      setExpandedCities(new Set(allCityNames));
    }
  };

  const exportCSV = () => {
    if (!coverage) return;

    const rows = [['City', 'Cuisine', 'Leads', 'Jobs', 'Pages Scraped']];
    coverage.forEach(city => {
      city.cuisines.forEach(cuisine => {
        rows.push([
          city.city,
          cuisine.name,
          cuisine.leads.toString(),
          cuisine.jobs.toString(),
          cuisine.pages_scraped.join(';') || 'None'
        ]);
      });
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrape-coverage-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (summaryLoading || coverageLoading || heatmapLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Heatmap Section */}
      {heatmap && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coverage Heatmap (City x Cuisine)</CardTitle>
          </CardHeader>
          <CardContent>
            <HeatmapGrid
              cities={heatmap.cities}
              cuisines={heatmap.cuisines}
              matrix={heatmap.matrix}
              maxValue={heatmap.maxValue}
              onCellClick={(city, cuisine, value) => {
                if (onStartScrape) {
                  // Calculate next page offset from coverage data
                  let pageOffset = 1;
                  if (value > 0 && coverage) {
                    const cityData = coverage.find(c => c.city === city);
                    if (cityData) {
                      const cuisineData = cityData.cuisines.find(c =>
                        c.name.toLowerCase() === cuisine.toLowerCase() ||
                        c.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === cuisine.toLowerCase()
                      );
                      if (cuisineData && cuisineData.pages_scraped.length > 0) {
                        const maxPage = Math.max(...cuisineData.pages_scraped);
                        pageOffset = Math.min(maxPage + 1, 10); // Cap at page 10
                      }
                    }
                  }
                  onStartScrape(city, cuisine, pageOffset);
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Table Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">City Breakdown</CardTitle>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table style={{ tableLayout: 'fixed' }}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={toggleExpandAll}
                    disabled={allCityNames.length === 0}
                    title={isAllExpanded ? 'Collapse All' : 'Expand All'}
                  >
                    {isAllExpanded ? (
                      <ChevronsDownUp className="h-4 w-4" />
                    ) : (
                      <ChevronsUpDown className="h-4 w-4" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="min-w-[140px]">City</TableHead>
                <TableHead className="w-28 text-center">Total Leads</TableHead>
                <TableHead className="w-20 text-center">Jobs</TableHead>
                <TableHead className="w-24 text-center">Cuisines</TableHead>
                <TableHead className="min-w-[280px]">Top 10 Cuisine Coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coverage?.map((city) => (
                <React.Fragment key={city.city}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleCity(city.city)}
                  >
                    <TableCell className="w-8 px-2">
                      <div className="h-6 w-6 flex items-center justify-center">
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform duration-200",
                            !expandedCities.has(city.city) && "-rotate-90"
                          )}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{city.city}</TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/leads?tab=pending&city=${encodeURIComponent(city.city)}`, '_blank');
                        }}
                        className="hover:text-brand-blue cursor-pointer transition-colors"
                        title={`View ${city.total_leads.toLocaleString()} pending leads in ${city.city}`}
                      >
                        {city.total_leads.toLocaleString()}
                      </button>
                    </TableCell>
                    <TableCell className="text-center">{city.total_jobs}</TableCell>
                    <TableCell className="text-center">{city.cuisines.length}</TableCell>
                    <TableCell>
                      <CuisineCoverageIndicators
                        city={city.city}
                        cuisines={city.cuisines}
                        onCuisineClick={onStartScrape ? (cuisineSlug) => onStartScrape(city.city, cuisineSlug, 1) : undefined}
                      />
                    </TableCell>
                  </TableRow>
                  {/* Animated expanded cuisines */}
                  <Collapsible open={expandedCities.has(city.city)} asChild>
                    <TableRow className="hover:bg-transparent border-0 p-0">
                      <TableCell colSpan={6} className="p-0 border-0">
                        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                          <div className="bg-muted/30">
                            {city.cuisines.map((cuisine, idx) => (
                              <div
                                key={`${city.city}-${cuisine.name}`}
                                className={cn(
                                  "grid items-center",
                                  idx < city.cuisines.length - 1 && "border-b border-muted"
                                )}
                                style={{ gridTemplateColumns: '32px minmax(140px, 1fr) 112px 80px 96px minmax(280px, 1fr)' }}
                              >
                                <div className="py-2"></div>
                                <div className="pl-6 py-2 text-sm text-muted-foreground">
                                  {cuisine.name}
                                </div>
                                <div className="text-center py-2 text-sm">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(`/leads?tab=pending&city=${encodeURIComponent(city.city)}&cuisine=${encodeURIComponent(cuisine.name)}`, '_blank');
                                    }}
                                    className="hover:text-brand-blue cursor-pointer transition-colors"
                                    title={`View ${cuisine.leads} pending leads for ${cuisine.name} in ${city.city}`}
                                  >
                                    {cuisine.leads}
                                  </button>
                                </div>
                                <div className="text-center py- text-sm">{cuisine.jobs}</div>
                                <div className="py-2"></div>
                                <div className="py-2 px-4">
                                  <PageIndicators
                                    pagesScraped={cuisine.pages_scraped}
                                    pageJobs={cuisine.page_jobs}
                                    onPageClick={onStartScrape ? (page) => onStartScrape(city.city, cuisine.name, page) : undefined}
                                    onScrapedPageClick={() => {}}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </TableCell>
                    </TableRow>
                  </Collapsible>
                </React.Fragment>
              ))}
              {(!coverage || coverage.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No coverage data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Jobs"
          value={summary?.total_jobs ?? 0}
          subtitle={`${summary?.completed_jobs ?? 0} completed`}
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          title="Leads Extracted"
          value={summary?.total_leads_extracted ?? 0}
          subtitle={`${summary?.total_leads_passed ?? 0} passed`}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Cities Covered"
          value={summary?.unique_cities ?? 0}
          icon={MapPin}
          color="purple"
        />
        <StatCard
          title="Cuisines Tracked"
          value={summary?.unique_cuisines ?? 0}
          icon={Utensils}
          color="orange"
        />
      </div>
    </div>
  );
}
