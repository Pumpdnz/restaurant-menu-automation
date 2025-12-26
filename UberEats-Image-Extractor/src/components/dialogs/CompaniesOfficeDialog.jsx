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
import { ScrollArea } from '../ui/scroll-area';
import {
  Search,
  Loader2,
  Building2,
  User,
  MapPin,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Users,
  FileText,
  Mail
} from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../hooks/use-toast';

/**
 * CompaniesOfficeDialog - Multi-step dialog for NZ Companies Office extraction
 *
 * Step 1: Search by restaurant name and address (editable fields)
 * Step 2: Select companies to extract details from
 * Step 3: Compare companies and select one (if multiple)
 * Step 4: Select which data to save from the selected company
 */
export function CompaniesOfficeDialog({
  open,
  onOpenChange,
  restaurant,
  onDataSaved
}) {
  // Step management
  const [step, setStep] = useState(1);

  // Step 1: Editable search fields
  const [searchName, setSearchName] = useState('');
  const [searchStreet, setSearchStreet] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  // Step 2: Company selection for extraction
  const [selectedCompanies, setSelectedCompanies] = useState([]);

  // Step 3: Detail extraction
  const [extracting, setExtracting] = useState(false);
  const [companyDetails, setCompanyDetails] = useState(null);

  // Step 4: Selected company for saving
  const [selectedCompanyNumber, setSelectedCompanyNumber] = useState(null);

  // Name selection
  const [availableNames, setAvailableNames] = useState([]);
  const [selectedFullLegalName, setSelectedFullLegalName] = useState(null);
  const [selectedContactName, setSelectedContactName] = useState(null);

  // Email selection
  const [availableEmails, setAvailableEmails] = useState([]);
  const [selectedContactEmail, setSelectedContactEmail] = useState(null);

  // Save selection
  const [saving, setSaving] = useState(false);
  const [selections, setSelections] = useState({
    full_legal_name: { save: false, value: null },
    company_name: { save: false, value: null },
    company_number: { save: false, value: null },
    nzbn: { save: false, value: null },
    gst_number: { save: false, value: null },
    contact_name: { save: false, value: null },
    contact_email: { save: false, value: null },
    additional_contacts_metadata: { save: false, value: null }
  });

  // Metadata details expanded state
  const [metadataExpanded, setMetadataExpanded] = useState(false);

  // Parse street from address
  const parseStreetFromAddress = (address) => {
    if (!address) return '';

    const streetTypes = [
      'street', 'road', 'avenue', 'lane', 'place', 'way',
      'crescent', 'drive', 'terrace', 'boulevard', 'court',
      'close', 'parade', 'highway', 'grove', 'rise', 'mews',
      'quay', 'esplanade', 'square', 'walk', 'path', 'row'
    ];

    const addressLower = address.toLowerCase();
    let earliestIndex = -1;
    let matchedType = '';

    for (const streetType of streetTypes) {
      const regex = new RegExp(`\\b${streetType}\\b`, 'i');
      const match = addressLower.match(regex);
      if (match) {
        const index = match.index;
        if (earliestIndex === -1 || index < earliestIndex) {
          earliestIndex = index;
          matchedType = streetType;
        }
      }
    }

    if (earliestIndex !== -1) {
      return address.substring(0, earliestIndex + matchedType.length)
        .replace(/[,\s]+$/, '') // Remove trailing commas and whitespace
        .trim();
    }

    const words = address.split(/\s+/);
    return words.slice(0, 3).join(' ')
      .replace(/[,\s]+$/, '') // Remove trailing commas and whitespace
      .trim();
  };

  // Clean restaurant name for Companies Office search
  // Removes location/store identifiers often appended by delivery platforms
  // Examples: "Texas Chicken (Henderson)" -> "Texas Chicken"
  const cleanRestaurantName = (name) => {
    if (!name) return '';

    // Remove any text in parentheses (common for UberEats/DoorDash location suffixes)
    const cleaned = name
      .replace(/\s*\([^)]*\)\s*/g, '') // Remove all (parenthetical text)
      .trim();

    // Return original if cleaning results in empty string
    return cleaned || name;
  };

  // Convert name to title case (capitalize first letter of each word)
  // Used for contact_name field while full_legal_name stays as-is
  const toTitleCase = (name) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Collect all names from a single company
  const collectNamesFromCompany = (company) => {
    const namesMap = new Map();

    // Collect from directors
    company.directors?.forEach(director => {
      const name = director.full_legal_name || director.name;
      if (name) {
        const key = name.toLowerCase().trim();
        if (!namesMap.has(key)) {
          namesMap.set(key, {
            name,
            source: 'Director',
            position: director.position,
            status: director.status,
            originalData: director
          });
        }
      }
    });

    // Collect from shareholders (individuals only)
    company.shareholders?.forEach(shareholder => {
      if (shareholder.name && shareholder.shareholder_type !== 'Company') {
        const key = shareholder.name.toLowerCase().trim();
        if (!namesMap.has(key)) {
          namesMap.set(key, {
            name: shareholder.name,
            source: 'Shareholder',
            percentage: shareholder.percentage,
            originalData: shareholder
          });
        }
      }
    });

    // Collect from addresses
    company.addresses?.forEach(address => {
      if (address.contact_name) {
        const key = address.contact_name.toLowerCase().trim();
        if (!namesMap.has(key)) {
          namesMap.set(key, {
            name: address.contact_name,
            source: 'Address Contact',
            addressType: address.address_type,
            originalData: address
          });
        }
      }
    });

    return Array.from(namesMap.values());
  };

  // Initialize search fields when dialog opens
  useEffect(() => {
    if (open && restaurant) {
      setSearchName(cleanRestaurantName(restaurant.name || ''));
      setSearchCity(restaurant.city || '');
      setSearchStreet(parseStreetFromAddress(restaurant.address || ''));
    }
  }, [open, restaurant]);

  // Reset state when dialog closes
  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setStep(1);
      setSearchName('');
      setSearchStreet('');
      setSearchCity('');
      setSearching(false);
      setSearchResults(null);
      setSelectedCompanies([]);
      setExtracting(false);
      setCompanyDetails(null);
      setSelectedCompanyNumber(null);
      setAvailableNames([]);
      setSelectedFullLegalName(null);
      setSelectedContactName(null);
      setAvailableEmails([]);
      setSelectedContactEmail(null);
      setSaving(false);
      setMetadataExpanded(false);
      setSelections({
        full_legal_name: { save: false, value: null },
        company_name: { save: false, value: null },
        company_number: { save: false, value: null },
        nzbn: { save: false, value: null },
        gst_number: { save: false, value: null },
        contact_name: { save: false, value: null },
        contact_email: { save: false, value: null },
        additional_contacts_metadata: { save: false, value: null }
      });
    }
    onOpenChange(isOpen);
  };

  // Initialize selections from a selected company
  const initializeSelectionsFromCompany = (company) => {
    const names = collectNamesFromCompany(company);
    setAvailableNames(names);

    // Auto-select first active director as defaults
    const firstActiveDirector = names.find(n => n.source === 'Director' && n.status === 'Active');
    const firstAddressContact = names.find(n => n.source === 'Address Contact');

    // Extract emails from NZBN details
    const emails = company.nzbn_details?.email_addresses || [];
    setAvailableEmails(emails);

    const newSelections = {
      full_legal_name: { save: false, value: null },
      company_name: { save: false, value: null },
      company_number: { save: false, value: null },
      nzbn: { save: false, value: null },
      gst_number: { save: false, value: null },
      contact_name: { save: false, value: null },
      contact_email: { save: false, value: null },
      additional_contacts_metadata: { save: false, value: null }
    };

    if (company.company_info?.company_name) {
      newSelections.company_name = { save: true, value: company.company_info.company_name };
    }
    if (company.company_info?.company_number) {
      newSelections.company_number = { save: true, value: company.company_info.company_number };
    }
    if (company.company_info?.nzbn) {
      newSelections.nzbn = { save: true, value: company.company_info.nzbn };
    }
    if (company.nzbn_details?.gst_numbers?.[0]) {
      newSelections.gst_number = { save: true, value: company.nzbn_details.gst_numbers[0] };
    }

    // Set up name defaults
    // full_legal_name keeps original casing, contact_name uses title case
    if (firstActiveDirector) {
      setSelectedFullLegalName(firstActiveDirector);
      newSelections.full_legal_name = { save: true, value: firstActiveDirector.name };
    }
    if (firstAddressContact) {
      setSelectedContactName(firstAddressContact);
      newSelections.contact_name = { save: true, value: toTitleCase(firstAddressContact.name) };
    } else if (firstActiveDirector) {
      setSelectedContactName(firstActiveDirector);
      newSelections.contact_name = { save: true, value: toTitleCase(firstActiveDirector.name) };
    }

    // Set up email defaults - auto-select first email if available
    if (emails.length > 0) {
      setSelectedContactEmail(emails[0]);
      newSelections.contact_email = { save: true, value: emails[0] };
    }

    // Set up metadata
    newSelections.additional_contacts_metadata = {
      save: true,
      value: {
        directors: company.directors || [],
        shareholders: company.shareholders || [],
        addresses: company.addresses || [],
        nzbn_details: company.nzbn_details || {},
        extraction_date: new Date().toISOString(),
        source_company_number: company.company_info?.company_number,
        source_company_name: company.company_info?.company_name
      }
    };

    setSelections(newSelections);
  };

  // Step 1: Execute search
  const handleSearch = async () => {
    if (!searchName && !searchStreet) {
      toast({
        title: 'Missing Information',
        description: 'Restaurant name or street address is required',
        variant: 'destructive'
      });
      return;
    }

    setSearching(true);
    try {
      const response = await api.post('/companies-office/search', {
        restaurantId: restaurant.id,
        restaurantName: searchName,
        street: searchStreet,
        city: searchCity
      });

      if (response.data.success) {
        setSearchResults(response.data.data);

        const combined = response.data.data.combined || [];
        if (combined.length > 0 && combined.length <= 3) {
          setSelectedCompanies(combined.map(c => c.company_number));
        }

        if (combined.length === 0) {
          toast({
            title: 'No Results',
            description: 'No companies found matching the search criteria',
            variant: 'default'
          });
        } else {
          setStep(2);
        }
      }
    } catch (error) {
      console.error('Companies Office search error:', error);
      toast({
        title: 'Search Failed',
        description: error.response?.data?.error || error.message,
        variant: 'destructive'
      });
    } finally {
      setSearching(false);
    }
  };

  // Step 2: Toggle company selection
  const toggleCompanySelection = (companyNumber) => {
    setSelectedCompanies(prev =>
      prev.includes(companyNumber)
        ? prev.filter(cn => cn !== companyNumber)
        : [...prev, companyNumber]
    );
  };

  // Step 3: Extract details for selected companies
  const handleExtractDetails = async () => {
    if (selectedCompanies.length === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select at least one company',
        variant: 'destructive'
      });
      return;
    }

    setExtracting(true);
    try {
      const response = await api.post('/companies-office/details', {
        restaurantId: restaurant.id,
        companyNumbers: selectedCompanies
      });

      if (response.data.success) {
        setCompanyDetails(response.data.data);

        const validCompanies = response.data.data.companies?.filter(c => !c.error) || [];

        // If only one company, auto-select it
        if (validCompanies.length === 1) {
          setSelectedCompanyNumber(validCompanies[0].company_number);
          initializeSelectionsFromCompany(validCompanies[0]);
        }

        setStep(4);
      }
    } catch (error) {
      console.error('Companies Office details error:', error);
      toast({
        title: 'Extraction Failed',
        description: error.response?.data?.error || error.message,
        variant: 'destructive'
      });
    } finally {
      setExtracting(false);
    }
  };

  // Step 4: Save selected data
  const handleSave = async () => {
    const hasSelection = Object.values(selections).some(s => s.save && s.value);
    if (!hasSelection) {
      toast({
        title: 'No Selection',
        description: 'Please select at least one field to save',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/companies-office/save', {
        restaurantId: restaurant.id,
        selections
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
      console.error('Companies Office save error:', error);
      toast({
        title: 'Save Failed',
        description: error.response?.data?.error || error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 4:
        return renderStep4();
      default:
        return renderStep1();
    }
  };

  // Step 1: Editable search form
  const renderStep1 = () => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Restaurant Name</Label>
        <Input
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="Enter restaurant name to search"
        />
      </div>

      <div className="space-y-2">
        <Label>Street Address</Label>
        <Input
          value={searchStreet}
          onChange={(e) => setSearchStreet(e.target.value)}
          placeholder="e.g., 363 Colombo Street"
        />
        {restaurant?.address && (
          <p className="text-xs text-muted-foreground">
            Parsed from: {restaurant.address}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>City</Label>
        <Input
          value={searchCity}
          onChange={(e) => setSearchCity(e.target.value)}
          placeholder="e.g., Christchurch"
        />
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          We'll search the NZ Companies Office by restaurant name and by address.
          {searchStreet && searchCity && (
            <span className="block mt-1 font-mono text-xs">
              Address search: "{searchStreet} {searchCity}"
            </span>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );

  // Step 2: Company selection
  const renderStep2 = () => (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Found {searchResults?.combined?.length || 0} companies. Select which ones to extract details from.
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCompanies(searchResults?.combined?.map(c => c.company_number) || [])}
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCompanies([])}
          >
            Clear
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {searchResults?.combined?.map((company) => (
            <Card
              key={company.company_number}
              className={`cursor-pointer transition-colors ${
                selectedCompanies.includes(company.company_number)
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => toggleCompanySelection(company.company_number)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedCompanies.includes(company.company_number)}
                    onChange={() => {}}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{company.company_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {company.status || 'Registered'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        <span>Company #: {company.company_number}</span>
                      </div>
                      {company.nzbn && (
                        <div className="flex items-center gap-1">
                          <span>NZBN: {company.nzbn}</span>
                        </div>
                      )}
                      {company.registered_address && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{company.registered_address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <a
                    href={`https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/${company.company_number}/detail`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  // Step 4: Company comparison and data selection
  const renderStep4 = () => {
    const validCompanies = companyDetails?.companies?.filter(c => !c.error) || [];

    if (validCompanies.length === 0) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to extract company details. Please try again.
          </AlertDescription>
        </Alert>
      );
    }

    // If no company selected yet and multiple companies, show comparison view
    if (!selectedCompanyNumber && validCompanies.length > 1) {
      return (
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Review the extracted data and select the correct company for this restaurant.
          </p>

          <ScrollArea className="max-h-[800px] pr-4">
            <div className="space-y-4">
              {validCompanies.map((company) => (
                <CompanyCard
                  key={company.company_number}
                  company={company}
                  onSelect={() => {
                    setSelectedCompanyNumber(company.company_number);
                    initializeSelectionsFromCompany(company);
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }

    // Company selected - show data selection UI
    const selectedCompany = validCompanies.find(c => c.company_number === selectedCompanyNumber) || validCompanies[0];

    return (
      <div className="space-y-4 py-4">
        {/* Selected company header with change option */}
        <div className="flex items-center justify-between bg-primary/10 p-3 rounded-md">
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{selectedCompany.company_info?.company_name}</div>
            <div className="text-xs text-muted-foreground">
              Company #: {selectedCompany.company_info?.company_number}
              {selectedCompany.company_info?.nzbn && ` | NZBN: ${selectedCompany.company_info.nzbn}`}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={selectedCompany.detail_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            {validCompanies.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCompanyNumber(null);
                  setAvailableNames([]);
                  setSelectedFullLegalName(null);
                  setSelectedContactName(null);
                }}
              >
                Change
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[800px] pr-4">
          <div className="space-y-4">
            {/* Company Info Selection */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Company Information
              </h4>

              <SelectionField
                label="Company Name"
                value={selectedCompany.company_info?.company_name}
                checked={selections.company_name.save}
                onChange={(checked) => setSelections(prev => ({
                  ...prev,
                  company_name: {
                    save: checked,
                    value: checked ? selectedCompany.company_info?.company_name : null
                  }
                }))}
                existingValue={restaurant?.company_name}
              />

              <SelectionField
                label="Company Number"
                value={selectedCompany.company_info?.company_number}
                checked={selections.company_number.save}
                onChange={(checked) => setSelections(prev => ({
                  ...prev,
                  company_number: {
                    save: checked,
                    value: checked ? selectedCompany.company_info?.company_number : null
                  }
                }))}
                existingValue={restaurant?.company_number}
              />

              <SelectionField
                label="NZBN"
                value={selectedCompany.company_info?.nzbn}
                checked={selections.nzbn.save}
                onChange={(checked) => setSelections(prev => ({
                  ...prev,
                  nzbn: {
                    save: checked,
                    value: checked ? selectedCompany.company_info?.nzbn : null
                  }
                }))}
                existingValue={restaurant?.nzbn}
              />

              {selectedCompany.nzbn_details?.gst_numbers?.[0] && (
                <SelectionField
                  label="GST Number"
                  value={selectedCompany.nzbn_details.gst_numbers[0]}
                  checked={selections.gst_number.save}
                  onChange={(checked) => setSelections(prev => ({
                    ...prev,
                    gst_number: {
                      save: checked,
                      value: checked ? selectedCompany.nzbn_details.gst_numbers[0] : null
                    }
                  }))}
                  existingValue={restaurant?.gst_number}
                />
              )}
            </div>

            {/* Name Selection Section */}
            <div className="space-y-3 pt-3 border-t">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Selection ({availableNames.length} people found)
              </h4>

              {availableNames.length > 0 ? (
                <>
                  <NameSelectionList
                    names={availableNames}
                    selectedName={selectedFullLegalName}
                    onSelect={(nameObj) => {
                      setSelectedFullLegalName(nameObj);
                      setSelections(prev => ({
                        ...prev,
                        full_legal_name: {
                          save: nameObj !== null,
                          value: nameObj?.name || null
                        }
                      }));
                    }}
                    label="Select Full Legal Name"
                    existingValue={restaurant?.full_legal_name}
                  />

                  <NameSelectionList
                    names={availableNames}
                    selectedName={selectedContactName}
                    onSelect={(nameObj) => {
                      setSelectedContactName(nameObj);
                      setSelections(prev => ({
                        ...prev,
                        contact_name: {
                          save: nameObj !== null,
                          value: nameObj ? toTitleCase(nameObj.name) : null
                        }
                      }));
                    }}
                    label="Select Contact Name"
                    existingValue={restaurant?.contact_name}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No names found in extraction results.</p>
              )}
            </div>

            {/* Email Selection Section */}
            {availableEmails.length > 0 && (
              <div className="space-y-3 pt-3 border-t">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Selection ({availableEmails.length} email{availableEmails.length > 1 ? 's' : ''} found)
                </h4>

                <EmailSelectionList
                  emails={availableEmails}
                  selectedEmail={selectedContactEmail}
                  onSelect={(email) => {
                    setSelectedContactEmail(email);
                    setSelections(prev => ({
                      ...prev,
                      contact_email: {
                        save: email !== null,
                        value: email
                      }
                    }));
                  }}
                  label="Select Contact Email"
                  existingValue={restaurant?.contact_email}
                />
              </div>
            )}

            {/* Metadata Storage Section */}
            <div className="pt-3 border-t">
              <MetadataStorageSection
                company={selectedCompany}
                checked={selections.additional_contacts_metadata.save}
                expanded={metadataExpanded}
                onExpandedChange={setMetadataExpanded}
                onChange={(checked) => setSelections(prev => ({
                  ...prev,
                  additional_contacts_metadata: {
                    save: checked,
                    value: checked ? {
                      directors: selectedCompany.directors || [],
                      shareholders: selectedCompany.shareholders || [],
                      addresses: selectedCompany.addresses || [],
                      nzbn_details: selectedCompany.nzbn_details || {},
                      extraction_date: new Date().toISOString(),
                      source_company_number: selectedCompany.company_info?.company_number,
                      source_company_name: selectedCompany.company_info?.company_name
                    } : null
                  }
                }))}
              />
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  };

  // Get current step title
  const getStepTitle = () => {
    if (step === 1) return 'Search Companies Office';
    if (step === 2) return 'Select Companies';
    if (step === 4) {
      const validCompanies = companyDetails?.companies?.filter(c => !c.error) || [];
      if (!selectedCompanyNumber && validCompanies.length > 1) {
        return 'Compare Companies';
      }
      return 'Save Company Details';
    }
    return 'Companies Office';
  };

  // Get current step description
  const getStepDescription = () => {
    if (step === 1) return 'Search the NZ Companies Office to find business and owner information.';
    if (step === 2) return 'Select which companies to extract detailed information from.';
    if (step === 4) {
      const validCompanies = companyDetails?.companies?.filter(c => !c.error) || [];
      if (!selectedCompanyNumber && validCompanies.length > 1) {
        return 'Review each company and select the correct one for this restaurant.';
      }
      return 'Choose which information to save to the restaurant record.';
    }
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-[800px] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {getStepTitle()}
          </DialogTitle>
          <DialogDescription>
            {getStepDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {renderStepContent()}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => {
                if (step === 4 && selectedCompanyNumber) {
                  // If in data selection, go back to company comparison (if multiple)
                  const validCompanies = companyDetails?.companies?.filter(c => !c.error) || [];
                  if (validCompanies.length > 1) {
                    setSelectedCompanyNumber(null);
                    setAvailableNames([]);
                    setSelectedFullLegalName(null);
                    setSelectedContactName(null);
                    return;
                  }
                }
                setStep(step === 4 ? 2 : 1);
              }}
              className="w-full sm:w-auto"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}

          <div className="flex-1" />

          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          {step === 1 && (
            <Button
              onClick={handleSearch}
              disabled={searching}
              className="w-full sm:w-auto"
            >
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          )}

          {step === 2 && (
            <Button
              onClick={handleExtractDetails}
              disabled={extracting || selectedCompanies.length === 0}
              className="w-full sm:w-auto"
            >
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <ChevronRight className="mr-2 h-4 w-4" />
                  Extract Details ({selectedCompanies.length})
                </>
              )}
            </Button>
          )}

          {step === 4 && selectedCompanyNumber && (
            <Button
              onClick={handleSave}
              disabled={saving}
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
                  Save Selected
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * CompanyCard - Card for company comparison view
 */
function CompanyCard({ company, onSelect }) {
  const activeDirectors = company.directors?.filter(d => d.status === 'Active') || [];
  const shareholders = company.shareholders || [];

  return (
    <Card className="hover:border-primary transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium">{company.company_info?.company_name}</div>
            <div className="text-xs text-muted-foreground space-x-2">
              <span>#{company.company_info?.company_number}</span>
              {company.company_info?.nzbn && <span>| NZBN: {company.company_info?.nzbn}</span>}
              <Badge variant="outline" className="text-xs ml-2">
                {company.company_info?.status || 'Registered'}
              </Badge>
            </div>
          </div>
          <a
            href={company.detail_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="text-xs space-y-1.5 mb-3">
          {activeDirectors.length > 0 && (
            <div className="flex items-start gap-1">
              <User className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                <span className="font-medium">Directors:</span>{' '}
                {activeDirectors.slice(0, 3).map(d => d.full_legal_name || d.name).join(', ')}
                {activeDirectors.length > 3 && ` +${activeDirectors.length - 3} more`}
              </span>
            </div>
          )}
          {shareholders.length > 0 && (
            <div className="flex items-start gap-1">
              <Users className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                <span className="font-medium">Shareholders:</span>{' '}
                {shareholders.slice(0, 2).map(s => `${s.name} (${s.percentage || '?'}%)`).join(', ')}
                {shareholders.length > 2 && ` +${shareholders.length - 2} more`}
              </span>
            </div>
          )}
          {company.addresses?.[0] && (
            <div className="flex items-start gap-1">
              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="truncate">{company.addresses[0].full_address}</span>
            </div>
          )}
        </div>

        <Button onClick={onSelect} className="w-full" size="sm">
          <Check className="h-4 w-4 mr-2" />
          Select This Company
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * NameSelectionList - List of names to select from (click to toggle selection)
 */
function NameSelectionList({ names, selectedName, onSelect, label, existingValue }) {
  const handleClick = (nameObj) => {
    // If clicking the already selected name, deselect it
    if (selectedName?.name === nameObj.name) {
      onSelect(null);
    } else {
      onSelect(nameObj);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {existingValue && (
          <Badge variant="outline" className="text-xs">Current: {existingValue}</Badge>
        )}
      </div>
      <div className="space-y-1 max-h-[225px] overflow-y-auto pr-2 border rounded-md p-2">
        {names.map((nameObj, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
              selectedName?.name === nameObj.name
                ? 'bg-primary/10 border border-primary'
                : 'hover:bg-muted/50 border border-transparent'
            }`}
            onClick={() => handleClick(nameObj)}
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{nameObj.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                <Badge variant="outline" className="text-xs">{nameObj.source}</Badge>
                {nameObj.position && <span>• {nameObj.position}</span>}
                {nameObj.percentage && <span>• {nameObj.percentage}% shares</span>}
                {nameObj.status && (
                  <Badge
                    variant={nameObj.status === 'Active' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {nameObj.status}
                  </Badge>
                )}
              </div>
            </div>
            {selectedName?.name === nameObj.name && (
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
      {!selectedName && (
        <p className="text-xs text-muted-foreground italic">No selection - existing value will not be changed</p>
      )}
    </div>
  );
}

/**
 * EmailSelectionList - List of emails to select from (click to toggle selection)
 */
function EmailSelectionList({ emails, selectedEmail, onSelect, label, existingValue }) {
  const handleClick = (email) => {
    // If clicking the already selected email, deselect it
    if (selectedEmail === email) {
      onSelect(null);
    } else {
      onSelect(email);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {existingValue && (
          <Badge variant="outline" className="text-xs">Current: {existingValue}</Badge>
        )}
      </div>
      <div className="space-y-1 max-h-[150px] overflow-y-auto pr-2 border rounded-md p-2">
        {emails.map((email, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
              selectedEmail === email
                ? 'bg-primary/10 border border-primary'
                : 'hover:bg-muted/50 border border-transparent'
            }`}
            onClick={() => handleClick(email)}
          >
            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{email}</div>
            </div>
            {selectedEmail === email && (
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
      {!selectedEmail && (
        <p className="text-xs text-muted-foreground italic">No selection - existing value will not be changed</p>
      )}
    </div>
  );
}

/**
 * SelectionField - Checkbox field for selecting data to save
 */
function SelectionField({ label, value, checked, onChange, existingValue, description }) {
  if (!value) return null;

  return (
    <div
      className={`flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors ${
        checked ? 'bg-primary/5' : 'hover:bg-muted/50'
      }`}
      onClick={() => onChange(!checked)}
    >
      <Checkbox checked={checked} onChange={() => {}} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{label}</span>
          {existingValue && (
            <Badge variant="outline" className="text-xs">Has existing</Badge>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          Value: <span className="font-mono">{value}</span>
        </p>
        {existingValue && (
          <p className="text-xs text-orange-600 mt-0.5 truncate">
            Current: <span className="font-mono">{existingValue}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * MetadataStorageSection - Section for storing full extraction data with summary
 */
function MetadataStorageSection({ company, checked, expanded, onExpandedChange, onChange }) {
  const activeDirectors = company.directors?.filter(d => d.status === 'Active') || [];
  const shareholders = company.shareholders || [];
  const addresses = company.addresses || [];
  const gstNumbers = company.nzbn_details?.gst_numbers || [];
  const phones = company.nzbn_details?.phone_numbers || [];
  const emails = company.nzbn_details?.email_addresses || [];

  return (
    <div className="space-y-2">
      <div
        className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors ${
          checked ? 'bg-primary/5 border border-primary' : 'hover:bg-muted/50 border border-transparent'
        }`}
        onClick={() => onChange(!checked)}
      >
        <Checkbox checked={checked} onChange={() => {}} className="mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Store Full Extraction Data</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Save all extracted data for future reference
          </p>

          {/* Summary badges */}
          <div className="flex flex-wrap gap-1 mt-2">
            {activeDirectors.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <User className="h-3 w-3 mr-1" />
                {activeDirectors.length} director{activeDirectors.length > 1 ? 's' : ''}
              </Badge>
            )}
            {shareholders.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {shareholders.length} shareholder{shareholders.length > 1 ? 's' : ''}
              </Badge>
            )}
            {addresses.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <MapPin className="h-3 w-3 mr-1" />
                {addresses.length} address{addresses.length > 1 ? 'es' : ''}
              </Badge>
            )}
            {gstNumbers.length > 0 && (
              <Badge variant="outline" className="text-xs">{gstNumbers.length} GST#</Badge>
            )}
            {phones.length > 0 && (
              <Badge variant="outline" className="text-xs">{phones.length} phone{phones.length > 1 ? 's' : ''}</Badge>
            )}
            {emails.length > 0 && (
              <Badge variant="outline" className="text-xs">{emails.length} email{emails.length > 1 ? 's' : ''}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Expandable details */}
      {checked && (
        <div className="ml-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onExpandedChange(!expanded);
            }}
            className="text-xs h-7"
          >
            {expanded ? 'Hide details' : 'Show details'}
          </Button>

          {expanded && (
            <div className="mt-2 text-xs space-y-2 p-2 bg-muted rounded-md max-h-[200px] overflow-y-auto">
              {activeDirectors.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Directors:</div>
                  {activeDirectors.map((d, i) => (
                    <div key={`d-${i}`} className="text-muted-foreground ml-2">
                      • {d.full_legal_name || d.name}
                      {d.position && <span className="text-primary/70"> ({d.position})</span>}
                    </div>
                  ))}
                </div>
              )}
              {shareholders.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Shareholders:</div>
                  {shareholders.map((s, i) => (
                    <div key={`s-${i}`} className="text-muted-foreground ml-2">
                      • {s.name} ({s.percentage || '?'}%)
                    </div>
                  ))}
                </div>
              )}
              {addresses.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Addresses:</div>
                  {addresses.map((a, i) => (
                    <div key={`a-${i}`} className="text-muted-foreground ml-2">
                      • {a.address_type}: {a.full_address}
                      {a.contact_name && <span className="text-primary/70"> (Contact: {a.contact_name})</span>}
                    </div>
                  ))}
                </div>
              )}
              {gstNumbers.length > 0 && (
                <div>
                  <div className="font-medium mb-1">GST Numbers:</div>
                  {gstNumbers.map((g, i) => (
                    <div key={`g-${i}`} className="text-muted-foreground ml-2">• {g}</div>
                  ))}
                </div>
              )}
              {phones.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Phone Numbers:</div>
                  {phones.map((p, i) => (
                    <div key={`p-${i}`} className="text-muted-foreground ml-2">• {p}</div>
                  ))}
                </div>
              )}
              {emails.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Email Addresses:</div>
                  {emails.map((e, i) => (
                    <div key={`e-${i}`} className="text-muted-foreground ml-2">• {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CompaniesOfficeDialog;
