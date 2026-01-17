# Range Items Enhancement Plan

## Problem Statement

Some menus use a single menu item to represent a range of drink options, with the specific drink choices contained in option sets. Currently, these items don't get matched to common images because the item name doesn't contain a specific drink name.

### Examples of Range Items

| Item Name | Description | Option Set | Current Match |
|-----------|-------------|------------|---------------|
| "Coke Range 600ml" | - | Coke, Coke Zero, Vanilla Coke | No match |
| "600ml Coca-Cola Range" | - | Various Coke products | No match |
| "1.5L Coca-Cola Range" | - | Various Coke products | No match |
| "Soft Drinks" | "Coca cola, sprite, Fanta, L&P" | - | No match |
| "Soft Draaanks" | - | Sprite, Coke, Coke No Sugar, L&P | No match |
| "Karma Drinks" | - | Karma Cola, Gingerella, Lemmy | No match |

---

## Phased Implementation

### Phase 1: Quick Fix - Add "Range" Keywords (CURRENT)

Add range-related keywords to the primary drink entry for each major brand. This handles the most common case where the item name contains "Range" and a brand/size indicator.

**Entries to Update:**

| Entry ID | New Keywords to Add |
|----------|---------------------|
| `coke-can` | `coke range`, `coca cola range`, `coca-cola range` |
| `coke-bottle-600ml` | `coke range 600ml`, `coca cola range 600ml`, `coca-cola range 600ml` |
| `coke-bottle-1.5l` | `coke range 1.5l`, `coca cola range 1.5l`, `coca-cola range 1.5l` |
| `pepsi-can` | `pepsi range`, `pepsi cola range` |
| `karma-cola-bottle` | `karma range`, `karma drinks`, `karma cola range` |

**Expected Results:**
- "Coke Range 600ml" → matches `coke-bottle-600ml` via keyword match
- "Coca-Cola Range" → matches `coke-can` (default to can when no size specified)
- "Karma Drinks" → matches `karma-cola-bottle`

---

### Phase 2: Description Parsing (Future)

Extend the matching logic to also check the item description field when the item name doesn't produce a match.

**Implementation:**
1. If `getSuggestedImages(itemName)` returns no matches above threshold
2. Check if item has a description
3. Call `getSuggestedImages(itemDescription)` as fallback
4. Use any match found (potentially with lower confidence)

**Handles:**
- Item name: "Soft Drinks"
- Description: "Coca cola, sprite, Fanta, L&P"
- Result: Match on "Coca cola" in description → Coke can

---

### Phase 3: Option Set Analysis (Future)

For items that still don't match after name + description, analyze the associated option sets.

**Implementation Considerations:**
1. Need to understand how option sets are structured in extraction data
2. May need to look at option set name ("Choice of Flavour")
3. May need to look at option items ("Sprite", "Coke", "Coke No Sugar")
4. Could assign a "generic drinks" placeholder image for items with multiple drink options
5. Or could use the first/most common drink option as the image

**Challenges:**
- Option sets may not be available at the time of image association
- Multiple drink options = which image to show?
- Performance impact of checking nested option set data

---

## Phase 1 Implementation Details

### Files to Modify

1. **Backend:** `UberEats-Image-Extractor/src/services/common-images-service.js`
2. **Frontend:** `UberEats-Image-Extractor/src/lib/common-images-constants.ts`

### Specific Changes

#### coke-can
```javascript
// Add to matchKeywords:
'coke range', 'coca cola range', 'coca-cola range'
```

#### coke-bottle-600ml
```javascript
// Add to matchKeywords:
'coke range 600ml', 'coca cola range 600ml', 'coca-cola range 600ml'
```

#### coke-bottle-1.5l
```javascript
// Add to matchKeywords:
'coke range 1.5l', 'coca cola range 1.5l', 'coca-cola range 1.5l', 'coke range 1.5 litre'
```

#### pepsi-can
```javascript
// Add to matchKeywords:
'pepsi range', 'pepsi cola range'
```

#### karma-cola-bottle
```javascript
// Add to matchKeywords:
'karma range', 'karma drinks', 'karma cola range'
```

---

## Success Criteria

### Phase 1
- [ ] "Coke Range 600ml" matches coke-bottle-600ml
- [ ] "Coca-Cola Range" matches coke-can
- [ ] "1.5L Coca-Cola Range" matches coke-bottle-1.5l
- [ ] "Pepsi Range" matches pepsi-can
- [ ] "Karma Drinks" matches karma-cola-bottle

### Phase 2 (Future)
- [ ] Items with brand names in description get matched
- [ ] Logging shows when description fallback was used

### Phase 3 (Future)
- [ ] Items with drink options in option sets get appropriate images
- [ ] Clear strategy for multi-drink option sets

---

## Notes

- Phase 1 is a quick win that handles the most common "Range" naming pattern
- Phases 2 and 3 require more investigation into extraction data structure
- Consider adding a "generic soft drinks" image for multi-option items in future
