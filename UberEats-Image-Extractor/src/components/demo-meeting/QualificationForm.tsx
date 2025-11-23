import React from 'react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { TagInput } from './TagInput';
import {
  QualificationData,
  PREDEFINED_PAINPOINTS,
  PREDEFINED_SELLING_POINTS,
  PREDEFINED_FEATURES,
  PREDEFINED_OBJECTIONS,
  COMMON_POS_SYSTEMS,
  COMMON_ORDERING_PLATFORMS,
  CONTACT_ROLES,
  WEBSITE_TYPES
} from '../../lib/qualification-constants';

interface QualificationFormProps {
  data: QualificationData;
  onChange: (field: keyof QualificationData, value: any) => void;
  restaurantId?: string;
}

/**
 * QualificationForm Component
 * Complete form for demo meeting qualification data
 *
 * Organized into 6 sections:
 * 1. Contact & Business Context
 * 2. Delivery & Platform
 * 3. UberEats Metrics
 * 4. Marketing & Website
 * 5. Sales Context (JSONB arrays)
 * 6. Meeting Details
 */
export function QualificationForm({ data, onChange, restaurantId }: QualificationFormProps) {
  return (
    <div className="space-y-6 border-t pt-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Demo Qualification</div>
        <div className="text-xs text-muted-foreground">
          All fields optional
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 1: Contact & Business Context */}
      {/* ============================================================ */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Contact & Business Context
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Contact Role */}
          <div className="space-y-2">
            <Label htmlFor="contact_role">Contact Role</Label>
            <Select
              value={data.contact_role || 'none'}
              onValueChange={(v) => onChange('contact_role', v === 'none' ? null : v)}
            >
              <SelectTrigger id="contact_role">
                <SelectValue placeholder="Select role..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {CONTACT_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Number of Venues */}
          <div className="space-y-2">
            <Label htmlFor="number_of_venues">Number of Venues</Label>
            <Input
              id="number_of_venues"
              type="number"
              min="1"
              placeholder="e.g., 1, 3, 5"
              value={data.number_of_venues || ''}
              onChange={(e) => onChange('number_of_venues', e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>

          {/* Point of Sale */}
          <div className="space-y-2">
            <Label htmlFor="point_of_sale">Point of Sale (POS)</Label>
            <Input
              id="point_of_sale"
              list="pos-systems"
              placeholder="e.g., Lightspeed, Square"
              value={data.point_of_sale || ''}
              onChange={(e) => onChange('point_of_sale', e.target.value || null)}
            />
            <datalist id="pos-systems">
              {COMMON_POS_SYSTEMS.map((pos) => (
                <option key={pos} value={pos} />
              ))}
            </datalist>
          </div>

          {/* Online Ordering Platform */}
          <div className="space-y-2">
            <Label htmlFor="online_ordering_platform">Online Ordering Platform</Label>
            <Input
              id="online_ordering_platform"
              list="ordering-platforms"
              placeholder="e.g., Ordermeal, Mobi2Go"
              value={data.online_ordering_platform || ''}
              onChange={(e) => onChange('online_ordering_platform', e.target.value || null)}
            />
            <datalist id="ordering-platforms">
              {COMMON_ORDERING_PLATFORMS.map((platform) => (
                <option key={platform} value={platform} />
              ))}
            </datalist>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 2: Delivery & Platform */}
      {/* ============================================================ */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Delivery Setup
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Platform Handles Delivery */}
          <div className="space-y-2">
            <Label htmlFor="online_ordering_handles_delivery">
              Platform Handles Delivery?
            </Label>
            <Select
              value={data.online_ordering_handles_delivery === null || data.online_ordering_handles_delivery === undefined ? 'unknown' : data.online_ordering_handles_delivery.toString()}
              onValueChange={(v) => {
                if (v === 'unknown') {
                  onChange('online_ordering_handles_delivery', null);
                } else {
                  onChange('online_ordering_handles_delivery', v === 'true');
                }
              }}
            >
              <SelectTrigger id="online_ordering_handles_delivery">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Self Delivery */}
          <div className="space-y-2">
            <Label htmlFor="self_delivery">Self Delivery?</Label>
            <Select
              value={data.self_delivery === null || data.self_delivery === undefined ? 'unknown' : data.self_delivery.toString()}
              onValueChange={(v) => {
                if (v === 'unknown') {
                  onChange('self_delivery', null);
                } else {
                  onChange('self_delivery', v === 'true');
                }
              }}
            >
              <SelectTrigger id="self_delivery">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 3: UberEats Metrics */}
      {/* ============================================================ */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          UberEats Metrics
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Weekly Sales Volume */}
          <div className="space-y-2">
            <Label htmlFor="weekly_uber_sales_volume">
              Weekly Sales Volume (number of sales)
            </Label>
            <Input
              id="weekly_uber_sales_volume"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 5000"
              value={data.weekly_uber_sales_volume || ''}
              onChange={(e) => onChange('weekly_uber_sales_volume', e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>

          {/* Average Order Value */}
          <div className="space-y-2">
            <Label htmlFor="uber_aov">Average Order Value ($)</Label>
            <Input
              id="uber_aov"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 45"
              value={data.uber_aov || ''}
              onChange={(e) => onChange('uber_aov', e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>

          {/* Menu Markup */}
          <div className="space-y-2">
            <Label htmlFor="uber_markup">Menu Markup (%)</Label>
            <Input
              id="uber_markup"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="e.g., 30"
              value={data.uber_markup || ''}
              onChange={(e) => onChange('uber_markup', e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>

          {/* Profitability */}
          <div className="space-y-2">
            <Label htmlFor="uber_profitability">Profitability (%)</Label>
            <Input
              id="uber_profitability"
              type="number"
              min="-100"
              max="100"
              step="0.1"
              placeholder="e.g., 15 or -5"
              value={data.uber_profitability || ''}
              onChange={(e) => onChange('uber_profitability', e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
        </div>

        {/* Profitability Context */}
        <div className="space-y-2">
          <Label htmlFor="uber_profitability_description">
            Profitability Context
          </Label>
          <Textarea
            id="uber_profitability_description"
            placeholder="e.g., $70 order in store is $100 on Uber, keeps $25 after commission"
            rows={2}
            value={data.uber_profitability_description || ''}
            onChange={(e) => onChange('uber_profitability_description', e.target.value || null)}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 4: Marketing & Website */}
      {/* ============================================================ */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Marketing & Website
        </div>

        {/* Current Marketing */}
        <div className="space-y-2">
          <Label htmlFor="current_marketing_description">
            Current Marketing Efforts
          </Label>
          <Textarea
            id="current_marketing_description"
            placeholder="Describe their current marketing activities..."
            rows={3}
            value={data.current_marketing_description || ''}
            onChange={(e) => onChange('current_marketing_description', e.target.value || null)}
          />
        </div>

        {/* Website Type */}
        <div className="space-y-2">
          <Label htmlFor="website_type">Website Type</Label>
          <Select
            value={data.website_type || 'none'}
            onValueChange={(v) => onChange('website_type', v === 'none' ? null : v)}
          >
            <SelectTrigger id="website_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unknown</SelectItem>
              {WEBSITE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 5: Sales Context (JSONB Arrays) */}
      {/* ============================================================ */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Sales Context
        </div>

        {/* Painpoints */}
        <div className="space-y-2">
          <Label>Painpoints</Label>
          <TagInput
            options={PREDEFINED_PAINPOINTS}
            selected={data.painpoints || []}
            onChange={(v) => onChange('painpoints', v)}
            allowCustom={true}
            placeholder="Select or add painpoints..."
          />
        </div>

        {/* Core Selling Points */}
        <div className="space-y-2">
          <Label>Core Selling Points</Label>
          <TagInput
            options={PREDEFINED_SELLING_POINTS}
            selected={data.core_selling_points || []}
            onChange={(v) => onChange('core_selling_points', v)}
            allowCustom={true}
            placeholder="Select or add selling points..."
          />
        </div>

        {/* Features to Highlight */}
        <div className="space-y-2">
          <Label>Features to Highlight</Label>
          <TagInput
            options={PREDEFINED_FEATURES}
            selected={data.features_to_highlight || []}
            onChange={(v) => onChange('features_to_highlight', v)}
            allowCustom={true}
            placeholder="Select or add features..."
          />
        </div>

        {/* Possible Objections */}
        <div className="space-y-2">
          <Label>Possible Objections</Label>
          <TagInput
            options={PREDEFINED_OBJECTIONS}
            selected={data.possible_objections || []}
            onChange={(v) => onChange('possible_objections', v)}
            allowCustom={true}
            placeholder="Select or add objections..."
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 6: Meeting Details */}
      {/* ============================================================ */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Meeting Details
        </div>

        {/* Additional Details */}
        <div className="space-y-2">
          <Label htmlFor="details">Additional Details</Label>
          <Textarea
            id="details"
            placeholder="Any additional notes or context from the demo booking..."
            rows={3}
            value={data.details || ''}
            onChange={(e) => onChange('details', e.target.value || null)}
          />
        </div>

        {/* Meeting Link */}
        <div className="space-y-2">
          <Label htmlFor="meeting_link">Meeting Link</Label>
          <Input
            id="meeting_link"
            type="text"
            placeholder="Calendly link, Zoom link, phone number, or meeting notes..."
            value={data.meeting_link || ''}
            onChange={(e) => onChange('meeting_link', e.target.value || null)}
          />
          <p className="text-xs text-muted-foreground">
            Can be a URL, phone number, location, or notes about the meeting
          </p>
        </div>
      </div>
    </div>
  );
}
