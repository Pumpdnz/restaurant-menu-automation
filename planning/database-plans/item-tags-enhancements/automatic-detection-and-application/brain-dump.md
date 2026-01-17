1. Detect V, Veg, etc from menu item name, category name, description and add Vegetarian tag
    - Also remove (V) from menu item name when doing this
    - Enhance to detect Vegan specifically
2. Detect GF, Gluten Free, etc from menu item name, category name, description and add Gluten Free tag
    - Also remove (GF) from menu item name when doing this
3. Detect DF, Dairy Free, etc from menu item name, category name, description and add Dairy Free tag
    - Also remove (DF) from menu item name when doing this
4. Detect NF, Nut Free, etc from menu item name, category name, description and add Nut Free tag
    - Also remove (NF) from menu item name when doing this
5. Detect Halal from menu item name or description and add a Halal tag
6. Detect Spicy from menu item name or description and add a Spicy tag
7. Add Deal tag to combo items
8. Create selection criteria for adding popular tags
9. Detect "New" from menu item name or description and add a "New" tag

# Initial Prompt
# Context
Now I need you to plan a parallel investigation into how we can add automatic detection and application of tags to menu items at the time of processing and saving menus from extractions.

We need to investigate the complete flow of how data is captured, processed and saved in both standard and premium extractions in order to find the best place to add the menu item analysis and item tag processing

## The automatic item tag application feature will involve three key phases:
1. Menu Item Analysis
2. Menu Item Name Modification
3. Item Tag Application

### Menu Item Analysis will involve three subphases:
#### 1. Parsing each menu category for the word "vegetarian" and adding the "vegetarian" tag to each menu item in the category.
- This should filter out the term "non vegetarian"

#### 2. Parsing each menu item's name and description for the words; "vegetarian", "vegan", "spicy", "hot", "gluten free", "dairy free", "nut free", "halal", "new", "combo", "deal", "popular", "signature", "recommended", "specialty", and "must try" and adding the appropriate tag based on the regex.
- We should ignore capitalisation and the regex should include cases where the term includes a hyphen such as "Nut-Free" or "dairy-free".

#### 3. The regex should also match for tags built into the menu item names and remove them from the names.
If a menu item name has the full word for each of the above tags, it should be left in the name. However, if the menu item name contains any of the following tags it should be stripped as it will be replaced by the tag:
- "(GF)" -> "Gluten Free"
- "(NF)" -> "Nut Free"
- "(V)" -> "Vegetarian"
- "(Ve)" -> "Vegan"
- "(DF)" -> "Dairy Free"

For example, a menu item with the name "Vegetarian Taco" should be left as it is when saving to the database, but a menu item with the name "Vegetarian Taco (V)" should be saved as "Vegetarian Taco".

### The tags assigned to certain terms should be consolidated for simplicity

- When detecting either "combo" or "deal" in a menu item name or description, the tag added should always be "deal".

- When detecting "spicy" or "hot" in a menu item name or description, the tag added should always be "spicy".

- When detecting "popular", "signature", "recommended", "specialty", or "must try" in a menu item name or description, the tag added should always be "popular".