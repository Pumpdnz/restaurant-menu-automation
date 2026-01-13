# Investigation Task 5: State Management Analysis

## Overview
Documentation of all registration-related state variables for structuring the Yolo Mode dialog form.

---

## State Variables by Section

### Account Section

| Variable | Type | Default | Source |
|----------|------|---------|--------|
| `registrationEmail` | string | '' | User input |
| `registrationPassword` | string | '' | User input |
| `showPassword` | boolean | false | UI toggle |
| `registrationType` | string | '' | User selection |

**Auto-populated from restaurant:**
- `restaurant.user_email`
- `restaurant.user_password_hint`
- `restaurant.phone` (required for registration)

---

### Restaurant Section

| Variable | Type | Default | Source |
|----------|------|---------|--------|
| `editedData.name` | string | - | restaurant.name |
| `editedData.phone` | string | - | restaurant.phone |
| `editedData.address` | string | - | restaurant.address |
| `editedData.city` | string | - | restaurant.city |
| `editedData.opening_hours` | object | - | restaurant.opening_hours |
| `editedData.cuisine` | array | - | restaurant.cuisine |
| `editedData.subdomain` | string | - | restaurant.subdomain |

---

### Menu Section

| Variable | Type | Default | Source |
|----------|------|---------|--------|
| `selectedMenuForOptionSets` | string | '' | User selection |
| `selectedMenuForImport` | string | '' | User selection |
| `csvFile` | File | null | File input |

**Available menus from:** `restaurant.menus[]`

---

### Website Configuration Section

| Variable | Type | Default | Source |
|----------|------|---------|--------|
| `headerEnabled` | boolean | false | User input |
| `headerBgSource` | string | 'website_og_image' | User selection |
| `itemLayout` | string | 'list' | User selection |
| `noGradient` | boolean | false | User input |

**Text Color Configuration:**
| Variable | Type | Default |
|----------|------|---------|
| `navTextColorSource` | string | 'white' (dark) / 'secondary' (light) |
| `navTextCustomColor` | string | '' |
| `boxTextColorSource` | string | 'white' (dark) / 'secondary' (light) |
| `boxTextCustomColor` | string | '' |

**Logo Tinting (Nav):**
| Variable | Type | Default |
|----------|------|---------|
| `navLogoDarkTint` | string | 'none' |
| `navLogoDarkCustomColor` | string | '' |
| `navLogoLightTint` | string | 'none' |
| `navLogoLightCustomColor` | string | '' |

**Logo Tinting (Header):**
| Variable | Type | Default |
|----------|------|---------|
| `headerLogoDarkTint` | string | 'none' |
| `headerLogoDarkCustomColor` | string | '' |
| `headerLogoLightTint` | string | 'none' |
| `headerLogoLightCustomColor` | string | '' |

---

### Branding Section

From `restaurant` object:
| Field | Type | Description |
|-------|------|-------------|
| `primary_color` | string | Primary brand color (hex) |
| `secondary_color` | string | Secondary color |
| `tertiary_color` | string | Tertiary color |
| `accent_color` | string | Accent color |
| `background_color` | string | Background color |
| `theme` | string | 'light' or 'dark' |
| `logo_url` | string | Main logo URL |
| `logo_nobg_url` | string | Logo without background |
| `logo_thermal_url` | string | Thermal printer version |
| `logo_favicon_url` | string | Favicon version |

**Header Background Options:**
| Field | Source |
|-------|--------|
| `website_og_image` | Website meta image |
| `ubereats_og_image` | UberEats image |
| `doordash_og_image` | DoorDash image |
| `facebook_cover_image` | Facebook cover |

---

### Payment Section

| Variable | Type | Default | Source |
|----------|------|---------|--------|
| `includeConnectLink` | boolean | false | User input |
| `stripe_connect_url` | string | - | restaurant.stripe_connect_url |

---

### Onboarding Section (Feature-Flagged)

| Variable | Type | Default | Source |
|----------|------|---------|--------|
| `onboardingUserEmail` | string | '' | restaurant.contact_email |
| `onboardingUserName` | string | '' | restaurant.contact_name |
| `onboardingUserPassword` | string | '' | User input or auto-generated |
| `onboardingStripeConnectUrl` | string | '' | restaurant.stripe_connect_url |

---

### System Settings Section

| Variable | Type | Default | Source |
|----------|------|---------|--------|
| `receiptLogoVersion` | string | 'logo_thermal_url' | User selection |

**Available versions:**
- `logo_url`
- `logo_nobg_url`
- `logo_thermal_url`
- `logo_thermal_alt_url`
- `logo_favicon_url`

---

## Restaurant Object Structure

From `/api/restaurants/:id/details`:

```typescript
interface Restaurant {
  // Identity
  id: string;
  name: string;
  slug: string;
  subdomain: string;

  // Contact
  email: string;
  phone: string;
  address: string;
  city: string;

  // Business
  opening_hours: OpeningHours;
  cuisine: string[];
  contact_name: string;
  contact_email: string;
  contact_phone: string;

  // Branding
  primary_color: string;
  secondary_color: string;
  tertiary_color: string;
  accent_color: string;
  background_color: string;
  theme: 'light' | 'dark';

  // Logos
  logo_url: string;
  logo_nobg_url: string;
  logo_thermal_url: string;
  logo_favicon_url: string;

  // Header Images
  website_og_image: string;
  ubereats_og_image: string;

  // Platform URLs
  website_url: string;
  ubereats_url: string;
  doordash_url: string;

  // Account
  user_email: string;
  user_password_hint: string;
  stripe_connect_url: string;

  // Relations
  menus: Menu[];
}
```

