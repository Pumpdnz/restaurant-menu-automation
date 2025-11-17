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
  Mail,
  Phone,
  MessageSquare,
  ClipboardList,
  User,
  Instagram,
  Facebook,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface TaskTypeQuickViewProps {
  task: any;
  children: React.ReactNode;
}

export function TaskTypeQuickView({ task, children }: TaskTypeQuickViewProps) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 ml-auto shrink-0"
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

  const ContactField = ({ icon: Icon, label, value, field, copyable = true }: any) => {
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

  const SocialLink = ({ icon: Icon, label, url, platform }: any) => {
    if (!url) return null;
    return (
      <div className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-brand-blue hover:underline flex items-center gap-1"
          >
            Open {platform}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <CopyButton text={url} field={platform} />
      </div>
    );
  };

  const renderEmailView = () => (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Email Task</div>

      {/* Rendered Message Preview */}
      {task.message_rendered && (
        <div
          className="bg-blue-50 border border-blue-200 p-3 rounded-md cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => copyToClipboard(task.message_rendered, 'Message')}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-blue-900">Message Preview (Click to copy)</div>
            {copiedField === 'Message' ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3 text-blue-600" />
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap text-blue-900">{task.message_rendered}</p>
        </div>
      )}

      {/* Email Addresses */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2">Email Addresses</div>
        {task.restaurants?.contact_email && (
          <ContactField
            icon={Mail}
            label="Contact Email"
            value={task.restaurants.contact_email}
            field="Contact Email"
          />
        )}
        {task.restaurants?.email && (
          <ContactField
            icon={Mail}
            label="Restaurant Email"
            value={task.restaurants.email}
            field="Restaurant Email"
          />
        )}
      </div>
    </div>
  );

  const renderTextView = () => (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Text Message Task</div>

      {/* Rendered Message Preview */}
      {task.message_rendered && (
        <div
          className="bg-green-50 border border-green-200 p-3 rounded-md cursor-pointer hover:bg-green-100 transition-colors"
          onClick={() => copyToClipboard(task.message_rendered, 'Message')}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-green-900">Message Preview (Click to copy)</div>
            {copiedField === 'Message' ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3 text-green-600" />
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap text-green-900">{task.message_rendered}</p>
        </div>
      )}

      {/* Phone Numbers */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2">Phone Numbers</div>
        {task.restaurants?.contact_phone && (
          <ContactField
            icon={Phone}
            label="Contact Phone"
            value={task.restaurants.contact_phone}
            field="Contact Phone"
          />
        )}
        {task.restaurants?.phone && (
          <ContactField
            icon={Phone}
            label="Restaurant Phone"
            value={task.restaurants.phone}
            field="Restaurant Phone"
          />
        )}
      </div>
    </div>
  );

  const renderCallView = () => (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Call Task</div>

      {/* Phone Numbers */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2">Phone Numbers</div>
        {task.restaurants?.contact_phone && (
          <ContactField
            icon={Phone}
            label="Contact Phone"
            value={task.restaurants.contact_phone}
            field="Contact Phone"
          />
        )}
        {task.restaurants?.phone && (
          <ContactField
            icon={Phone}
            label="Restaurant Phone"
            value={task.restaurants.phone}
            field="Restaurant Phone"
          />
        )}
      </div>

      {/* Additional Contact Info */}
      {task.restaurants?.contact_name && (
        <ContactField
          icon={User}
          label="Contact Name"
          value={task.restaurants.contact_name}
          field="Contact Name"
        />
      )}
    </div>
  );

  const renderSocialMessageView = () => (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Social Media Message Task</div>

      {/* Rendered Message Preview */}
      {task.message_rendered && (
        <div
          className="bg-purple-50 border border-purple-200 p-3 rounded-md cursor-pointer hover:bg-purple-100 transition-colors"
          onClick={() => copyToClipboard(task.message_rendered, 'Message')}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-purple-900">Message Preview (Click to copy)</div>
            {copiedField === 'Message' ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3 text-purple-600" />
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap text-purple-900">{task.message_rendered}</p>
        </div>
      )}

      {/* Social Links */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2">Social Media Links</div>
        {task.restaurants?.instagram_url && (
          <SocialLink
            icon={Instagram}
            label="Instagram"
            url={task.restaurants.instagram_url}
            platform="Instagram"
          />
        )}
        {task.restaurants?.facebook_url && (
          <SocialLink
            icon={Facebook}
            label="Facebook"
            url={task.restaurants.facebook_url}
            platform="Facebook"
          />
        )}
      </div>
    </div>
  );

  const renderInternalActivityView = () => (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Internal Activity</div>

      {/* All Contact Fields */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2">Contact Information</div>
        {task.restaurants?.contact_name && (
          <ContactField
            icon={User}
            label="Contact Name"
            value={task.restaurants.contact_name}
            field="Contact Name"
          />
        )}
        {task.restaurants?.contact_phone && (
          <ContactField
            icon={Phone}
            label="Contact Phone"
            value={task.restaurants.contact_phone}
            field="Contact Phone"
          />
        )}
        {task.restaurants?.contact_email && (
          <ContactField
            icon={Mail}
            label="Contact Email"
            value={task.restaurants.contact_email}
            field="Contact Email"
          />
        )}
        {task.restaurants?.phone && (
          <ContactField
            icon={Phone}
            label="Restaurant Phone"
            value={task.restaurants.phone}
            field="Restaurant Phone"
          />
        )}
        {task.restaurants?.email && (
          <ContactField
            icon={Mail}
            label="Restaurant Email"
            value={task.restaurants.email}
            field="Restaurant Email"
          />
        )}
        {task.restaurants?.instagram_url && (
          <SocialLink
            icon={Instagram}
            label="Instagram"
            url={task.restaurants.instagram_url}
            platform="Instagram"
          />
        )}
        {task.restaurants?.facebook_url && (
          <SocialLink
            icon={Facebook}
            label="Facebook"
            url={task.restaurants.facebook_url}
            platform="Facebook"
          />
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (task.type) {
      case 'email':
        return renderEmailView();
      case 'text':
        return renderTextView();
      case 'call':
        return renderCallView();
      case 'social_message':
        return renderSocialMessageView();
      case 'internal_activity':
      default:
        return renderInternalActivityView();
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[500px] overflow-y-auto" align="start">
        {renderContent()}
      </PopoverContent>
    </Popover>
  );
}
