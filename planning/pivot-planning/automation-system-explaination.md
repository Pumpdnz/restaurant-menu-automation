Here is the initial context of how lead data is processed for your consideration when creating a new video demo plan:
I want to show how the leads get in to the crm in the first place from a meta ad lead form containing these fields (examples included but I will use a real customer):

<lead_form>
restaurant_name: Pumpd Pizza
contact_name: Gianni Munro
contact_phone: 0223113693
contact_email: gianni@pumpd.co.nz
weekly_sales_on_ubereats: $10,000+
city: Christchurch
</lead_form>

Our meta ads form is connected via a webhook to send the data to a Pabbly workflow automation. This automation adds a task to follow up with the new lead in my Google Calendar, creates a contact and a company in HubSpot, creates a deal in the new lead stage in HubSpot, creates associations between the contact, the company and the deal, then finally makes an API POST request to create a new record in the restaurants table in my Supabase database.

I also want to show the lead data scraping which is actually with Firecrawl - not Playwright. There are multiple layers to the Firecrawl scrape because when I set this all up the first time, I noticed that there was often incomplete or inaccurate data. The server tracks which data is missing after each scrape is returned and dynamically chooses the next search term based on the missing data. There is a single “Google Search” button which executes all Firecrawl API requests, validates the data, and updates the record automatically. The data returned includes these fields:

<google_search_fields>
Address
Restaurant Phone
Business Hours
(Then it tries to find up to 5 of the following links:)
Website URL
UberEats URL
DoorDash URL
Instagram URL
Facebook URL
Various specific platform URLs (Foodhub, Ordermeal, Me&U, Mobi2go, Delivereasy, NextOrder, etc..)
</google_search_fields>

