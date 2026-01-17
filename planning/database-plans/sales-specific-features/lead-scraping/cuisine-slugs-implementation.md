# UberEats Cuisine Slugs Implementation

**Status: COMPLETED**

## Overview

A database table storing 196 UberEats cuisine categories with their corresponding URL slugs. Users can search and select cuisines from a dropdown when creating lead scrape jobs, ensuring valid URLs are generated for the extraction process.

## Slug Mapping Rules

1. **Remove "Food"** from the end of names (e.g., "Australian Food" → "australian")
   - Exception: "Soul food" → "soul-food" (keeps "food" in slug)
2. **Convert to lowercase**
3. **Replace spaces with dashes** (e.g., "Ice cream and frozen yoghurt" → "ice-cream-and-frozen-yoghurt")
4. **Keep existing dashes** (e.g., "Gluten-free" → "gluten-free")

## Database Schema

```sql
CREATE TABLE ubereats_cuisines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ubereats_cuisines_slug ON ubereats_cuisines(slug);
CREATE INDEX idx_ubereats_cuisines_active ON ubereats_cuisines(is_active) WHERE is_active = true;
```

## Complete Cuisine Mapping (196 entries)

| Display Name | Slug |
|-------------|------|
| 24 hours food | 24-hours |
| Acai | acai |
| Afghan Food | afghan |
| African Food | african |
| American Food | american |
| Entrees | entrees |
| Arabian Food | arabian |
| Armenian Food | armenian |
| Asian Food | asian |
| Asian Fusion Food | asian-fusion |
| Australian Food | australian |
| Bacon | bacon |
| Bakery | bakery |
| Bangladeshi Food | bangladeshi |
| Bar Food | bar |
| BBQ | bbq |
| Beef dishes | beef-dishes |
| Belgian Food | belgian |
| Bento | bento |
| Biryani | biryani |
| Bistro | bistro |
| Brazilian Food | brazilian |
| Bread dishes | bread-dishes |
| Breakfast and brunch | breakfast-and-brunch |
| British Food | british |
| Bubble tea | bubble-tea |
| Burgers | burgers |
| Cafe | cafe |
| Cajun Food | cajun |
| Cakes | cakes |
| Canadian Food | canadian |
| Candy | candy |
| Cantonese Food | cantonese |
| Caribbean Food | caribbean |
| Charcuterie | charcuterie |
| Chili | chili |
| Chinese Food | chinese |
| Coffee and tea | coffee-and-tea |
| Colombian Food | colombian |
| Comfort Food | comfort |
| Congee | congee |
| Convenience | convenience |
| Couscous | couscous |
| Cuban Food | cuban |
| Cupcakes | cupcakes |
| Cured meat | cured-meat |
| Curry | curry |
| Custard | custard |
| Deli | deli |
| Desserts | desserts |
| Dim sum | dim-sum |
| Diner | diner |
| Dinner | dinner |
| Dominican Food | dominican |
| Doughnuts | doughnuts |
| Dosa | dosa |
| Drink | drink |
| Dutch Food | dutch |
| Eastern European Food | eastern-european |
| Eggs | eggs |
| English Food | english |
| Ethiopian Food | ethiopian |
| European Food | european |
| Family meals | family-meals |
| Fast food | fast-food |
| Filipino Food | filipino |
| Fish and chips | fish-and-chips |
| French Food | french |
| Frozen food | frozen |
| Georgian Food | georgian |
| German Food | german |
| Gluten-free | gluten-free |
| Gourmet | gourmet |
| Greek Food | greek |
| Grill | grill |
| Grocery | grocery |
| Haitian Food | haitian |
| Halal | halal |
| Hawaiian Food | hawaiian |
| Healthy Food | healthy |
| Hibachi | hibachi |
| Hotpot | hotpot |
| Ice cream and frozen yoghurt | ice-cream-and-frozen-yoghurt |
| Indian Food | indian |
| Indian curry | indian-curry |
| Indonesian Food | indonesian |
| Irish Food | irish |
| Italian Food | italian |
| Jamaican Food | jamaican |
| Japanese Food | japanese |
| Japanese curry | japanese-curry |
| Jewish Food | jewish |
| Juice and smoothies | juice-and-smoothies |
| Kebabs | kebabs |
| Kid-friendly | kid-friendly |
| Korean Food | korean |
| Korean BBQ | korean-bbq |
| Kosher Food | kosher |
| Lasagne | lasagne |
| Late night | late-night |
| Latin American Food | latin-american |
| Latin-fusion | latin-fusion |
| Lebanese Food | lebanese |
| Lobster | lobster |
| Low calorie | low-calorie |
| Low carb | low-carb |
| Mac and cheese | mac-and-cheese |
| Malaysian Food | malaysian |
| Matcha | matcha |
| Mediterranean Food | mediterranean |
| Mexican Food | mexican |
| Middle Eastern Food | middle-eastern |
| Milkshake | milkshake |
| Modern Asian Food | modern-asian |
| Modern Australian Food | modern-australian |
| Modern European Food | modern-european |
| Modern French Food | modern-french |
| Moroccan Food | moroccan |
| Nepalese Food | nepalese |
| New American Food | new-american |
| New Canadian Food | new-canadian |
| New Mexican Food | new-mexican |
| Nigerian Food | nigerian |
| Noodles | noodles |
| North Indian Food | north-indian |
| Northeastern Thai Food | northeastern-thai |
| Northern Thai Food | northern-thai |
| Organic Food | organic |
| Oysters | oysters |
| Paella | paella |
| Pakistani Food | pakistani |
| Pasta | pasta |
| Pastry | pastry |
| Persian Food | persian |
| Peruvian Food | peruvian |
| Pho | pho |
| Pie | pie |
| Pizza | pizza |
| Poke | poke |
| Polish Food | polish |
| Chicken | chicken |
| Portuguese Food | portuguese |
| Poutine | poutine |
| Pretzel | pretzel |
| Pub | pub |
| Puerto Rican Food | puerto-rican |
| Ramen | ramen |
| Raw Food | raw |
| Ribs | ribs |
| Rolls | rolls |
| Rum | rum |
| Russian Food | russian |
| Salads | salads |
| Salmon | salmon |
| Sandwiches | sandwiches |
| Sashimi | sashimi |
| Scottish Food | scottish |
| Seafood | seafood |
| Shanghai Food | shanghai |
| Shawarma | shawarma |
| Singaporean Food | singaporean |
| Snacks | snacks |
| Soul food | soul-food |
| Soup | soup |
| South African Food | south-african |
| South American Food | south-american |
| South Asian Food | south-asian |
| South East Asian Food | south-east-asian |
| South Indian Food | south-indian |
| Southern Food | southern |
| Southern Thai Food | southern-thai |
| Spanish Food | spanish |
| Sri Lankan Food | sri-lankan |
| Street food | street-food |
| Sushi | sushi |
| Swedish Food | swedish |
| Lollies | lollies |
| Taiwanese Food | taiwanese |
| Tapas | tapas |
| Tex Mex Food | tex-mex |
| Thai Food | thai |
| Traditional American Food | traditional-american |
| Turkish Food | turkish |
| Udon | udon |
| Vegan Food | vegan |
| Vegan Friendly Food | vegan-friendly |
| Vegetarian Food | vegetarian |
| Vegetarian-friendly | vegetarian-friendly |
| Vietnamese Food | vietnamese |
| West African Food | west-african |
| West Indian Food | west-indian |
| Western Food | western |
| Wings | wings |
| Wraps | wraps |
| Japanese BBQ | japanese-bbq |
| Yakitori | yakitori |

