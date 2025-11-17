import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { useToast } from '../../hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';

interface CreateMessageTemplateModalProps {
  open: boolean;
  templateId?: string | null;
  duplicateFromId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateMessageTemplateModal({
  open,
  templateId,
  duplicateFromId,
  onClose,
  onSuccess
}: CreateMessageTemplateModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewRestaurant, setPreviewRestaurant] = useState<any>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);

  const isEditMode = !!templateId;
  const isDuplicateMode = !!duplicateFromId;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'social_message',
    message_content: '',
    is_active: true
  });

  const [extractedVariables, setExtractedVariables] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      if (isEditMode && templateId) {
        fetchTemplate();
      } else if (isDuplicateMode && duplicateFromId) {
        fetchTemplate(duplicateFromId);
      }
      fetchRestaurants();
    }
  }, [open, templateId, duplicateFromId]);

  useEffect(() => {
    // Extract variables from message content
    const variables = extractVariablesFromText(formData.message_content);
    setExtractedVariables(variables);
  }, [formData.message_content]);

  const extractVariablesFromText = (text: string): string[] => {
    if (!text) return [];
    const regex = /{([a-zA-Z_][a-zA-Z0-9_]*)}/g;
    const matches = text.matchAll(regex);
    const variables = new Set<string>();

    for (const match of matches) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  };

  const fetchTemplate = async (id?: string) => {
    const fetchId = id || templateId;
    if (!fetchId) return;

    setFetching(true);
    try {
      const response = await api.get(`/message-templates/${fetchId}`);
      const template = response.data.template;

      setFormData({
        name: template.name || '',
        description: template.description || '',
        type: template.type || 'social_message',
        message_content: template.message_content || '',
        is_active: template.is_active !== undefined ? template.is_active : true
      });
    } catch (err: any) {
      console.error('Failed to fetch template:', err);
      setError('Failed to load template details');
    } finally {
      setFetching(false);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const response = await api.get('/restaurants/list');
      setRestaurants(response.data.restaurants || []);
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    }
  };

  const handlePreview = async () => {
    if (!previewRestaurant) {
      toast({
        title: "Select Restaurant",
        description: "Please select a restaurant to preview the message",
        variant: "destructive"
      });
      return;
    }

    setShowPreview(!showPreview);
  };

  const renderPreview = () => {
    if (!showPreview || !previewRestaurant) return null;

    let preview = formData.message_content;

    // Simple variable replacement for preview
    const variableMap: { [key: string]: any } = {
      restaurant_name: previewRestaurant.name || '',
      contact_name: previewRestaurant.contact_name || '',
      first_name: previewRestaurant.contact_name
        ? previewRestaurant.contact_name.trim().split(/\s+/)[0]
        : '',
      contact_email: previewRestaurant.contact_email || '',
      city: previewRestaurant.city || '',
      cuisine: (() => {
        // Handle array cuisine
        if (Array.isArray(previewRestaurant.cuisine)) {
          return previewRestaurant.cuisine.join(', ');
        }
        // Handle string cuisine
        if (typeof previewRestaurant.cuisine === 'string') {
          return previewRestaurant.cuisine;
        }
        // Handle null/undefined
        return '';
      })(),
      demo_store_url: previewRestaurant.demo_store_url || '',
      organisation_name: previewRestaurant.organisation_name || '',
      subdomain: previewRestaurant.subdomain || '',
      phone: previewRestaurant.phone || '',
      email: previewRestaurant.email || '',
      address: previewRestaurant.address || ''
    };

    extractedVariables.forEach(variable => {
      // Check if variable exists in map (to handle empty strings correctly)
      const value = variable in variableMap ? variableMap[variable] : `{${variable}}`;
      preview = preview.replace(new RegExp(`{${variable}}`, 'g'), value !== '' ? value : '-');
    });

    return (
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <div className="text-sm font-medium mb-2">Preview:</div>
        <div className="text-sm whitespace-pre-wrap">{preview}</div>
      </div>
    );
  };

  const handleSave = async () => {
    if (!formData.name || !formData.type || !formData.message_content) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = isEditMode
        ? await api.patch(`/message-templates/${templateId}`, formData)
        : await api.post('/message-templates', formData);

      if (response.data.success) {
        toast({
          title: "Success",
          description: `Message template ${isEditMode ? 'updated' : 'created'} successfully`
        });
        onSuccess();
        onClose();
        resetForm();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} template`);
      toast({
        title: "Error",
        description: err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} template`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'social_message',
      message_content: '',
      is_active: true
    });
    setExtractedVariables([]);
    setShowPreview(false);
    setPreviewRestaurant(null);
  };

  const availableVariables = [
    { name: 'restaurant_name', description: 'Restaurant name' },
    { name: 'contact_name', description: 'Contact person name' },
    { name: 'first_name', description: 'Contact first name' },
    { name: 'contact_email', description: 'Contact email' },
    { name: 'contact_phone', description: 'Contact phone' },
    { name: 'city', description: 'Restaurant city' },
    { name: 'cuisine', description: 'Cuisine type(s)' },
    { name: 'organisation_name', description: 'Organisation name' },
    { name: 'demo_store_url', description: 'Demo store URL' },
    { name: 'subdomain', description: 'Pumpd subdomain' },
    { name: 'phone', description: 'Restaurant phone' },
    { name: 'email', description: 'Restaurant email' },
    { name: 'address', description: 'Restaurant address' }
  ];

  if (fetching) {
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit' : isDuplicateMode ? 'Duplicate' : 'Create'} Message Template
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update' : isDuplicateMode ? 'Duplicate' : 'Create a'} reusable message template with variable support
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Demo Booking Follow-up"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this template..."
            />
          </div>

          {/* Type and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="social_message">Social Message</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center space-x-2 mt-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked as boolean })}
                />
                <label
                  htmlFor="is_active"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Message Content */}
          <div className="space-y-2">
            <Label htmlFor="message_content">Message Content *</Label>
            <Textarea
              id="message_content"
              value={formData.message_content}
              onChange={(e) => setFormData({ ...formData, message_content: e.target.value })}
              placeholder="Write your message template here. Use {variable_name} for dynamic content."
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {/* Detected Variables */}
          {extractedVariables.length > 0 && (
            <div className="space-y-2">
              <Label>Detected Variables</Label>
              <div className="flex flex-wrap gap-2">
                {extractedVariables.map((variable, idx) => (
                  <Badge key={idx} variant="secondary">
                    {'{' + variable + '}'}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Available Variables Reference */}
          <div className="space-y-2 border-t pt-4">
            <Label>Available Variables</Label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {availableVariables.map((variable) => (
                <div key={variable.name} className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs shrink-0">
                    {'{' + variable.name + '}'}
                  </Badge>
                  <span className="text-muted-foreground">{variable.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Preview Section */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Preview</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePreview}
              >
                {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {showPreview ? 'Hide' : 'Show'} Preview
              </Button>
            </div>
            <Select
              value={previewRestaurant?.id || ''}
              onValueChange={(v) => {
                const restaurant = restaurants.find(r => r.id === v);
                setPreviewRestaurant(restaurant);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select restaurant for preview..." />
              </SelectTrigger>
              <SelectContent>
                {restaurants.map(restaurant => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {renderPreview()}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading
              ? (isEditMode ? 'Updating...' : 'Creating...')
              : (isEditMode ? 'Update Template' : isDuplicateMode ? 'Create Duplicate' : 'Create Template')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
