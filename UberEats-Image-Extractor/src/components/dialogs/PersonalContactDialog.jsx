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
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';
import {
  Loader2,
  Mail,
  Phone,
  ExternalLink,
  Check,
  User,
  Linkedin,
  Instagram,
  Facebook,
  Search,
  Sparkles
} from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../hooks/use-toast';

/**
 * PersonalContactDialog - Dialog for finding and saving personal contact details
 *
 * Provides search links for finding contact information on:
 * - LinkedIn
 * - Instagram
 * - Facebook
 * - Google (for email)
 *
 * And input fields for:
 * - contact_linkedin
 * - contact_instagram
 * - contact_facebook
 * - contact_email
 * - contact_phone
 *
 * Props:
 * - open: boolean
 * - onOpenChange: (open: boolean) => void
 * - restaurant: restaurant object
 * - onDataSaved: () => void - callback after successful save
 */
export function PersonalContactDialog({
  open,
  onOpenChange,
  restaurant,
  onDataSaved
}) {
  // Input values
  const [contactLinkedin, setContactLinkedin] = useState('');
  const [contactInstagram, setContactInstagram] = useState('');
  const [contactFacebook, setContactFacebook] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Saving state
  const [saving, setSaving] = useState(false);

  // Get contact name and restaurant name for search queries
  const contactName = restaurant?.contact_name || '';
  const restaurantName = restaurant?.name || '';

  // Initialize inputs with existing values
  useEffect(() => {
    if (open && restaurant) {
      setContactLinkedin(restaurant.contact_linkedin || '');
      setContactInstagram(restaurant.contact_instagram || '');
      setContactFacebook(restaurant.contact_facebook || '');
      setContactEmail(restaurant.contact_email || '');
      setContactPhone(restaurant.contact_phone || '');
    }
  }, [open, restaurant]);

  // Reset state when dialog closes
  const handleOpenChange = (open) => {
    if (!open) {
      setContactLinkedin('');
      setContactInstagram('');
      setContactFacebook('');
      setContactEmail('');
      setContactPhone('');
      setSaving(false);
    }
    onOpenChange(open);
  };

  // Build search URLs
  const buildSearchUrls = () => {
    const searchTerm = contactName
      ? `${contactName} ${restaurantName}`.trim()
      : restaurantName;

    const city = restaurant?.city || '';

    return {
      linkedin: `https://www.google.com/search?q=${encodeURIComponent(`${searchTerm} LinkedIn`)}`,
      instagram: `https://www.google.com/search?q=${encodeURIComponent(`${searchTerm} Instagram`)}`,
      facebook: `https://www.google.com/search?q=${encodeURIComponent(`${searchTerm} Facebook`)}`,
      email: `https://www.google.com/search?q=${encodeURIComponent(`${searchTerm} email address contact`)}`,
      aiSearch: `https://www.google.com/search?udm=50&q=${encodeURIComponent(`${contactName || ''} ${restaurantName} ${city} instagram, facebook, linkedin, email address, mobile number`)}`
    };
  };

  const searchUrls = buildSearchUrls();

  // Save all contact details
  const handleSave = async () => {
    // Check if at least one field has a value
    if (!contactLinkedin && !contactInstagram && !contactFacebook && !contactEmail && !contactPhone) {
      toast({
        title: 'Nothing to Save',
        description: 'Please enter at least one contact detail',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/contact-extraction/save-personal', {
        restaurantId: restaurant.id,
        contact_linkedin: contactLinkedin || null,
        contact_instagram: contactInstagram || null,
        contact_facebook: contactFacebook || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null
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
      console.error('[PersonalContact] Save error:', error);
      toast({
        title: 'Save Failed',
        description: error.response?.data?.error || error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Check if we have a contact name to search for
  const hasContactName = !!contactName;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-[550px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Find Personal Contact Details
          </DialogTitle>
          <DialogDescription>
            Search for contact information on social platforms and save profile URLs.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Contact Info Header */}
          <div className="bg-muted/50 rounded-md p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Contact:</span>
              <span className="font-medium">{contactName || 'Not set'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Restaurant:</span>
              <span className="font-medium">{restaurantName}</span>
            </div>
          </div>

          {!hasContactName && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3 text-sm text-yellow-800 dark:text-yellow-200">
              No contact name set. Set a contact name first for better search results.
            </div>
          )}

          <Separator />

          {/* Search Links Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Search Links</Label>
            <p className="text-xs text-muted-foreground">
              Click to search, then paste the profile URL below.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <SearchLinkButton
                icon={<Linkedin className="h-4 w-4" />}
                label="LinkedIn"
                url={searchUrls.linkedin}
              />
              <SearchLinkButton
                icon={<Instagram className="h-4 w-4" />}
                label="Instagram"
                url={searchUrls.instagram}
              />
              <SearchLinkButton
                icon={<Facebook className="h-4 w-4" />}
                label="Facebook"
                url={searchUrls.facebook}
              />
              <SearchLinkButton
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                url={searchUrls.email}
              />
              <SearchLinkButton
                icon={<Sparkles className="h-4 w-4" />}
                label="AI Search"
                url={searchUrls.aiSearch}
              />
            </div>
          </div>

          <Separator />

          {/* Input Fields Section */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Profile URLs & Contact Info</Label>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="contact-linkedin" className="text-xs flex items-center gap-1">
                  <Linkedin className="h-3 w-3" />
                  LinkedIn URL
                </Label>
                <Input
                  id="contact-linkedin"
                  value={contactLinkedin}
                  onChange={(e) => setContactLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-instagram" className="text-xs flex items-center gap-1">
                  <Instagram className="h-3 w-3" />
                  Instagram URL
                </Label>
                <Input
                  id="contact-instagram"
                  value={contactInstagram}
                  onChange={(e) => setContactInstagram(e.target.value)}
                  placeholder="https://instagram.com/username"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-facebook" className="text-xs flex items-center gap-1">
                  <Facebook className="h-3 w-3" />
                  Facebook URL
                </Label>
                <Input
                  id="contact-facebook"
                  value={contactFacebook}
                  onChange={(e) => setContactFacebook(e.target.value)}
                  placeholder="https://facebook.com/username"
                />
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="contact-email" className="text-xs flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Contact Email
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@email.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-phone" className="text-xs flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Contact Phone
                </Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+64 21 123 4567"
                />
              </div>
            </div>
          </div>
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
            disabled={saving || (!contactLinkedin && !contactInstagram && !contactFacebook && !contactEmail && !contactPhone)}
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
 * SearchLinkButton - Button that opens a search URL in a new tab
 */
function SearchLinkButton({ icon, label, url }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="justify-start gap-2"
      onClick={() => window.open(url, '_blank')}
    >
      {icon}
      <span>{label}</span>
      <ExternalLink className="h-3 w-3 ml-auto" />
    </Button>
  );
}

export default PersonalContactDialog;
