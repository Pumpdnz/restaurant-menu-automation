#!/bin/bash

# Comprehensive workflow testing script
# Tests both UI (/api/extractions/start) and Agent (/api/scan-categories) workflows

API_URL="http://localhost:3007"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="workflow-test-results-${TIMESTAMP}.txt"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test URLs for each platform (using VALID, WORKING URLs)
declare -a PLATFORMS=(
  "UberEats|https://www.ubereats.com/nz/store/smokey-ts-cashel-street/rWCJOIotUEGcllMiycozVw"
  "DoorDash|https://www.doordash.com/en-NZ/store/smokey-t%E2%80%99s-christchurch-28016025/34443558/"
  "OrderMeal|https://www.ordermeal.co.nz/restaurant/kasuri-indian-eatery-bar/"
  "DeliverEasy|https://www.delivereasy.co.nz/culture-burger-joint-nelson-delivery"
  "Mobi2Go|https://biggiespizza.mobi2go.com/"
  "NextOrder|https://hambagu.nextorder.nz/"
  "Generic|https://konyakebabs.co.nz/"
)

echo "=====================================" | tee $RESULTS_FILE
echo "Workflow Testing Report - $(date)" | tee -a $RESULTS_FILE
echo "=====================================" | tee -a $RESULTS_FILE
echo "" | tee -a $RESULTS_FILE

# Function to test Agent workflow (scan-categories)
test_agent_workflow() {
  local platform=$1
  local url=$2
  
  echo -e "${BLUE}Testing Agent Workflow for $platform...${NC}"
  
  RESPONSE=$(curl -s -X POST "$API_URL/api/scan-categories" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$url\"}" 2>/dev/null)
  
  SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
  
  if [ "$SUCCESS" = "true" ]; then
    CATEGORIES=$(echo "$RESPONSE" | jq '.data.categories | length')
    CATEGORY_NAMES=$(echo "$RESPONSE" | jq -r '.data.categories[].name' | tr '\n' ', ')
    CATEGORY_NAMES=${CATEGORY_NAMES%,}
    
    if [ "$CATEGORIES" -eq 1 ] && [[ "$CATEGORY_NAMES" == "All Items" ]]; then
      echo -e "${YELLOW}⚠️  Agent Workflow: FALLBACK - Only 'All Items' detected${NC}"
      echo "$platform - Agent: FALLBACK (All Items only)" >> $RESULTS_FILE
      return 1
    else
      echo -e "${GREEN}✅ Agent Workflow: SUCCESS - $CATEGORIES categories found${NC}"
      echo "   Categories: $CATEGORY_NAMES"
      echo "$platform - Agent: SUCCESS ($CATEGORIES categories)" >> $RESULTS_FILE
      return 0
    fi
  else
    ERROR=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
    echo -e "${RED}❌ Agent Workflow: FAILED - $ERROR${NC}"
    echo "$platform - Agent: FAILED ($ERROR)" >> $RESULTS_FILE
    return 2
  fi
}

