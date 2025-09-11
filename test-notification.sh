#!/bin/bash

echo "🧪 Testing HexaWord Notification System"
echo "======================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}This script will test the notification system with a 1-minute delay${NC}"
echo ""

# Step 1: Set test mode environment variable
echo -e "${YELLOW}Step 1: Setting TEST_NOTIFICATIONS mode...${NC}"
export TEST_NOTIFICATIONS=true

# Step 2: Build and start the dev server
echo -e "${YELLOW}Step 2: Building the project...${NC}"
npm run build

echo -e "${YELLOW}Step 3: Starting development server with test mode...${NC}"
echo -e "${GREEN}The notification will be scheduled to send in 1 minute instead of 24 hours${NC}"
echo ""
echo "To test:"
echo "1. Open the game in your browser"
echo "2. Play a level and find a few words"
echo "3. Wait 1 minute"
echo "4. Check the console logs for 'Sent reminder to [username]'"
echo ""
echo -e "${BLUE}Starting server now...${NC}"

# Start with test mode
TEST_NOTIFICATIONS=true npm run dev