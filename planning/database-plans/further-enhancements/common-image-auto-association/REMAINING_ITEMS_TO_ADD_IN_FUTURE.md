# Common Images: Remaining Items

---

## PRIORITY: Items Already in Code with Placeholder URLs

These items have been added to both `common-images-service.js` and `common-images-constants.ts` but still need real UCare CDN image URLs uploaded.

### Pepsi Brand Bottles
| ID | Name | Size | Placeholder |
|----|------|------|-------------|
| `pepsi-bottle-600ml` | Pepsi Bottle 600ml | 600ml | `PLACEHOLDER_URL_pepsi_bottle_600ml` |
| `pepsi-bottle-1.5l` | Pepsi Bottle 1.5L | 1500ml | `PLACEHOLDER_URL_pepsi_bottle_1.5l` |
| `pepsi-max-bottle-600ml` | Pepsi Max Bottle 600ml | 600ml | `PLACEHOLDER_URL_pepsi_max_bottle_600ml` |
| `pepsi-max-bottle-1.5l` | Pepsi Max Bottle 1.5L | 1500ml | `PLACEHOLDER_URL_pepsi_max_bottle_1.5l` |

### Mountain Dew Bottles
| ID | Name | Size | Placeholder |
|----|------|------|-------------|
| `mountain-dew-bottle-600ml` | Mountain Dew Bottle 600ml | 600ml | `PLACEHOLDER_URL_mountain_dew_bottle_600ml` |
| `mountain-dew-bottle-1.5l` | Mountain Dew Bottle 1.5L | 1500ml | `PLACEHOLDER_URL_mountain_dew_bottle_1.5l` |

### 7up Bottles
| ID | Name | Size | Placeholder |
|----|------|------|-------------|
| `7up-bottle-600ml` | 7up Bottle 600ml | 600ml | `PLACEHOLDER_URL_7up_bottle_600ml` |
| `7up-bottle-1.5l` | 7up Bottle 1.5L | 1500ml | `PLACEHOLDER_URL_7up_bottle_1.5l` |

### Karma Cola Cans (all flavours)
| ID | Name | Size | Placeholder |
|----|------|------|-------------|
| `karma-cola-can` | Karma Cola Can | 330ml | `PLACEHOLDER_URL_karma_cola_can` |
| `karma-cola-sugar-free-can` | Karma Cola Sugar Free Can | 330ml | `PLACEHOLDER_URL_karma_cola_sugar_free_can` |
| `gingerella-ginger-beer-can` | Gingerella Ginger Beer Can | 330ml | `PLACEHOLDER_URL_gingerella_ginger_beer_can` |
| `lemmy-lemonade-can` | Lemmy Lemonade Can | 330ml | `PLACEHOLDER_URL_lemmy_lemonade_can` |
| `lemmy-lemonade-sugar-free-can` | Lemmy Lemonade Sugar Free Can | 330ml | `PLACEHOLDER_URL_lemmy_lemonade_sugar_free_can` |
| `razza-raspberry-lemonade-can` | Razza Raspberry Lemonade Can | 330ml | `PLACEHOLDER_URL_razza_raspberry_lemonade_can` |

---

## Items to Add in Future

### 1. Ice Creams:
### 1a. Ben and Jerry's Flavours
- Choc Fudge Brownie (Chocolate Fudge Brownie)
- Choc Chip Cookie Dough (Chocolate Chip Cookie Dough)
- Half Baked
- Phish Food
- The Tonight Dough
- Strawberry Cheesecake
- Triple Caramel Chunk
- Vanilla
- Oh My! Banoffee Pie!
- Dairy Free Cookie Dough (Vegan)
- Dairy Free Chocolate Chip Cookie Dough (Vegan)

### 1b. Magnum Flavours
- Classic
- Almond
- Salted Carmel
- Double Caramel
- White
- Dairy Free Classic
- Dairy Free Almond
- Dairy Free Salted Carmel

## 2. More drinks:
### 2a. Jarritos flavours
- Mandarin
- Watermelon
- Lime
- Grapefruit
- Tamarind
- Pineapple
- Mango
- Cola

### 2b. Fuze Tea Flavours:
- Peach
- Lemon

### 2c. Almighty Organic Juice Flavours:
- Orange, Apple & Mango 
- Carrot, Orange and Tumeric
- Apple, Blackcurrant & Boysenberry
- Guava, Lime & Apple
- Apple

### 2d. Phoenix Juice Flavours
- Apple Orange & Mango
- Apple & Feijoa
- Apple, Mango, Passionfruit & Orange
- Crisp Apple

### 2e. Phoenix Soda Flavours
- Cola
- Diet Cola
- Ginger Beer
- Lemonade
- Lemon Lime and Bitters

### 2f. Charlies Honest Juice Flavours
- Orange
- Apple
- Mandarian, Mango and Pineapple

### 2g. Charlies Honest Fizz Flavours
- Lemon Lime
- Orange Mango
- Feijoa
- Ginger Beer

### 2h. Charlies Quenchers Flavours:
- Lemonade
- Mango Orange
- Raspberry Lemonade
- White Peach and Passionfruit
- Mandarin and Lime

### 2i. T2 Iced Tea Flavours:
- Peach Amore
- Watermelon Fiesta
- Very Berry Blossom

### 2j. Suntory Boss Iced Coffee Flavours:
- Iced Latte
- Iced Long Black
- Iced Double Espresso
- Iced Mocha
- Iced Caramel Latte
- Iced Vanilla Latte

### 2k. More Bundaberg Flavours:
- Lemon Lime and Bitters
- Diet Lemon Lime and Bitters
- Diet Gingerbeer
- Guava
- Peach

### 2l. Mango Lassi

Great, now we need to plan a parallel investigation into how # Things to understand:
1. We need to understand how extracted menus with image auto assignment have their images assigned to menu items in the database
- Are they associated with existing image records? Or, are new ones created?
- If new ones are created, do they contain the existing cdn ids or does uploading the menu to cloudwaitress upload duplicates for each time the image is used?
- Does this differ from manually choosing a common item in the menu edit mode?

# Known gaps to improve:
1. Some menus use a single menu item for a range of drinks and contain the drink item information in an associated option set.
- Some of these will have the type of drink in the menu item name such as: "600ml Coca-Cola Range" or "1.5L Coca-Cola Range"
- Some of them only have it in the description such as menu item name "Soft Drinks" and description "Coca cola, sprite, Fanta, L&P"
- Some of them will only have the actual item choice in the option sets themselves such as menu item name "Soft Draaanks", no description, option set name "Choice of Flavour", option set items "Sprite", "Coke", "Coke No Sugar", "L&P"