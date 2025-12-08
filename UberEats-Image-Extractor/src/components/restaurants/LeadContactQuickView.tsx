import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '../../hooks/use-toast';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Home,
  UtensilsCrossed,
  DollarSign,
  ShoppingCart,
  Store,
  Globe,
  Calendar,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

interface LeadContactQuickViewProps {
  restaurant: {
    id: string;
    name: string;
    // Contact Information
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    // Location
    city?: string;
    address?: string;
    // Business Information
    cuisine?: string[];
    weekly_sales_range?: string;
    weekly_uber_sales_volume?: number;
    online_ordering_platform?: string;
    // Links
    ubereats_url?: string;
    demo_store_url?: string;
    website_url?: string;
    // Meta
    lead_created_at?: string;
    created_at?: string;
  };
  children: React.ReactNode;
}

export function LeadContactQuickView({ restaurant, children }: LeadContactQuickViewProps) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const formatLeadCreatedDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={(e) => {
        e.stopPropagation();
        copyToClipboard(text, field);
      }}
    >
      {copiedField === field ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );

  const ContactField = ({ icon: Icon, label, value, field, copyable = true }: {
    icon: React.ElementType;
    label: string;
    value?: string;
    field: string;
    copyable?: boolean;
  }) => {
    if (!value) return null;
    return (
      <div className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-sm font-medium truncate">{value}</div>
        </div>
        {copyable && <CopyButton text={value} field={field} />}
      </div>
    );
  };

  const LinkField = ({ icon: Icon, label, url, field }: {
    icon: React.ElementType;
    label: string;
    url?: string;
    field: string;
  }) => {
    if (!url) return null;
    return (
      <div className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <a
            href={url.startsWith('http') ? url : `https://${url}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-brand-blue hover:underline flex items-center gap-1"
          >
            Open Link
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <CopyButton text={url} field={field} />
      </div>
    );
  };

  const CuisineField = ({ cuisine }: { cuisine?: string[] }) => {
    if (!cuisine || cuisine.length === 0) return null;
    return (
      <div className="p-2 rounded">
        <div className="flex items-center gap-2 mb-2">
          <UtensilsCrossed className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-xs text-muted-foreground">Cuisine</div>
        </div>
        <div className="flex flex-wrap gap-1 ml-6">
          {cuisine.map((item, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {item}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 pt-3 pb-1 border-t first:border-t-0 first:pt-0">
      {title}
    </div>
  );

  // Check if sections have content
  const hasContactInfo = restaurant.contact_name || restaurant.contact_email || restaurant.contact_phone;
  const hasLocation = restaurant.city || restaurant.address;
  const hasBusinessInfo = (restaurant.cuisine && restaurant.cuisine.length > 0) ||
                          restaurant.weekly_sales_range ||
                          restaurant.online_ordering_platform;
  const hasLinks = restaurant.ubereats_url || restaurant.demo_store_url || restaurant.website_url;
  const leadCreatedDate = formatLeadCreatedDate(restaurant.lead_created_at || restaurant.created_at);

  const hasAnyContent = hasContactInfo || hasLocation || hasBusinessInfo || hasLinks || leadCreatedDate;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-[500px] overflow-y-auto" align="start">
        <div className="space-y-1">
          {/* Header */}
          <div className="font-semibold text-sm pb-2 border-b">
            {restaurant.name}
          </div>

          {!hasAnyContent ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No information available
            </div>
          ) : (
            <>
              {/* Contact Information Section */}
              {hasContactInfo && (
                <>
                  <SectionHeader title="Contact Information" />
                  <ContactField
                    icon={User}
                    label="Contact Name"
                    value={restaurant.contact_name}
                    field="Contact Name"
                  />
                  <ContactField
                    icon={Mail}
                    label="Contact Email"
                    value={restaurant.contact_email}
                    field="Contact Email"
                  />
                  <ContactField
                    icon={Phone}
                    label="Contact Phone"
                    value={restaurant.contact_phone}
                    field="Contact Phone"
                  />
                </>
              )}

              {/* Location Section */}
              {hasLocation && (
                <>
                  <SectionHeader title="Location" />
                  <ContactField
                    icon={MapPin}
                    label="City"
                    value={restaurant.city}
                    field="City"
                    copyable={false}
                  />
                  <ContactField
                    icon={Home}
                    label="Address"
                    value={restaurant.address}
                    field="Address"
                  />
                </>
              )}

              {/* Business Information Section */}
              {hasBusinessInfo && (
                <>
                  <SectionHeader title="Business Information" />
                  <CuisineField cuisine={restaurant.cuisine} />
                  <ContactField
                    icon={DollarSign}
                    label="Weekly Sales Range"
                    value={restaurant.weekly_sales_range}
                    field="Weekly Sales Range"
                    copyable={false}
                  />
                  <ContactField
                    icon={ShoppingCart}
                    label="Online Ordering Platform"
                    value={restaurant.online_ordering_platform}
                    field="Online Ordering Platform"
                    copyable={false}
                  />
                </>
              )}

              {/* Links Section */}
              {hasLinks && (
                <>
                  <SectionHeader title="Links" />
                  <LinkField
                    icon={Store}
                    label="UberEats"
                    url={restaurant.ubereats_url}
                    field="UberEats URL"
                  />
                  <LinkField
                    icon={Globe}
                    label="Demo Store"
                    url={restaurant.demo_store_url}
                    field="Demo Store URL"
                  />
                  <LinkField
                    icon={Globe}
                    label="Website"
                    url={restaurant.website_url}
                    field="Website URL"
                  />
                </>
              )}

              {/* Lead Created */}
              {leadCreatedDate && (
                <>
                  <SectionHeader title="Meta" />
                  <ContactField
                    icon={Calendar}
                    label="Lead Created"
                    value={leadCreatedDate}
                    field="Lead Created"
                    copyable={false}
                  />
                </>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