# Function to test UI workflow (extractions/start)
test_ui_workflow() {
  local platform=$1
  local url=$2
  
  echo -e "${BLUE}Testing UI Workflow for $platform...${NC}"
  
  # Start extraction
  START_RESPONSE=$(curl -s -X POST "$API_URL/api/extractions/start" \
    -H "Content-Type: application/json" \
    -d "{
      \"url\": \"$url\",
      \"extractionType\": \"batch\",
      \"options\": {}
    }" 2>/dev/null)
  
  SUCCESS=$(echo "$START_RESPONSE" | jq -r '.success')
  
  if [ "$SUCCESS" = "true" ]; then
    JOB_ID=$(echo "$START_RESPONSE" | jq -r '.jobId')
    echo "   Job started: $JOB_ID"
    
    # Wait for extraction to process (give it more time)
    sleep 20
    
    # Check status
    STATUS_RESPONSE=$(curl -s -X GET "$API_URL/api/extractions/$JOB_ID" 2>/dev/null)
    STATUS_SUCCESS=$(echo "$STATUS_RESPONSE" | jq -r '.success')
    
    if [ "$STATUS_SUCCESS" = "true" ]; then
      TOTAL_CATEGORIES=$(echo "$STATUS_RESPONSE" | jq -r '.job.totalCategories')
      TOTAL_ITEMS=$(echo "$STATUS_RESPONSE" | jq -r '.job.totalItems')
      STATE=$(echo "$STATUS_RESPONSE" | jq -r '.job.state')
      
      if [ "$TOTAL_CATEGORIES" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  UI Workflow: NO CATEGORIES - Extraction found 0 categories${NC}"
        echo "$platform - UI: NO CATEGORIES (0 found)" >> $RESULTS_FILE
        return 1
      else
        echo -e "${GREEN}✅ UI Workflow: SUCCESS - $TOTAL_CATEGORIES categories, $TOTAL_ITEMS items${NC}"
        echo "$platform - UI: SUCCESS ($TOTAL_CATEGORIES categories, $TOTAL_ITEMS items)" >> $RESULTS_FILE
        return 0
      fi
    else
      echo -e "${RED}❌ UI Workflow: Status check failed${NC}"
      echo "$platform - UI: STATUS CHECK FAILED" >> $RESULTS_FILE
      return 2
    fi
  else
    ERROR=$(echo "$START_RESPONSE" | jq -r '.error // "Unknown error"')
    echo -e "${RED}❌ UI Workflow: FAILED - $ERROR${NC}"
    echo "$platform - UI: FAILED ($ERROR)" >> $RESULTS_FILE
    return 2
  fi
}

# Main testing loop
echo -e "${GREEN}Starting comprehensive workflow tests...${NC}\n"

AGENT_SUCCESS=0
AGENT_FALLBACK=0
AGENT_FAILED=0
UI_SUCCESS=0
UI_NO_CATEGORIES=0
UI_FAILED=0

for platform_data in "${PLATFORMS[@]}"; do
  IFS='|' read -r platform url <<< "$platform_data"
  
  echo -e "${GREEN}═══════════════════════════════════════${NC}"
  echo -e "${GREEN}Testing Platform: ${YELLOW}$platform${NC}"
  echo -e "${GREEN}═══════════════════════════════════════${NC}"
  echo "URL: $url"
  echo ""
  
  # Test Agent workflow
  if test_agent_workflow "$platform" "$url"; then
    ((AGENT_SUCCESS++))
  else
    if [ $? -eq 1 ]; then
      ((AGENT_FALLBACK++))
    else
      ((AGENT_FAILED++))
    fi
  fi
  
  echo ""
  
  # Test UI workflow
  if test_ui_workflow "$platform" "$url"; then
    ((UI_SUCCESS++))
  else
    if [ $? -eq 1 ]; then
      ((UI_NO_CATEGORIES++))
    else
      ((UI_FAILED++))
    fi
  fi
  
  echo ""
  echo "Waiting 15 seconds before next platform test (rate limit protection)..."
  sleep 15
done

# Summary
echo -e "${GREEN}═══════════════════════════════════════${NC}" | tee -a $RESULTS_FILE
echo -e "${GREEN}           TEST SUMMARY${NC}" | tee -a $RESULTS_FILE
echo -e "${GREEN}═══════════════════════════════════════${NC}" | tee -a $RESULTS_FILE
echo "" | tee -a $RESULTS_FILE
echo "AGENT WORKFLOW (/api/scan-categories):" | tee -a $RESULTS_FILE
echo "  ✅ Success: $AGENT_SUCCESS" | tee -a $RESULTS_FILE
echo "  ⚠️  Fallback: $AGENT_FALLBACK" | tee -a $RESULTS_FILE
echo "  ❌ Failed: $AGENT_FAILED" | tee -a $RESULTS_FILE
echo "" | tee -a $RESULTS_FILE
echo "UI WORKFLOW (/api/extractions/start):" | tee -a $RESULTS_FILE
echo "  ✅ Success: $UI_SUCCESS" | tee -a $RESULTS_FILE
echo "  ⚠️  No Categories: $UI_NO_CATEGORIES" | tee -a $RESULTS_FILE
echo "  ❌ Failed: $UI_FAILED" | tee -a $RESULTS_FILE
echo "" | tee -a $RESULTS_FILE
echo -e "${GREEN}═══════════════════════════════════════${NC}" | tee -a $RESULTS_FILE
echo "Full results saved to: $RESULTS_FILE"