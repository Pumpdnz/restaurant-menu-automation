import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HeatmapGridProps {
  cities: string[];
  cuisines: string[];
  matrix: number[][];
  maxValue: number;
  onCellClick?: (city: string, cuisine: string, value: number) => void;
}

function getHeatmapColor(value: number, max: number): string {
  if (value === 0) return 'bg-muted text-muted-foreground';

  const percentage = (value / max) * 100;

  if (percentage >= 80) return 'bg-green-600 text-white';
  if (percentage >= 70) return 'bg-green-500 text-white';
  if (percentage >= 60) return 'bg-green-400 text-white';
  if (percentage >= 50) return 'bg-green-300 text-white';
  if (percentage >= 30) return 'bg-yellow-400 text-gray-900';
  if (percentage >= 20) return 'bg-orange-400 text-white';
  return 'bg-red-300 text-gray-900';
}

export function HeatmapGrid({
  cities,
  cuisines,
  matrix,
  maxValue,
  onCellClick,
}: HeatmapGridProps) {
  if (cities.length === 0 || cuisines.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available for heatmap
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left font-semibold sticky left-0 bg-background z-10">
                City
              </th>
              {cuisines.map((cuisine) => (
                <th
                  key={cuisine}
                  className="p-2 text-center font-medium text-xs min-w-[60px]"
                >
                  <span className="inline-block max-w-[60px] truncate" title={cuisine}>
                    {cuisine}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cities.map((city, cityIndex) => (
              <tr key={city} className="border-t">
                <td className="p-2 font-medium sticky left-0 bg-background">
                  {city}
                </td>
                {cuisines.map((cuisine, cuisineIndex) => {
                  const value = matrix[cityIndex]?.[cuisineIndex] ?? 0;
                  return (
                    <td key={`${city}-${cuisine}`} className="p-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={cn(
                              'w-full h-8 rounded text-xs font-semibold transition-all',
                              'hover:ring-2 hover:ring-offset-1 hover:ring-primary',
                              getHeatmapColor(value, maxValue),
                              onCellClick && 'cursor-pointer'
                            )}
                            onClick={() => onCellClick?.(city, cuisine, value)}
                          >
                            {value > 0 ? value : '-'}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">{city} - {cuisine}</p>
                          <p>{value} leads extracted</p>
                          {onCellClick && (
                            <p className="text-blue-400 text-xs mt-1">
                              {value === 0 ? 'Click to start scraping' : 'Click to add more coverage'}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