## Migration SQL

```sql
-- Create the cuisines table
CREATE TABLE IF NOT EXISTS ubereats_cuisines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ubereats_cuisines_slug ON ubereats_cuisines(slug);
CREATE INDEX IF NOT EXISTS idx_ubereats_cuisines_active ON ubereats_cuisines(is_active) WHERE is_active = true;

-- Insert all cuisines
INSERT INTO ubereats_cuisines (display_name, slug, sort_order) VALUES
  ('24 hours food', '24-hours', 1),
  ('Acai', 'acai', 2),
  ('Afghan Food', 'afghan', 3),
  ('African Food', 'african', 4),
  ('American Food', 'american', 5),
  ('Entrees', 'entrees', 6),
  ('Arabian Food', 'arabian', 7),
  ('Armenian Food', 'armenian', 8),
  ('Asian Food', 'asian', 9),
  ('Asian Fusion Food', 'asian-fusion', 10),
  ('Australian Food', 'australian', 11),
  ('Bacon', 'bacon', 12),
  ('Bakery', 'bakery', 13),
  ('Bangladeshi Food', 'bangladeshi', 14),
  ('Bar Food', 'bar', 15),
  ('BBQ', 'bbq', 16),
  ('Beef dishes', 'beef-dishes', 17),
  ('Belgian Food', 'belgian', 18),
  ('Bento', 'bento', 19),
  ('Biryani', 'biryani', 20),
  ('Bistro', 'bistro', 21),
  ('Brazilian Food', 'brazilian', 22),
  ('Bread dishes', 'bread-dishes', 23),
  ('Breakfast and brunch', 'breakfast-and-brunch', 24),
  ('British Food', 'british', 25),
  ('Bubble tea', 'bubble-tea', 26),
  ('Burgers', 'burgers', 27),
  ('Cafe', 'cafe', 28),
  ('Cajun Food', 'cajun', 29),
  ('Cakes', 'cakes', 30),
  ('Canadian Food', 'canadian', 31),
  ('Candy', 'candy', 32),
  ('Cantonese Food', 'cantonese', 33),
  ('Caribbean Food', 'caribbean', 34),
  ('Charcuterie', 'charcuterie', 35),
  ('Chicken', 'chicken', 36),
  ('Chili', 'chili', 37),
  ('Chinese Food', 'chinese', 38),
  ('Coffee and tea', 'coffee-and-tea', 39),
  ('Colombian Food', 'colombian', 40),
  ('Comfort Food', 'comfort', 41),
  ('Congee', 'congee', 42),
  ('Convenience', 'convenience', 43),
  ('Couscous', 'couscous', 44),
  ('Cuban Food', 'cuban', 45),
  ('Cupcakes', 'cupcakes', 46),
  ('Cured meat', 'cured-meat', 47),
  ('Curry', 'curry', 48),
  ('Custard', 'custard', 49),
  ('Deli', 'deli', 50),
  ('Desserts', 'desserts', 51),
  ('Dim sum', 'dim-sum', 52),
  ('Diner', 'diner', 53),
  ('Dinner', 'dinner', 54),
  ('Dominican Food', 'dominican', 55),
  ('Dosa', 'dosa', 56),
  ('Doughnuts', 'doughnuts', 57),
  ('Drink', 'drink', 58),
  ('Dutch Food', 'dutch', 59),
  ('Eastern European Food', 'eastern-european', 60),
  ('Eggs', 'eggs', 61),
  ('English Food', 'english', 62),
  ('Ethiopian Food', 'ethiopian', 63),
  ('European Food', 'european', 64),
  ('Family meals', 'family-meals', 65),
  ('Fast food', 'fast-food', 66),
  ('Filipino Food', 'filipino', 67),
  ('Fish and chips', 'fish-and-chips', 68),
  ('French Food', 'french', 69),
  ('Frozen food', 'frozen', 70),
  ('Georgian Food', 'georgian', 71),
  ('German Food', 'german', 72),
  ('Gluten-free', 'gluten-free', 73),
  ('Gourmet', 'gourmet', 74),
  ('Greek Food', 'greek', 75),
  ('Grill', 'grill', 76),
  ('Grocery', 'grocery', 77),
  ('Haitian Food', 'haitian', 78),
  ('Halal', 'halal', 79),
  ('Hawaiian Food', 'hawaiian', 80),
  ('Healthy Food', 'healthy', 81),
  ('Hibachi', 'hibachi', 82),
  ('Hotpot', 'hotpot', 83),
  ('Ice cream and frozen yoghurt', 'ice-cream-and-frozen-yoghurt', 84),
  ('Indian Food', 'indian', 85),
  ('Indian curry', 'indian-curry', 86),
  ('Indonesian Food', 'indonesian', 87),
  ('Irish Food', 'irish', 88),
  ('Italian Food', 'italian', 89),
  ('Jamaican Food', 'jamaican', 90),
  ('Japanese BBQ', 'japanese-bbq', 91),
  ('Japanese Food', 'japanese', 92),
  ('Japanese curry', 'japanese-curry', 93),
  ('Jewish Food', 'jewish', 94),
  ('Juice and smoothies', 'juice-and-smoothies', 95),
  ('Kebabs', 'kebabs', 96),
  ('Kid-friendly', 'kid-friendly', 97),
  ('Korean BBQ', 'korean-bbq', 98),
  ('Korean Food', 'korean', 99),
  ('Kosher Food', 'kosher', 100),
  ('Lasagne', 'lasagne', 101),
  ('Late night', 'late-night', 102),
  ('Latin American Food', 'latin-american', 103),
  ('Latin-fusion', 'latin-fusion', 104),
  ('Lebanese Food', 'lebanese', 105),
  ('Lobster', 'lobster', 106),
  ('Lollies', 'lollies', 107),
  ('Low calorie', 'low-calorie', 108),
  ('Low carb', 'low-carb', 109),
  ('Mac and cheese', 'mac-and-cheese', 110),
  ('Malaysian Food', 'malaysian', 111),
  ('Matcha', 'matcha', 112),
  ('Mediterranean Food', 'mediterranean', 113),
  ('Mexican Food', 'mexican', 114),
  ('Middle Eastern Food', 'middle-eastern', 115),
  ('Milkshake', 'milkshake', 116),
  ('Modern Asian Food', 'modern-asian', 117),
  ('Modern Australian Food', 'modern-australian', 118),
  ('Modern European Food', 'modern-european', 119),
  ('Modern French Food', 'modern-french', 120),
  ('Moroccan Food', 'moroccan', 121),
  ('Nepalese Food', 'nepalese', 122),
  ('New American Food', 'new-american', 123),
  ('New Canadian Food', 'new-canadian', 124),
  ('New Mexican Food', 'new-mexican', 125),
  ('Nigerian Food', 'nigerian', 126),
  ('Noodles', 'noodles', 127),
  ('North Indian Food', 'north-indian', 128),
  ('Northeastern Thai Food', 'northeastern-thai', 129),
  ('Northern Thai Food', 'northern-thai', 130),
  ('Organic Food', 'organic', 131),
  ('Oysters', 'oysters', 132),
  ('Paella', 'paella', 133),
  ('Pakistani Food', 'pakistani', 134),
  ('Pasta', 'pasta', 135),
  ('Pastry', 'pastry', 136),
  ('Persian Food', 'persian', 137),
  ('Peruvian Food', 'peruvian', 138),
  ('Pho', 'pho', 139),
  ('Pie', 'pie', 140),
  ('Pizza', 'pizza', 141),
  ('Poke', 'poke', 142),
  ('Polish Food', 'polish', 143),
  ('Portuguese Food', 'portuguese', 144),
  ('Poutine', 'poutine', 145),
  ('Pretzel', 'pretzel', 146),
  ('Pub', 'pub', 147),
  ('Puerto Rican Food', 'puerto-rican', 148),
  ('Ramen', 'ramen', 149),
  ('Raw Food', 'raw', 150),
  ('Ribs', 'ribs', 151),
  ('Rolls', 'rolls', 152),
  ('Rum', 'rum', 153),
  ('Russian Food', 'russian', 154),
  ('Salads', 'salads', 155),
  ('Salmon', 'salmon', 156),
  ('Sandwiches', 'sandwiches', 157),
  ('Sashimi', 'sashimi', 158),
  ('Scottish Food', 'scottish', 159),
  ('Seafood', 'seafood', 160),
  ('Shanghai Food', 'shanghai', 161),
  ('Shawarma', 'shawarma', 162),
  ('Singaporean Food', 'singaporean', 163),
  ('Snacks', 'snacks', 164),
  ('Soul food', 'soul-food', 165),
  ('Soup', 'soup', 166),
  ('South African Food', 'south-african', 167),
  ('South American Food', 'south-american', 168),
  ('South Asian Food', 'south-asian', 169),
  ('South East Asian Food', 'south-east-asian', 170),
  ('South Indian Food', 'south-indian', 171),
  ('Southern Food', 'southern', 172),
  ('Southern Thai Food', 'southern-thai', 173),
  ('Spanish Food', 'spanish', 174),
  ('Sri Lankan Food', 'sri-lankan', 175),
  ('Street food', 'street-food', 176),
  ('Sushi', 'sushi', 177),
  ('Swedish Food', 'swedish', 178),
  ('Taiwanese Food', 'taiwanese', 179),
  ('Tapas', 'tapas', 180),
  ('Tex Mex Food', 'tex-mex', 181),
  ('Thai Food', 'thai', 182),
  ('Traditional American Food', 'traditional-american', 183),
  ('Turkish Food', 'turkish', 184),
  ('Udon', 'udon', 185),
  ('Vegan Food', 'vegan', 186),
  ('Vegan Friendly Food', 'vegan-friendly', 187),
  ('Vegetarian Food', 'vegetarian', 188),
  ('Vegetarian-friendly', 'vegetarian-friendly', 189),
  ('Vietnamese Food', 'vietnamese', 190),
  ('West African Food', 'west-african', 191),
  ('West Indian Food', 'west-indian', 192),
  ('Western Food', 'western', 193),
  ('Wings', 'wings', 194),
  ('Wraps', 'wraps', 195),
  ('Yakitori', 'yakitori', 196)
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order;
```

