# Context
We now need to begin planning adding new features for contact details extraction which are very similar to the current v3.0.1 Google Search Extraction Feature. It will require adding a new button to the RestaurantDetail page in the Contact and Lead Info card called “Get Contacts” and new buttons in the the Restaurant Info Card for restaurant email and phone extraction.

These features will need to be feature flagged and have country context from the organization settings, so one of the subagents you spin up will need to investigate the current processes for organization settings, usage tracking and feature flagging.

We need to begin by implementing this in detail for New Zealand, but in the future this needs to be extensible for organizations in other countries to use alternative methods.

## Contact name and business details extraction:
- We need to add contact details extraction to the Contact and Lead Info card in the Restaurant Detail page. This feature will perform a phased extraction and user selection process for validation, similar to the current v3.0.1 Google Search Extraction Feature.

### Information to extract
* Owner Name (Full Legal Name needs to be added to the database)
* NZBN (Needs to be added to the database)
* Company Number (Needs to be added to the database)

### Extraction Steps
Step 1. Parallel Firecrawl Scrape requests to search the companies office by address and restaurant name to extract the company name, company number and NZBN:
- Restaurant Name Search: "https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q=birria+boss&entityStatusGroups=REGISTERED&addressTypes=ALL&advancedPanel=true&mode=advanced#results"
- Address Search: "https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q=&entityStatusGroups=REGISTERED&addressKeyword=17+Hereford+Street+Christchurch&advancedPanel=true&mode=advanced#results"

Schema for step 1 parallel extraction requests:
{
  "type": "object",
  "required": [],
  "properties": {
    "companies": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [],
        "properties": {
          "company_name": {
            "type": "string"
          },
          "company_number": {
            "type": "number"
          },
          "NZBN": {
            "type": "number"
          }
        }
      }
    }
  }
}

Step 2. If at least one company record is found, use batched firecrawl requests to go to each of the companies pages using their company number: Full Details Page View: "https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/9235660/detail"

Instructions for firecrawl and information to retrieve from each company found:

- From the shareholders panel (under the panelContent section with id=”shareholdersPanel”), extract all names, addresses and percentage of shares owned by each shareholder

- From the directors panel (under the panelContent section with id=”directorsPanel”), extract the name and address of each director

- From the addresses panel (under the panelContent section with id=”addressPanel”), extract the Registered Office Address, Address For Service and any names listed with them.
The other sections on the page may have directors and shareholders’ names listed as their full legal name. This data is needed for the uber direct integration. However, for the purposes of prospecting we should get their first and last name only, which will possibly be listed with the addresses.


- From the NZBN details section (under the panelContent section with id=”nzbnDetailsPanel”), extract these fields if shown (Most of this is expected to be missing):
- GST Number(s)
- Phone Number(s)
- Email Address(es)
- Office Address
- Delivery Address
- Postal Address
- Invoice Address
- Trading Name
- Website(s)
- Trading Area(s)
- Industry Classification(s)

Step 3. Once the data for all companies found has been returned, display the results to the user for selection of which results to save

We will need to add Full Legal Name, NZBN and Company number to the restaurants table in the database and as ui fields to the Restaurant Info Card

## Restaurant Email and Phone Extraction:
- We need to add buttons to the Restaurant Info Card, similarly to the “Find Url” buttons which display on the urls on the platform links in the Gathering Info tab Platform Urls card. 
The buttons should be “Find Email” and “Find Phone”, but they should both trigger the same dialog when clicked. The dialog triggered should be similar to the process logo button in the Branding & Visual Identity card on the gathering info tab, in that it should allow the user to either manually extract phone and email or execute a firecrawl request for automatic extraction. The dialog should be laid out as follows:

<dialog_structure>
- Title
- Description
- Multi-select for Restaurant Email and Restaurant Phone (For firecrawl extraction configuration)
- Sources list (Dynamically rendered based on current values for the restaurant) 
Each Source in the list should have two buttons to either open a link in a new tab for manual searching and retrieval or execute a Firecrawl request for automatic retrieval based on the checkboxes selected. The sources should be:
A. Google Business Profile (manual link embedded as Google search query for restaurant name and city “https://www.google.com/search?q=restaurant+name+city”)
B. Website url (if url exists for restaurant)
C. Facebook url (if url exists for restaurant)
- Input fields for the user to paste in the value if found manually for each of restaurant email and restaurant phone (prefilled with existing values if present)
- Save button at the bottom.
</dialog_structure>

If the user executes a firecrawl extraction on a source, the loading state should be handled properly and then the returned value(s) should be shown at the bottom for the user to optionally accept before saving. If a user executes multiple firecrawl requests in parallel or sequentially, results from each source should be displayed as available for the user. The user should be able to click a button next to each result returned to fill the input fields with it and only once they click save on the dialog should the current values of the restaurant phone and restaurant email be saved. 

## Personal Contact Details Extraction:
- In a very similar way to the Restaurant Email and Phone Extraction detailed above, we need to add buttons to the Contact Email and Contact Phone fields on the Contact and Lead Info card. These buttons should both open a similar dialog as described above, but also have fields for contact instagram, contact facebook and contact LinkedIn.

We will need to add contact instagram, contact facebook and contact linkedin to the restaurants table in the database and as ui fields to the Restaurant Info Card. We will also need to add an additional_contacts_metadata json field to the database for storing additional contacts information extracted during the Contact name and business details extraction and Personal Contact Details Extraction.