---

## Registration Status Structure

```typescript
interface RegistrationStatus {
  success: boolean;
  account: {
    id: string;
    email: string;
    registration_status: 'pending' | 'completed' | 'failed';
    pumpd_user_id: string;
  } | null;
  pumpdRestaurant: {
    id: string;
    pumpd_restaurant_id: string;
    pumpd_subdomain: string;
    registration_status: 'pending' | 'completed' | 'failed';
    dashboard_url: string;
  } | null;
  hasAccount: boolean;
  hasRestaurant: boolean;
}
```

---

## Recommended Yolo Mode Form State Structure

```typescript
interface YoloModeFormState {
  // Section 1: Account
  account: {
    registerNewUser: boolean;
    email: string;
    password: string;
    phone: string;
  };

  // Section 2: Restaurant
  restaurant: {
    registrationMode: 'new_account_with_restaurant' | 'existing_account_first_restaurant' | 'existing_account_additional_restaurant';
    name: string;
    phone: string;
    address: string;
    city: string;
    subdomain: string;
    opening_hours: object;
  };

  // Section 3: Menu
  menu: {
    selectedMenuId: string;
    uploadImages: boolean;
    addOptionSets: boolean;
    addItemTags: boolean;
  };

  // Section 4: Website
  website: {
    theme: 'light' | 'dark';
    cuisine: string;
    primaryColor: string;
    secondaryColor: string;
    disableGradients: boolean;
    configureHeader: boolean;
    headerImageSource: string;
    headerLogoSource: string;
    headerLogoDarkTint: string;
    headerLogoLightTint: string;
    navLogoSource: string;
    navLogoDarkTint: string;
    navLogoLightTint: string;
    navTextColor: string;
    faviconSource: string;
    itemLayout: 'list' | 'card';
  };

  // Section 5: Payment & Services
  payment: {
    includeStripeLink: boolean;
  };

  // Section 6: Onboarding (Feature-Flagged)
  onboarding: {
    createOnboardingUser: boolean;
    syncOnboardingRecord: boolean;
    userName: string;
    userEmail: string;
    userPassword: string;
  };
}
```

---

## State Initialization Pattern

```javascript
const initializeYoloModeForm = (restaurant, registrationStatus) => {
  return {
    account: {
      registerNewUser: !registrationStatus?.hasAccount,
      email: restaurant.user_email || restaurant.email || '',
      password: restaurant.user_password_hint || generateDefaultPassword(restaurant.name),
      phone: restaurant.phone || '',
    },

    restaurant: {
      registrationMode: determineRegistrationMode(registrationStatus),
      name: restaurant.name || '',
      phone: restaurant.phone || '',
      address: restaurant.address || '',
      city: restaurant.city || '',
      subdomain: restaurant.subdomain || generateSubdomain(restaurant.name),
      opening_hours: restaurant.opening_hours || {},
    },

    menu: {
      selectedMenuId: restaurant.menus?.[0]?.id || '',
      uploadImages: true,
      addOptionSets: true,
      addItemTags: true,
    },

    website: {
      theme: restaurant.theme || 'dark',
      cuisine: restaurant.cuisine?.[0] || '',
      primaryColor: restaurant.primary_color || '#000000',
      secondaryColor: restaurant.secondary_color || '#FFFFFF',
      disableGradients: false,
      configureHeader: !!restaurant.website_og_image,
      headerImageSource: 'website_og_image',
      headerLogoSource: 'logo_nobg_url',
      headerLogoDarkTint: 'none',
      headerLogoLightTint: 'none',
      navLogoSource: 'logo_nobg_url',
      navLogoDarkTint: 'none',
      navLogoLightTint: 'none',
      navTextColor: restaurant.theme === 'light' ? 'secondary' : 'white',
      faviconSource: 'logo_favicon_url',
      itemLayout: 'list',
    },

    payment: {
      includeStripeLink: false,
    },

    onboarding: {
      createOnboardingUser: true,
      syncOnboardingRecord: true,
      userName: restaurant.contact_name || '',
      userEmail: restaurant.contact_email || '',
      userPassword: '',
    },
  };
};

// Helper functions
const generateDefaultPassword = (restaurantName) => {
  const cleaned = restaurantName.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() + '789!';
};

const determineRegistrationMode = (status) => {
  if (!status?.hasAccount) return 'new_account_with_restaurant';
  if (!status?.hasRestaurant) return 'existing_account_first_restaurant';
  return 'existing_account_additional_restaurant';
};

const generateSubdomain = (name) => {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
};
```

---

## Key Observations

1. **State scattered across ~50 useState calls** - Need consolidated form state for dialog
2. **Auto-population from restaurant data** - Many fields have fallbacks to restaurant object
3. **Conditional defaults based on theme** - Text colors change based on light/dark theme
4. **Feature-flagged sections** - Onboarding section only shown if flags enabled
5. **Registration mode logic** - Depends on current registration status
6. **Menu selection required** - For option sets and item tags
7. **Color/logo options** - Multiple sources and tinting options to choose from