## Implementation Summary

### Files Modified/Created

| File | Change |
|------|--------|
| `src/services/lead-scrape-service.js` | Added `getCuisines()` function |
| `src/routes/city-codes-routes.js` | Added `GET /api/city-codes/cuisines` endpoint |
| `src/hooks/useLeadScrape.ts` | Added `UberEatsCuisine` interface and `useCuisines()` hook |
| `src/components/leads/CuisineSearchCombobox.tsx` | **NEW** - Searchable dropdown component |
| `src/components/leads/CreateLeadScrapeJob.tsx` | Replaced text input with `CuisineSearchCombobox` |

### API Endpoint

**GET /api/city-codes/cuisines**

Returns all active cuisines sorted alphabetically by display name.

```javascript
// Response format
{
  "success": true,
  "cuisines": [
    { "id": "uuid", "display_name": "Indian Food", "slug": "indian" },
    ...
  ],
  "count": 196
}
```

### React Query Hook

```typescript
// useLeadScrape.ts
export interface UberEatsCuisine {
  id: string;
  display_name: string;
  slug: string;
}

export function useCuisines() {
  return useQuery<{ success: boolean; cuisines: UberEatsCuisine[]; count: number }>({
    queryKey: ['ubereats-cuisines'],
    queryFn: async () => {
      const response = await api.get('/city-codes/cuisines');
      return response.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes cache
  });
}
```