There is a second fallback option for human intervention when/if this data isn’t perfect. For example, the address and business hours may be scraped from an inaccurate source or not be found in the initial search. This fallback allows the user to click a "Get Details" button next to the UberEats, DoorDash or Website URL fields in the "Platforms and UI" tab of the RestaurantDetail page, and allows the user to select which missing fields to re-scrape. They can choose from the address, hours and/or phone number for the website url, the hours and/or address for the UberEats URL and only the opening hours from the DoorDash URL. This is because we have found that the custom actions and instructions we send to Firecrawl for getting this information from each source is only accurate for these fields on each url. (we should also investigate the codebase to see the exact fallback mechanisms and validation strategies for each of this steps and fallbacks.

The third fallback is that when all scrapes fail, the user can easily click an "Edit Details" button, which allows them to manually edit any of the values.

Whichever method or source is used, the system properly handles multiple business hours time slots and even midnight crossing time slots, splitting them into two different times on different days. It also properly formats the hours in 24 hour time. This is required becuase the onboarding automation system later uses a playwright script to configure the hours on the Cloudwaitress restaurant registration form. 

For example, if a business had these hours on Google Business, UberEats or their website:
- Monday: 11:00am to 2:00pm and 4:00pm to 10:00pm
- Tuesday: 4:00pm to 10:00pm
- Wednesday: 11:00am to 2:00pm and 4:00pm to 10:00pm
- Thursday: 11:00am to 2:00pm and 4:00pm to 10:00pm
- Friday: 11:00am to 2:00pm and 4:00pm to 2:00am
- Saturday: 11:00am to 2:00pm and 4:00pm to 2:00am
- Sunday: 11:00am to 2:00pm and 4:00pm to 10:00pm
Then, the jsonb opening_hours value in the restaurants table record in our database would be stored as:
[
  {
    "day": "Monday",
    "hours": {
      "open": "11:00",
      "close": "14:00"
    }
  },
  {
    "day": "Monday",
    "hours": {
      "open": "16:00",
      "close": "22:00"
    }
  },
  {
    "day": "Tuesday",
    "hours": {
      "open": "16:00",
      "close": "22:00"
    }
  },
  {
    "day": "Wednesday",
    "hours": {
      "open": "11:00",
      "close": "14:00"
    }
  },
  {
    "day": "Wednesday",
    "hours": {
      "open": "16:00",
      "close": "22:00"
    }
  },
  {
    "day": "Thursday",
    "hours": {
      "open": "11:00",
      "close": "14:00"
    }
  },
  {
    "day": "Thursday",
    "hours": {
      "open": "16:00",
      "close": "22:00"
    }
  },
  {
    "day": "Friday",
    "hours": {
      "open": "11:00",
      "close": "14:00"
    }
  },
  {
    "day": "Friday",
    "hours": {
      "open": "16:00",
      "close": "23:59"
    }
  },
  {
    "day": "Saturday",
    "hours": {
      "open": "00:00",
      "close": "02:00"
    }
  },
  {
    "day": "Saturday",
    "hours": {
      "open": "11:00",
      "close": "14:00"
    }
  },
  {
    "day": "Saturday",
    "hours": {
      "open": "16:00",
      "close": "23:59"
    }
  },
  {
    "day": "Sunday",
    "hours": {
      "open": "00:00",
      "close": "02:00"
    }
  },
  {
    "day": "Sunday",
    "hours": {
      "open": "11:00",
      "close": "14:00"
    }
  },
  {
    "day": "Sunday",
    "hours": {
      "open": "16:00",
      "close": "22:00"
    }
  }
]

We should highlight the midnight crossing hours detection and validation in our codebase (this will require investigation of the code before writing the plan).

Next, the user can go to the branding tab in the RestaurantDetail page and execute a logo extraction via Firecrawl. The firecrawl scrape will return a series of logo candidates from the website url and rate them on probability of being the correct logo image. The user can then select which one of the candidates is the actual logo for the system to process, or go to the url and copy the image url back into the UI for processing if the scrape does not return the logo as any of the logo candidates. The user can also select which of the other images they want to save for later (if desired) since we might as well keep those images if they could be useful for marketing. Once the correct logo image is selected or inputed, the system uses Sharp image processing and the RemoveBG API to process the logo into various formats for later onboarding automation, such as main logo image, BG removed logo, favicon logo, and 4 different options for the thermal printer image with different configurations to maximise likelihood that there will be at least one which is properly processed into a good looking thermal image. Further, the user can reprocess a logo and select which versions to replace if they find that the businesses logo is not ideal for all use cases. The system also extracts 5 colors from the logo for later use and decides whether the business uses a dark or light theme for their branding. The user can also edit any of these fields manually with the "Edit Details" button.

Next, the user can select any of the platform urls and perform our most impressive scrape feature: getting all menu data and images from the page and storing it in a structured way for later use. The user can select a standard extraction or (if they are extracting from UberEats) they can select a premium extract, which gets the dialog ids of each menu item and cleans them to get the specific menu item landing pages which it then performs individual scrpaes on to get very accurate data including option sets. When the premium method is selected, the option sets for each menu item are then deduplicated before storage and menu items are linked to the option sets via a junction table. All menu data is editable in a nice UI before doing anything with it as well.

Once the user is satisfied with the menu data (usually on the first try), they can then click a button to upload the images to the Cloudwaitress CDN and get the image ids back. The image ids can then be included in a csv with the full menu data and used later when running the playwright script to upload the menu to the Cloudwaitress dashboard.

Once all information has been gathered, the user can then navigate to the "Pumpd Registration" tab of the RestaurantDetail page and go through a series of steps to:
1. Register the user account (Via API)
2. Register the restaurant (Playwright script navigating to the Pumpd/Cloudwaitress signup page)
3. Upload the CSV Menu (Playwright script navigating to the Pumpd/Cloudwaitress login page, entering the users login details, navigating to the menus page and importing the csv file we generated from the scraped menu data)
4. Add item tags (Playwright script navigating to the Pumpd/Cloudwaitress login page, entering the user's login details, navigating to the menus page and configuring the tags we have predefined)
5. Add Option Sets if premium extraction was used (Playwright script navigating to the Pumpd/Cloudwaitress login page, entering the users login details, navigating to the menus page and configuring the option sets based on data we scraped from the menu, also applying them to the correct menu items)
6. Generate custom CSS and Javascript code injections (Playwright script to login to the Pumpd marketing webapp with a Super admin system account, navigate to the code injections generator page, fill in primary and secondary colors, select the theme (light or dark), select a preset, then configure the individual components (such as setting the restaurant name for the welcome message), then export the head and body tag code injections generated for upload in the subsequent step
7. Configure website settings (Playwright script navigating to the Pumpd/Cloudwaitress login page, entering the users login details, navigating to the website settings page, adding logo images, configuring brand colors, adding SEO data (Title: “Beach Pizza 12 Hall Street - Order Online for Delivery or Pickup” and Store Page Meta: “12 Hall Street, Pukekohe 2120 099477326 - Best Pizza in Pukekohe”), adding the custom code injections and adding social media links.
8. Configure other settings such as delivery and pickup settings for things like auto status update times and Stripe Payments setup (Playwright scripts)
9. Create a new onboarding user account in the Pumpd marketing hub database with role "new_sign_up"
10. Update the new record using all data we've scraped
11. (If the deal ends up closed) - Get data from the fully completed onboarding dashboard (GST number, NZBN, google auth login client ID, etc) and use it to: 
11a. Configure all system settings on the Pumpd/Cloudwaitress portal such as setting up receipt printers, adding thermal logo images and GST numbers to them in preparation for integration during the final stages of onboarding, adding Google Auth Client id for google login, configuring a webhook and API key for the restaurant and returning the secret for integration of customer order data into the Pumpd marketing app when the new prospect is live with our ordering platform
11b. Completing the Uber Direct integration with the business data aquired during onboarding

This entire process can be run by clicking single buttons for each step and many of the steps can even be run in parallel. I want the video demo to show me click several buttons at once and we will run the playwright scripts with headless=FALSE to show them executing on the recording in parallel.

Next, the user can navigate to the main Restaurants page (CRM) and use our sales features to enroll the new lead in a sequence which sets up tasks from templates which prefill emails and texts. This allows them to reach out to the prospect with super personalised outreach and close more deals. We will delve into the sales-specific features more later

Somehow during this entire process I want to explain how I initially set this up with Claude Code subagents and a custom slash command containing instructions for the orchestration agent of when to use the various subagents depending on their responses. I would input the lead form data and the entire process would be executed, but when a step failed or wasn’t perfect, the data wasn’t persisted to the database and there was no easy way to intervene, so I set up this human in the loop UI to enable the perfect balance between automation and control.