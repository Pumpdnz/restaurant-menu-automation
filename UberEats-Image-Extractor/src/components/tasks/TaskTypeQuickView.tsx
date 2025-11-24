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
  Check,
  CheckCircle2,
  ArrowRight,
  Workflow
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatCurrency, formatPercentage, formatWebsiteType } from '../demo-meeting/InfoField';
import { TagItem } from '../../lib/qualification-constants';
import api from '../../services/api';

interface TaskTypeQuickViewProps {
  task: any;
  children: React.ReactNode;
  onTaskCompleted?: () => void;
  onFollowUpRequested?: (taskId: string) => void;
  onStartSequenceRequested?: (restaurant: { id: string; name: string }) => void;
}

export function TaskTypeQuickView({ task, children, onTaskCompleted, onFollowUpRequested, onStartSequenceRequested }: TaskTypeQuickViewProps) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const formatScheduledTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

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

  const handleCompleteTask = async () => {
    if (!task?.id) return;

    setIsCompleting(true);
    try {
      await api.patch(`/tasks/${task.id}/complete`);
      toast({
        title: "Task Completed",
        description: "Task has been marked as complete",
      });
      setIsOpen(false); // Close popover
      if (onTaskCompleted) {
        onTaskCompleted();
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast({
        title: "Error",
        description: "Failed to complete task",
        variant: "destructive"
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCompleteWithFollowUp = async () => {
    if (!task?.id) return;

    setIsCompleting(true);
    try {
      await api.patch(`/tasks/${task.id}/complete`);
      setIsOpen(false); // Close popover
      toast({
        title: "Task Completed",
        description: "Opening follow-up task creation...",
      });
      if (onFollowUpRequested) {
        onFollowUpRequested(task.id);
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast({
        title: "Error",
        description: "Failed to complete task",
        variant: "destructive"
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCompleteWithStartSequence = async () => {
    if (!task?.id || !task?.restaurants) return;

    setIsCompleting(true);
    try {
      await api.patch(`/tasks/${task.id}/complete`);
      setIsOpen(false); // Close popover
      toast({
        title: "Task Completed",
        description: "Opening sequence selection...",
      });
      if (onStartSequenceRequested) {
        onStartSequenceRequested({
          id: task.restaurants.id,
          name: task.restaurants.name
        });
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast({
        title: "Error",
        description: "Failed to complete task",
        variant: "destructive"
      });
    } finally {
      setIsCompleting(false);
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

  const ScheduledTimeDisplay = () => {
    if (!task.due_date) return null;
    return (
      <div className="bg-green-50 border border-green-200 p-3 rounded-md">
        <div className="text-xs font-medium text-green-900 mb-1">Scheduled For</div>
        <div className="text-sm font-semibold text-green-900">{formatScheduledTime(task.due_date)}</div>
      </div>
    );
  };

  const renderEmailView = () => (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Email Task</div>

      <ScheduledTimeDisplay />

      {/* Email Subject Line */}
      {(task.subject_line_rendered || task.subject_line) && (
        <div
          className="bg-blue-50 border border-blue-200 p-3 rounded-md cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => copyToClipboard(task.subject_line_rendered || task.subject_line, 'Subject')}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-blue-900">Email Subject (Click to copy)</div>
            {copiedField === 'Subject' ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3 text-blue-600" />
            )}
          </div>
          <p className="text-sm font-medium text-blue-900">{task.subject_line_rendered || task.subject_line}</p>
        </div>
      )}

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

      <ScheduledTimeDisplay />

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

      <ScheduledTimeDisplay />

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

      <ScheduledTimeDisplay />

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

      <ScheduledTimeDisplay />

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

  const renderDemoMeetingView = () => (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Demo Meeting</div>

      <ScheduledTimeDisplay />

      {/* Meeting Link - Prominent Display */}
      {task.restaurants?.meeting_link && (
          <div className="bg-brand-blue/10 border border-brand-blue/30 p-3 rounded-md">
            <div className="text-xs font-medium text-brand-blue mb-2">Meeting Link</div>
            <a
              href={task.restaurants.meeting_link.startsWith('http') ? task.restaurants.meeting_link : `https://${task.restaurants.meeting_link}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-brand-blue hover:underline flex items-center gap-1 break-all"
            >
              {task.restaurants.meeting_link}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
        )}

      {/* Contact Information */}
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
        {task.restaurants?.contact_role && (
          <ContactField
            icon={User}
            label="Contact Role"
            value={task.restaurants.contact_role}
            field="Contact Role"
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
      </div>

      {/* Business Context - Collapsed with Extended Qualification Data */}
      {(task.restaurants?.number_of_venues ||
        task.restaurants?.point_of_sale ||
        task.restaurants?.online_ordering_platform ||
        task.restaurants?.weekly_uber_sales_volume ||
        task.restaurants?.uber_aov ||
        task.restaurants?.uber_markup ||
        task.restaurants?.uber_profitability ||
        task.restaurants?.current_marketing_description ||
        task.restaurants?.website_type ||
        (task.restaurants?.painpoints && task.restaurants.painpoints.length > 0) ||
        (task.restaurants?.core_selling_points && task.restaurants.core_selling_points.length > 0) ||
        (task.restaurants?.features_to_highlight && task.restaurants.features_to_highlight.length > 0) ||
        (task.restaurants?.possible_objections && task.restaurants.possible_objections.length > 0)) && (
        <details className="border rounded-md p-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            Business Context & Qualification Data
          </summary>
          <div className="mt-3 space-y-3 text-xs">
            {/* Basic Business Info */}
            {(task.restaurants?.number_of_venues || task.restaurants?.point_of_sale || task.restaurants?.online_ordering_platform) && (
              <div className="space-y-1">
                <div className="font-semibold text-foreground mb-1">Business Setup</div>
                {task.restaurants?.number_of_venues && (
                  <div><span className="font-medium">Venues:</span> {task.restaurants.number_of_venues}</div>
                )}
                {task.restaurants?.point_of_sale && (
                  <div><span className="font-medium">POS:</span> {task.restaurants.point_of_sale}</div>
                )}
                {task.restaurants?.online_ordering_platform && (
                  <div><span className="font-medium">Ordering Platform:</span> {task.restaurants.online_ordering_platform}</div>
                )}
                {task.restaurants?.online_ordering_handles_delivery !== null && task.restaurants?.online_ordering_handles_delivery !== undefined && (
                  <div><span className="font-medium">Platform Handles Delivery:</span> {task.restaurants.online_ordering_handles_delivery ? 'Yes' : 'No'}</div>
                )}
                {task.restaurants?.self_delivery !== null && task.restaurants?.self_delivery !== undefined && (
                  <div><span className="font-medium">Self Delivery:</span> {task.restaurants.self_delivery ? 'Yes' : 'No'}</div>
                )}
                {task.restaurants?.website_type && (
                  <div><span className="font-medium">Website:</span> {formatWebsiteType(task.restaurants.website_type)}</div>
                )}
              </div>
            )}

            {/* UberEats Metrics */}
            {(task.restaurants?.weekly_uber_sales_volume || task.restaurants?.uber_aov || task.restaurants?.uber_markup || task.restaurants?.uber_profitability) && (
              <div className="space-y-1 border-t pt-2">
                <div className="font-semibold text-foreground mb-1">UberEats Metrics</div>
                {task.restaurants?.weekly_uber_sales_volume && (
                  <div><span className="font-medium">Weekly Sales:</span> {formatCurrency(task.restaurants.weekly_uber_sales_volume)}</div>
                )}
                {task.restaurants?.uber_aov && (
                  <div><span className="font-medium">AOV:</span> {formatCurrency(task.restaurants.uber_aov)}</div>
                )}
                {task.restaurants?.uber_markup && (
                  <div><span className="font-medium">Markup:</span> {formatPercentage(task.restaurants.uber_markup)}</div>
                )}
                {task.restaurants?.uber_profitability && (
                  <div><span className="font-medium">Profitability:</span> {formatPercentage(task.restaurants.uber_profitability)}</div>
                )}
                {task.restaurants?.uber_profitability_description && (
                  <div className="text-muted-foreground italic mt-1">{task.restaurants.uber_profitability_description}</div>
                )}
              </div>
            )}

            {/* Marketing */}
            {task.restaurants?.current_marketing_description && (
              <div className="space-y-1 border-t pt-2">
                <div className="font-semibold text-foreground mb-1">Current Marketing</div>
                <div className="text-muted-foreground">{task.restaurants.current_marketing_description}</div>
              </div>
            )}

            {/* Painpoints */}
            {task.restaurants?.painpoints && task.restaurants.painpoints.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                <div className="font-semibold text-foreground mb-1">Painpoints ({task.restaurants.painpoints.length})</div>
                <div className="flex flex-wrap gap-1">
                  {task.restaurants.painpoints.slice(0, 5).map((item: TagItem, index: number) => (
                    <Badge key={index} variant={item.type === 'predefined' ? 'default' : 'secondary'} className="text-xs">
                      {item.value}
                    </Badge>
                  ))}
                  {task.restaurants.painpoints.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{task.restaurants.painpoints.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Core Selling Points */}
            {task.restaurants?.core_selling_points && task.restaurants.core_selling_points.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                <div className="font-semibold text-foreground mb-1">Selling Points ({task.restaurants.core_selling_points.length})</div>
                <div className="flex flex-wrap gap-1">
                  {task.restaurants.core_selling_points.slice(0, 5).map((item: TagItem, index: number) => (
                    <Badge key={index} variant={item.type === 'predefined' ? 'default' : 'secondary'} className="text-xs">
                      {item.value}
                    </Badge>
                  ))}
                  {task.restaurants.core_selling_points.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{task.restaurants.core_selling_points.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Features to Highlight */}
            {task.restaurants?.features_to_highlight && task.restaurants.features_to_highlight.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                <div className="font-semibold text-foreground mb-1">Features ({task.restaurants.features_to_highlight.length})</div>
                <div className="flex flex-wrap gap-1">
                  {task.restaurants.features_to_highlight.slice(0, 5).map((item: TagItem, index: number) => (
                    <Badge key={index} variant={item.type === 'predefined' ? 'default' : 'secondary'} className="text-xs">
                      {item.value}
                    </Badge>
                  ))}
                  {task.restaurants.features_to_highlight.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{task.restaurants.features_to_highlight.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Possible Objections */}
            {task.restaurants?.possible_objections && task.restaurants.possible_objections.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                <div className="font-semibold text-foreground mb-1">Objections ({task.restaurants.possible_objections.length})</div>
                <div className="flex flex-wrap gap-1">
                  {task.restaurants.possible_objections.slice(0, 5).map((item: TagItem, index: number) => (
                    <Badge key={index} variant={item.type === 'predefined' ? 'destructive' : 'secondary'} className="text-xs">
                      {item.value}
                    </Badge>
                  ))}
                  {task.restaurants.possible_objections.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{task.restaurants.possible_objections.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Additional Details */}
            {task.restaurants?.details && (
              <div className="space-y-1 border-t pt-2">
                <div className="font-semibold text-foreground mb-1">Additional Notes</div>
                <div className="text-muted-foreground whitespace-pre-wrap">{task.restaurants.details}</div>
              </div>
            )}
          </div>
        </details>
      )}
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
      case 'demo_meeting':
        return renderDemoMeetingView();
      case 'internal_activity':
      default:
        return renderInternalActivityView();
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[500px] overflow-y-auto" align="start">
        <div className="space-y-3">
          {renderContent()}

          {/* Action Buttons */}
          {task.status !== 'completed' && task.status !== 'cancelled' && (
            <div className="pt-3 border-t space-y-2">
              <Button
                onClick={handleCompleteTask}
                disabled={isCompleting}
                className="w-full"
                size="sm"
                variant="outline"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {isCompleting ? 'Completing...' : 'Mark Complete'}
              </Button>
              <Button
                onClick={handleCompleteWithFollowUp}
                disabled={isCompleting}
                className="w-full"
                size="sm"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Complete & Set Follow-Up
              </Button>
              <Button
                onClick={handleCompleteWithStartSequence}
                disabled={isCompleting || !task?.restaurants}
                className="w-full"
                size="sm"
                variant="tertiary"
              >
                <Workflow className="h-4 w-4 mr-2" />
                Complete & Start Sequence
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