### CuisineSearchCombobox Component

A searchable dropdown component that:
- Groups cuisines alphabetically by first letter
- Shows cuisine display names to users
- Returns the slug value for URL construction
- Uses Popover + Command pattern (same as CitySearchCombobox)

```tsx
// Usage in CreateLeadScrapeJob.tsx
<CuisineSearchCombobox
  value={selectedCuisine?.slug}
  onSelect={handleCuisineSelect}
  placeholder="Search and select cuisine..."
/>
```

### Data Flow

1. User opens "New Lead Scrape" dialog
2. `useCuisines()` hook fetches 196 cuisines from API
3. User searches/selects cuisine (e.g., "Indian Food")
4. Component stores `UberEatsCuisine` object with `display_name` and `slug`
5. On job creation, `slug` is sent to backend (e.g., "indian")
6. Backend builds URL: `https://www.ubereats.com/nz/category/auckland-auk/indian?page=1`

### URL Construction

The slug is used directly in the UberEats category URL:

```
https://www.ubereats.com/{country}/category/{city_code}-{region_code}/{cuisine_slug}?page={offset}
```

Example: Selecting "Middle Eastern Food" (slug: `middle-eastern`) for Auckland:
```
https://www.ubereats.com/nz/category/auckland-auk/middle-eastern?page=1
```

## Completed Steps

- [x] Apply database migration to create `ubereats_cuisines` table (196 entries)
- [x] Add `getCuisines()` function to `lead-scrape-service.js`
- [x] Add API endpoint `GET /api/city-codes/cuisines`
- [x] Add `UberEatsCuisine` interface and `useCuisines()` hook
- [x] Create `CuisineSearchCombobox` component
- [x] Update `CreateLeadScrapeJob` to use cuisine dropdown
- [x] Test URL generation with various cuisine slugs
