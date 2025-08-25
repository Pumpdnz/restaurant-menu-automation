#!/bin/bash

# Platform Extraction Testing Script
# Usage: ./test-platform-extraction.sh [platform_name]
# If no platform specified, tests all platforms

API_URL="http://localhost:3007/api/scan-categories"
RESULTS_DIR="./test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory if it doesn't exist
mkdir -p "$RESULTS_DIR"

# Function to get test URL for a platform
get_test_url() {
    local platform=$1
    case "$platform" in
        "ubereats")
            echo "https://www.ubereats.com/nz/store/culture-burger-joint-nelson/g2HsvZ7pTCunCxgRBRyOvA"
            ;;
        "doordash")
            echo "https://www.doordash.com/store/mcdonalds-auckland-2868539/"
            ;;
        "ordermeal")
            echo "https://www.ordermeal.co.nz/culture-burger-joint-nelson/"
            ;;
        "delivereasy")
            echo "https://www.delivereasy.co.nz/culture-burger-joint-nelson-delivery"
            ;;
        "mobi2go")
            echo "https://biggiespizza.mobi2go.com/"
            ;;
        "nextorder")
            echo "https://hambagu.nextorder.nz/"
            ;;
        "foodhub")
            echo "https://www.foodhub.co.nz/restaurant/example"
            ;;
        "generic")
            echo "https://konyakebabs.co.nz/"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Function to get expected categories for a platform
get_expected_categories() {
    local platform=$1
    case "$platform" in
        "ubereats")
            echo "Meals,Sides,Beverages"
            ;;
        "doordash")
            echo "Featured Items,Most Ordered,Menu,Sides,Drinks"
            ;;
        "ordermeal")
            echo "Starters,Mains,Sides,Desserts,Beverages"
            ;;
        "delivereasy")
            echo "Specials,Burgers,Kids,Sides,Sauces,Sweets,Drinks,Munch Break"
            ;;
        "mobi2go")
            echo "Pizza,Sides,Drinks,Desserts"
            ;;
        "nextorder")
            echo "Burgers,Sides,Drinks,Desserts"
            ;;
        "foodhub")
            echo "Starters,Mains,Sides,Beverages"
            ;;
        "generic")
            echo "Menu Categories"
            ;;
        *)
            echo "Unknown"
            ;;
    esac
}

# Function to test a single platform
test_platform() {
    local platform=$1
    local url=$(get_test_url "$platform")
    local expected=$(get_expected_categories "$platform")
    
    if [ -z "$url" ]; then
        echo -e "${RED}❌ No test URL defined for platform: $platform${NC}"
        return 1
    fi
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Testing Platform: ${YELLOW}$platform${NC}"
    echo -e "${BLUE}URL: $url${NC}"
    echo -e "${BLUE}Expected: $expected${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Make API request
    echo "Making API request..."
    RESPONSE=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"url\": \"$url\"}" 2>/dev/null)
    
    # Save raw response
    echo "$RESPONSE" > "$RESULTS_DIR/${platform}_${TIMESTAMP}.json"
    
    # Check if request was successful
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    
    if [ "$SUCCESS" = "true" ]; then
        # Extract categories
        CATEGORIES=$(echo "$RESPONSE" | jq -r '.data.categories[].name' | tr '\n' ',')
        CATEGORIES=${CATEGORIES%,} # Remove trailing comma
        
        # Count categories
        COUNT=$(echo "$RESPONSE" | jq '.data.categories | length')
        
        # Display results
        echo -e "${GREEN}✅ Success!${NC}"
        echo -e "Found $COUNT categories: $CATEGORIES"
        
        # Check if it's just the fallback
        if [ "$CATEGORIES" = "All Items" ]; then
            echo -e "${YELLOW}⚠️  Warning: Only found fallback category${NC}"
            echo "$platform: NEEDS REFINEMENT - Fallback only" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
        else
            echo -e "${GREEN}✓ Categories detected successfully${NC}"
            echo "$platform: SUCCESS - $COUNT categories found" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
        fi
        
        # Display category details
        echo -e "\nCategory Details:"
        echo "$RESPONSE" | jq '.data.categories'
        
    else
        echo -e "${RED}❌ Failed!${NC}"
        ERROR=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
        echo "Error: $ERROR"
        echo "$platform: FAILED - $ERROR" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    fi
    
    echo ""
}

# Function to test all platforms
test_all_platforms() {
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}     Platform Extraction Test Suite - $(date)${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}\n"
    
    # Initialize summary
    echo "Platform Extraction Test Results - $(date)" > "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    echo "=================================" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    echo "" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    
    # List of all platforms to test
    PLATFORMS="ubereats doordash ordermeal delivereasy mobi2go nextorder foodhub generic"
    
    # Test each platform
    for platform in $PLATFORMS; do
        test_platform "$platform"
        sleep 2 # Brief pause between tests
    done
    
    # Display summary
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}                        TEST SUMMARY${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    cat "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "Full results saved to: ${YELLOW}$RESULTS_DIR/${NC}"
}

# Function to continuously test a single platform for refinement
refine_platform() {
    local platform=$1
    
    if [ -z "$platform" ]; then
        echo -e "${RED}Please specify a platform to refine${NC}"
        echo "Usage: $0 refine [platform_name]"
        exit 1
    fi
    
    echo -e "${GREEN}Starting refinement mode for: $platform${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
    echo -e "${YELLOW}Test will run every time you press Enter${NC}\n"
    
    while true; do
        read -p "Press Enter to test (or Ctrl+C to exit)..."
        test_platform "$platform"
    done
}

# Main logic
case "$1" in
    "")
        # No argument - test all platforms
        test_all_platforms
        ;;
    "refine")
        # Refinement mode for continuous testing
        refine_platform "$2"
        ;;
    *)
        # Test specific platform
        test_platform "$1"
        ;;
esac