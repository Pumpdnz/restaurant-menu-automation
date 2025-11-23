import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Calendar,
  User,
  Flag,
  CheckCircle2,
  XCircle,
  Circle,
  MessageSquare,
  Phone,
  Mail,
  ClipboardList,
  FileText,
  ExternalLink,
  Instagram,
  Facebook,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { InfoField, formatCurrency, formatPercentage, formatWebsiteType } from '../demo-meeting/InfoField';
import { BooleanField } from '../demo-meeting/BooleanField';
import { TagList } from '../demo-meeting/TagList';

interface TaskDetailModalProps {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailModal({ open, taskId, onClose }: TaskDetailModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (open && taskId) {
      fetchTaskDetails();
    }
  }, [open, taskId]);

  const fetchTaskDetails = async () => {
    if (!taskId) return;

    setLoading(true);
    try {
      const response = await api.get(`/tasks/${taskId}`);
      setTask(response.data.task);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch task details:', err);
      setError('Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'active':
        return <Circle className="h-5 w-5 text-blue-600" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'social_message':
        return <MessageSquare className="h-4 w-4" />;
      case 'text':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <ClipboardList className="h-4 w-4" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800 border-gray-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      high: 'bg-red-100 text-red-800 border-red-200'
    };
    return (
      <Badge variant="outline" className={cn('capitalize', colors[priority as keyof typeof colors])}>
        {priority}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800',
      active: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return (
      <Badge variant="outline" className={cn('capitalize', colors[status as keyof typeof colors])}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px]">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !task) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px]">
          <div className="text-center py-8 text-red-600">
            {error || 'Task not found'}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {getStatusIcon(task.status)}
            <DialogTitle>{task.name}</DialogTitle>
          </div>
          <DialogDescription>
            Task details and information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status and Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Status</div>
              {getStatusBadge(task.status)}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Type</div>
              <div className="flex items-center gap-1">
                {getTypeIcon(task.type)}
                <span className="text-sm capitalize">
                  {task.type.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Priority</div>
              {getPriorityBadge(task.priority)}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Due Date</div>
              {task.due_date ? (
                <div className="flex items-center gap-1 text-sm">
                  <Calendar className="h-4 w-4" />
                  {new Date(task.due_date).toLocaleDateString()}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <div className="text-sm font-medium mb-1">Description</div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Restaurant */}
          {task.restaurants && (
            <div>
              <div className="text-sm font-medium mb-1">Restaurant</div>
              <Button
                variant="link"
                className="p-0 h-auto text-brand-blue"
                onClick={() => {
                  navigate(`/restaurants/${task.restaurant_id}`);
                  onClose();
                }}
              >
                {task.restaurants.name}
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
              {task.restaurants.city && (
                <p className="text-xs text-muted-foreground mt-1">
                  {task.restaurants.city}
                </p>
              )}
            </div>
          )}

          {/* Contact Information */}
          {task.restaurants && (
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="text-sm font-medium mb-3">Contact Information</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {task.restaurants.contact_name && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Contact Name</div>
                      <div className="font-medium">{task.restaurants.contact_name}</div>
                    </div>
                  </div>
                )}
                {task.restaurants.contact_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Contact Phone</div>
                      <div className="font-medium">{task.restaurants.contact_phone}</div>
                    </div>
                  </div>
                )}
                {task.restaurants.contact_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Contact Email</div>
                      <div className="font-medium">{task.restaurants.contact_email}</div>
                    </div>
                  </div>
                )}
                {task.restaurants.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Restaurant Phone</div>
                      <div className="font-medium">{task.restaurants.phone}</div>
                    </div>
                  </div>
                )}
                {task.restaurants.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Restaurant Email</div>
                      <div className="font-medium">{task.restaurants.email}</div>
                    </div>
                  </div>
                )}
                {task.restaurants.instagram_url && (
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Instagram</div>
                      <a
                        href={task.restaurants.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-blue hover:underline flex items-center gap-1"
                      >
                        View Profile
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
                {task.restaurants.facebook_url && (
                  <div className="flex items-center gap-2">
                    <Facebook className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Facebook</div>
                      <a
                        href={task.restaurants.facebook_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-blue hover:underline flex items-center gap-1"
                      >
                        View Page
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Demo Meeting Qualification */}
          {task.type === 'demo_meeting' && task.restaurants && (
            <div className="space-y-4 border-t pt-4">
              <div className="text-sm font-semibold">Demo Qualification</div>

              {/* Meeting Link - Prominent */}
              {task.restaurants.meeting_link && (
                <div className="bg-brand-blue/10 border border-brand-blue/30 p-4 rounded-lg">
                  <div className="text-xs font-medium text-brand-blue mb-2">Meeting Link</div>
                  <a
                    href={task.restaurants.meeting_link.startsWith('http') ? task.restaurants.meeting_link : `https://${task.restaurants.meeting_link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-medium text-brand-blue hover:underline flex items-center gap-2 break-all"
                  >
                    {task.restaurants.meeting_link}
                    <ExternalLink className="h-4 w-4 shrink-0" />
                  </a>
                </div>
              )}

              {/* Contact & Business Context */}
              {(task.restaurants.contact_role || task.restaurants.number_of_venues || task.restaurants.point_of_sale || task.restaurants.online_ordering_platform) && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Contact & Business Context
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoField label="Contact Role" value={task.restaurants.contact_role} />
                    <InfoField label="Number of Venues" value={task.restaurants.number_of_venues} />
                    <InfoField label="Point of Sale" value={task.restaurants.point_of_sale} />
                    <InfoField label="Online Ordering Platform" value={task.restaurants.online_ordering_platform} />
                  </div>
                </div>
              )}

              {/* Delivery Setup */}
              {(task.restaurants.online_ordering_handles_delivery !== null || task.restaurants.self_delivery !== null) && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Delivery Setup
                  </div>
                  <div className="space-y-2">
                    <BooleanField
                      label="Platform Handles Delivery"
                      value={task.restaurants.online_ordering_handles_delivery}
                    />
                    <BooleanField
                      label="Self Delivery"
                      value={task.restaurants.self_delivery}
                    />
                  </div>
                </div>
              )}

              {/* UberEats Metrics */}
              {(task.restaurants.weekly_uber_sales_volume || task.restaurants.uber_aov || task.restaurants.uber_markup || task.restaurants.uber_profitability || task.restaurants.uber_profitability_description) && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    UberEats Metrics
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoField
                      label="Weekly Sales Volume"
                      value={task.restaurants.weekly_uber_sales_volume}
                      formatter={formatCurrency}
                    />
                    <InfoField
                      label="Average Order Value"
                      value={task.restaurants.uber_aov}
                      formatter={formatCurrency}
                    />
                    <InfoField
                      label="Menu Markup"
                      value={task.restaurants.uber_markup}
                      formatter={formatPercentage}
                    />
                    <InfoField
                      label="Profitability"
                      value={task.restaurants.uber_profitability}
                      formatter={formatPercentage}
                    />
                  </div>
                  {task.restaurants.uber_profitability_description && (
                    <div className="mt-3">
                      <InfoField
                        label="Profitability Details"
                        value={task.restaurants.uber_profitability_description}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Marketing & Website */}
              {(task.restaurants.current_marketing_description || task.restaurants.website_type) && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Marketing & Website
                  </div>
                  <div className="space-y-3">
                    <InfoField
                      label="Current Marketing"
                      value={task.restaurants.current_marketing_description}
                    />
                    <InfoField
                      label="Website Type"
                      value={task.restaurants.website_type}
                      formatter={formatWebsiteType}
                    />
                  </div>
                </div>
              )}

              {/* Sales Context */}
              {(task.restaurants.painpoints?.length > 0 || task.restaurants.core_selling_points?.length > 0 || task.restaurants.features_to_highlight?.length > 0 || task.restaurants.possible_objections?.length > 0) && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Sales Context
                  </div>
                  <div className="space-y-4">
                    <TagList label="Painpoints" items={task.restaurants.painpoints} />
                    <TagList label="Core Selling Points" items={task.restaurants.core_selling_points} />
                    <TagList label="Features to Highlight" items={task.restaurants.features_to_highlight} />
                    <TagList label="Possible Objections" items={task.restaurants.possible_objections} />
                  </div>
                </div>
              )}

              {/* Additional Details */}
              {task.restaurants.details && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Additional Details
                  </div>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
                    {task.restaurants.details}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Task Template */}
          {task.task_templates && (
            <div>
              <div className="text-sm font-medium mb-1">Created from Template</div>
              <div className="flex items-center gap-1 text-sm">
                <FileText className="h-4 w-4" />
                {task.task_templates.name}
              </div>
            </div>
          )}

          {/* Email Subject Line (for email tasks) */}
          {task.type === 'email' && (task.subject_line_rendered || task.subject_line) && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium">Email Subject</div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => copyToClipboard(task.subject_line_rendered || task.subject_line, 'Subject')}
                >
                  {copiedField === 'Subject' ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-green-600" />
                      <span className="text-xs">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      <span className="text-xs">Copy</span>
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                <p className="text-sm font-medium text-blue-900">{task.subject_line_rendered || task.subject_line}</p>
              </div>
            </div>
          )}

          {/* Rendered Message (with variables replaced) - Show FIRST for communication tasks */}
          {task.message_rendered && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium">Message Preview</div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => copyToClipboard(task.message_rendered, 'Message')}
                >
                  {copiedField === 'Message' ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-green-600" />
                      <span className="text-xs">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      <span className="text-xs">Copy</span>
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                <p className="text-sm whitespace-pre-wrap">{task.message_rendered}</p>
              </div>
            </div>
          )}

          {/* Message Template */}
          {task.message_templates && (
            <div>
              <div className="text-sm font-medium mb-1">Message Template</div>
              <div className="flex items-center gap-1 text-sm">
                <FileText className="h-4 w-4" />
                {task.message_templates.name}
              </div>
            </div>
          )}

          {/* Message Content (Raw Template) */}
          {task.message && task.message !== task.message_rendered && (
            <div>
              <div className="text-sm font-medium mb-1">Message Template (with variables)</div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm whitespace-pre-wrap font-mono text-xs">{task.message}</p>
              </div>
            </div>
          )}

          {/* Assigned To */}
          {task.assigned_to && (
            <div>
              <div className="text-sm font-medium mb-1">Assigned To</div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="text-sm">{task.assigned_to.full_name || task.assigned_to.email}</span>
              </div>
            </div>
          )}

          {/* Created By */}
          {task.created_by && (
            <div>
              <div className="text-sm font-medium mb-1">Created By</div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="text-sm">{task.created_by.full_name || task.created_by.email}</span>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Created</div>
              <div className="text-sm">
                {new Date(task.created_at).toLocaleString()}
              </div>
            </div>
            {task.completed_at && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Completed</div>
                <div className="text-sm">
                  {new Date(task.completed_at).toLocaleString()}
                </div>
              </div>
            )}
            {task.cancelled_at && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Cancelled</div>
                <div className="text-sm">
                  {new Date(task.cancelled_at).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
