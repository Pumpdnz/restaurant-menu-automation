import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription } from '../ui/alert';
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';
import {
  Search,
  Loader2,
  Mail,
  Phone,
  Globe,
  Facebook,
  ExternalLink,
  Check,
  AlertCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../hooks/use-toast';

/**
 * EmailPhoneExtractionDialog - Dialog for extracting email/phone from multiple sources
 *
 * Sources:
 * - Google Business Profile (manual search link only)
 * - Website URL (Firecrawl extraction)
 * - Facebook URL (Firecrawl extraction)
 *
 * Props:
 * - open: boolean
 * - onOpenChange: (open: boolean) => void
 * - restaurant: restaurant object
 * - fieldType: 'restaurant' | 'contact' - which fields to update
 * - onDataSaved: () => void - callback after successful save
 */
export function EmailPhoneExtractionDialog({
  open,
  onOpenChange,
  restaurant,
  fieldType = 'restaurant',
  onDataSaved
}) {
  // Extraction settings
  const [extractEmail, setExtractEmail] = useState(true);
  const [extractPhone, setExtractPhone] = useState(true);

  // Manual input values
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  // Extraction states per source
  const [extractingWebsite, setExtractingWebsite] = useState(false);
  const [extractingFacebook, setExtractingFacebook] = useState(false);

  // Extracted results per source
  const [websiteResults, setWebsiteResults] = useState(null);
  const [facebookResults, setFacebookResults] = useState(null);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Initialize manual inputs with existing values
  useEffect(() => {
    if (open && restaurant) {
      if (fieldType === 'restaurant') {
        setManualEmail(restaurant.email || '');
        setManualPhone(restaurant.phone || '');
      } else {
        setManualEmail(restaurant.contact_email || '');
        setManualPhone(restaurant.contact_phone || '');
      }
    }
  }, [open, restaurant, fieldType]);

  // Reset state when dialog closes
  const handleOpenChange = (open) => {
    if (!open) {
      setExtractEmail(true);
      setExtractPhone(true);
      setManualEmail('');
      setManualPhone('');
      setExtractingWebsite(false);
      setExtractingFacebook(false);
      setWebsiteResults(null);
      setFacebookResults(null);
      setSaving(false);
    }
    onOpenChange(open);
  };

  // Build Google search URL
  const getGoogleSearchUrl = () => {
    const query = `${restaurant?.name || ''} ${restaurant?.city || ''} contact`;
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  };

  // Extract from a source
  const handleExtract = async (source) => {
    const sourceUrl = source === 'website' ? restaurant?.website_url : restaurant?.facebook_url;

    if (!sourceUrl) {
      toast({
        title: 'No URL Available',
        description: `No ${source} URL found for this restaurant`,
        variant: 'destructive'
      });
      return;
    }

    const fields = [];
    if (extractEmail) fields.push('email');
    if (extractPhone) fields.push('phone');

    if (fields.length === 0) {
      toast({
        title: 'No Fields Selected',
        description: 'Please select at least email or phone to extract',
        variant: 'destructive'
      });
      return;
    }

    const setExtracting = source === 'website' ? setExtractingWebsite : setExtractingFacebook;
    const setResults = source === 'website' ? setWebsiteResults : setFacebookResults;

    setExtracting(true);
    try {
      const response = await api.post('/contact-extraction/extract', {
        restaurantId: restaurant.id,
        source,
        sourceUrl,
        fields
      });

      if (response.data.success) {
        setResults(response.data.data.extracted);

        const found = [];
        if (response.data.data.extracted.email) found.push('email');
        if (response.data.data.extracted.phone) found.push('phone');

        if (found.length > 0) {
          toast({
            title: 'Extraction Complete',
            description: `Found: ${found.join(', ')}`,
          });
        } else {
          toast({
            title: 'No Data Found',
            description: `Could not find email or phone on ${source}`,
            variant: 'default'
          });
        }
      }
    } catch (error) {
      console.error(`[EmailPhone] ${source} extraction error:`, error);
      toast({
        title: 'Extraction Failed',
        description: error.response?.data?.error || error.message,
        variant: 'destructive'
      });
    } finally {
      setExtracting(false);
    }
  };

  // Accept a result into the manual input
  const handleAcceptResult = (type, value) => {
    if (type === 'email') {
      setManualEmail(value);
    } else if (type === 'phone') {
      setManualPhone(value);
    }
    toast({
      title: 'Value Accepted',
      description: `${type === 'email' ? 'Email' : 'Phone'} has been filled in`,
    });
  };

  // Save the current manual values
  const handleSave = async () => {
    if (!manualEmail && !manualPhone) {
      toast({
        title: 'Nothing to Save',
        description: 'Please enter or extract at least one value',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/contact-extraction/save', {
        restaurantId: restaurant.id,
        fieldType,
        email: manualEmail || null,
        phone: manualPhone || null
      });

      if (response.data.success) {
        toast({
          title: 'Saved Successfully',
          description: `Updated ${response.data.savedFields.length} field(s)`,
        });
        onDataSaved?.();
        handleOpenChange(false);
      }
    } catch (error) {
      console.error('[EmailPhone] Save error:', error);
      toast({
        title: 'Save Failed',
        description: error.response?.data?.error || error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Check if any source has the URL
  const hasWebsiteUrl = !!restaurant?.website_url;
  const hasFacebookUrl = !!restaurant?.facebook_url;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-[550px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {fieldType === 'restaurant' ? (
              <>
                <Globe className="h-5 w-5" />
                Find Restaurant Email & Phone
              </>
            ) : (
              <>
                <Mail className="h-5 w-5" />
                Find Contact Email & Phone
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Search multiple sources to find {fieldType === 'restaurant' ? 'business' : 'contact'} email and phone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Field Selection */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="extract-email"
                checked={extractEmail}
                onCheckedChange={setExtractEmail}
              />
              <Label htmlFor="extract-email" className="flex items-center gap-1 cursor-pointer">
                <Mail className="h-4 w-4" />
                Email
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="extract-phone"
                checked={extractPhone}
                onCheckedChange={setExtractPhone}
              />
              <Label htmlFor="extract-phone" className="flex items-center gap-1 cursor-pointer">
                <Phone className="h-4 w-4" />
                Phone
              </Label>
            </div>
          </div>

          <Separator />

          {/* Sources List */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Sources</Label>

            {/* Google Business Profile - Manual Only */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Google Business Profile</span>
                    <Badge variant="outline" className="text-xs">Manual</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(getGoogleSearchUrl(), '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Search
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Search - Manual Only */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">AI Search</span>
                    <Badge variant="outline" className="text-xs">Manual</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const query = encodeURIComponent(`${restaurant?.name || ''} ${restaurant?.city || ''} email address, mobile number`);
                      window.open(`https://www.google.com/search?udm=50&q=${query}`, '_blank');
                    }}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Search
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Website URL */}
            <Card className={!hasWebsiteUrl ? 'opacity-50' : ''}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium">Website</span>
                    </div>
                    {hasWebsiteUrl && (
                      <p className="text-xs text-muted-foreground truncate mt-1 ml-6">
                        {restaurant.website_url}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {hasWebsiteUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(restaurant.website_url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExtract('website')}
                      disabled={!hasWebsiteUrl || extractingWebsite}
                    >
                      {extractingWebsite ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Extract'
                      )}
                    </Button>
                  </div>
                </div>

                {/* Website Results */}
                {websiteResults && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {websiteResults.email && (
                      <ResultRow
                        type="email"
                        value={websiteResults.email}
                        onAccept={() => handleAcceptResult('email', websiteResults.email)}
                      />
                    )}
                    {websiteResults.phone && (
                      <ResultRow
                        type="phone"
                        value={websiteResults.phone}
                        onAccept={() => handleAcceptResult('phone', websiteResults.phone)}
                      />
                    )}
                    {!websiteResults.email && !websiteResults.phone && (
                      <p className="text-xs text-muted-foreground italic">No contact info found</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Facebook URL - Manual Only (Firecrawl blocked) */}
            <Card className={!hasFacebookUrl ? 'opacity-50' : ''}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Facebook className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium">Facebook</span>
                      <Badge variant="outline" className="text-xs">Manual</Badge>
                    </div>
                    {hasFacebookUrl && (
                      <p className="text-xs text-muted-foreground truncate mt-1 ml-6">
                        {restaurant.facebook_url}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {hasFacebookUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(restaurant.facebook_url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    )}
                  </div>
                </div>
                {hasFacebookUrl && (
                  <p className="text-xs text-muted-foreground mt-2 ml-6">
                    Automatic extraction not available. Please search manually.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Manual Input Fields */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Values to Save</Label>

            <div className="space-y-2">
              <Label htmlFor="manual-email" className="text-xs flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {fieldType === 'restaurant' ? 'Restaurant Email' : 'Contact Email'}
              </Label>
              <Input
                id="manual-email"
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-phone" className="text-xs flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {fieldType === 'restaurant' ? 'Restaurant Phone' : 'Contact Phone'}
              </Label>
              <Input
                id="manual-phone"
                type="tel"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="+64 9 123 4567"
              />
            </div>
          </div>

          {/* Warning about existing values */}
          {((fieldType === 'restaurant' && (restaurant?.email || restaurant?.phone)) ||
            (fieldType === 'contact' && (restaurant?.contact_email || restaurant?.contact_phone))) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                This will overwrite existing values. Current:{' '}
                {fieldType === 'restaurant' ? (
                  <>
                    {restaurant?.email && `Email: ${restaurant.email}`}
                    {restaurant?.email && restaurant?.phone && ', '}
                    {restaurant?.phone && `Phone: ${restaurant.phone}`}
                  </>
                ) : (
                  <>
                    {restaurant?.contact_email && `Email: ${restaurant.contact_email}`}
                    {restaurant?.contact_email && restaurant?.contact_phone && ', '}
                    {restaurant?.contact_phone && `Phone: ${restaurant.contact_phone}`}
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || (!manualEmail && !manualPhone)}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ResultRow - Display an extracted result with accept button
 */
function ResultRow({ type, value, onAccept }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        {type === 'email' ? (
          <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        ) : (
          <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        )}
        <span className="truncate font-mono text-xs">{value}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onAccept}
        className="flex-shrink-0 h-7 px-2"
      >
        <ArrowRight className="h-3 w-3 mr-1" />
        Accept
      </Button>
    </div>
  );
}

export default EmailPhoneExtractionDialog;
