import React from 'react';
import { InfoField, formatCurrency, formatPercentage, formatWebsiteType } from './InfoField';
import { BooleanField } from './BooleanField';
import { TagList } from './TagList';
import { TagItem } from '../../lib/qualification-constants';

interface QualificationDataDisplayProps {
  data: any; // Restaurant object with qualification fields
}

/**
 * QualificationDataDisplay Component
 * Read-only display of demo qualification data
 *
 * Organized into 6 sections matching QualificationForm:
 * 1. Contact & Business Context
 * 2. Delivery & Platform
 * 3. UberEats Metrics
 * 4. Marketing & Website
 * 5. Sales Context (JSONB arrays)
 * 6. Meeting Details
 */
export function QualificationDataDisplay({ data }: QualificationDataDisplayProps) {
  // Check if there's any qualification data
  const hasQualificationData =
    data.contact_role ||
    data.number_of_venues ||
    data.point_of_sale ||
    data.online_ordering_platform ||
    data.online_ordering_handles_delivery !== null ||
    data.self_delivery !== null ||
    data.weekly_uber_sales_volume !== null ||
    data.uber_aov !== null ||
    data.uber_markup !== null ||
    data.uber_profitability !== null ||
    data.uber_profitability_description ||
    data.current_marketing_description ||
    (data.painpoints && data.painpoints.length > 0) ||
    (data.core_selling_points && data.core_selling_points.length > 0) ||
    (data.features_to_highlight && data.features_to_highlight.length > 0) ||
    (data.possible_objections && data.possible_objections.length > 0) ||
    data.meeting_link ||
    data.qualification_details;

  if (!hasQualificationData) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No qualification data recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* SECTION 1: Contact & Business Context */}
      {/* ============================================================ */}
      {(data.contact_role || data.number_of_venues || data.point_of_sale || data.online_ordering_platform) && (
        <div>
          <h4 className="font-medium mb-3">Contact & Business Context</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoField label="Contact Role" value={data.contact_role} />
            <InfoField label="Number of Venues" value={data.number_of_venues} />
            <InfoField label="Point of Sale System" value={data.point_of_sale} />
            <InfoField label="Online Ordering Platform" value={data.online_ordering_platform} />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 2: Delivery & Platform */}
      {/* ============================================================ */}
      {(data.online_ordering_handles_delivery !== null || data.self_delivery !== null) && (
        <div>
          <h4 className="font-medium mb-3">Delivery & Platform</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BooleanField
              label="Online Ordering Handles Delivery"
              value={data.online_ordering_handles_delivery}
            />
            <BooleanField
              label="Self Delivery"
              value={data.self_delivery}
            />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 3: UberEats Metrics */}
      {/* ============================================================ */}
      {(data.weekly_uber_sales_volume !== null ||
        data.uber_aov !== null ||
        data.uber_markup !== null ||
        data.uber_profitability !== null ||
        data.uber_profitability_description) && (
        <div>
          <h4 className="font-medium mb-3">UberEats Metrics</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoField
              label="Weekly Sales Volume"
              value={data.weekly_uber_sales_volume}
              formatter={(v) => `${v} orders`}
            />
            <InfoField
              label="Average Order Value"
              value={data.uber_aov}
              formatter={(v) => formatCurrency(Number(v))}
            />
            <InfoField
              label="Markup %"
              value={data.uber_markup}
              formatter={(v) => formatPercentage(Number(v))}
            />
            <InfoField
              label="Profitability %"
              value={data.uber_profitability}
              formatter={(v) => formatPercentage(Number(v))}
            />
          </div>
          {data.uber_profitability_description && (
            <div className="mt-3">
              <InfoField
                label="Profitability Notes"
                value={data.uber_profitability_description}
              />
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 4: Marketing & Website */}
      {/* ============================================================ */}
      {data.current_marketing_description && (
        <div>
          <h4 className="font-medium mb-3">Marketing & Website</h4>
          <InfoField
            label="Current Marketing Activities"
            value={data.current_marketing_description}
          />
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 5: Sales Context */}
      {/* ============================================================ */}
      {((data.painpoints && data.painpoints.length > 0) ||
        (data.core_selling_points && data.core_selling_points.length > 0) ||
        (data.features_to_highlight && data.features_to_highlight.length > 0) ||
        (data.possible_objections && data.possible_objections.length > 0)) && (
        <div>
          <h4 className="font-medium mb-3">Sales Context</h4>
          <div className="space-y-3">
            <TagList label="Pain Points" items={data.painpoints as TagItem[]} />
            <TagList label="Core Selling Points" items={data.core_selling_points as TagItem[]} />
            <TagList label="Features to Highlight" items={data.features_to_highlight as TagItem[]} />
            <TagList label="Possible Objections" items={data.possible_objections as TagItem[]} />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 6: Meeting Details */}
      {/* ============================================================ */}
      {(data.meeting_link || data.qualification_details) && (
        <div>
          <h4 className="font-medium mb-3">Meeting Details</h4>
          <div className="space-y-3">
            {data.meeting_link && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Meeting Link
                </div>
                <a
                  href={data.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-blue hover:underline"
                >
                  {data.meeting_link}
                </a>
              </div>
            )}
            <InfoField label="Additional Notes" value={data.qualification_details} />
          </div>
        </div>
      )}
    </div>
  );
}
