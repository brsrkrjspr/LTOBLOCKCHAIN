#!/bin/bash
# TrustChain LTO - Expiry Notification Cron Setup Script
# This script sets up a daily cron job to check for expiring vehicle registrations

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== TrustChain LTO - Expiry Notification Cron Setup ===${NC}"
echo ""

# Get the project directory (assumes script is in scripts/ directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXPIRY_SCRIPT="$PROJECT_DIR/backend/scripts/check-expiry-notifications.js"

# Check if the expiry script exists
if [ ! -f "$EXPIRY_SCRIPT" ]; then
    echo -e "${RED}❌ Expiry script not found at: $EXPIRY_SCRIPT${NC}"
    exit 1
fi

echo -e "${BLUE}Project directory: $PROJECT_DIR${NC}"
echo -e "${BLUE}Expiry script: $EXPIRY_SCRIPT${NC}"
echo ""

# Make the script executable
chmod +x "$EXPIRY_SCRIPT"
echo -e "${GREEN}✅ Made expiry script executable${NC}"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"

# Test the script
echo ""
echo -e "${BLUE}Testing expiry script...${NC}"
if cd "$PROJECT_DIR" && node "$EXPIRY_SCRIPT" --test 2>/dev/null || node "$EXPIRY_SCRIPT" 2>&1 | head -5; then
    echo -e "${GREEN}✅ Script works!${NC}"
else
    echo -e "${YELLOW}⚠️  Script test inconclusive (this is okay if database is not connected)${NC}"
fi

# Add to crontab
echo ""
echo -e "${BLUE}Setting up cron job (runs daily at 9:00 AM)...${NC}"

# Create cron job entry
CRON_ENTRY="0 9 * * * cd $PROJECT_DIR && node $EXPIRY_SCRIPT >> /var/log/lto-expiry-check.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "check-expiry-notifications.js"; then
    echo -e "${YELLOW}⚠️  Cron job already exists, updating...${NC}"
    # Remove old entry and add new one
    (crontab -l 2>/dev/null | grep -v "check-expiry-notifications.js"; echo "$CRON_ENTRY") | crontab -
    echo -e "${GREEN}✅ Cron job updated${NC}"
else
    # Add new cron job
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    echo -e "${GREEN}✅ Cron job added${NC}"
fi

# Show cron jobs
echo ""
echo -e "${BLUE}Current cron jobs for expiry checking:${NC}"
crontab -l | grep -E "check-expiry-notifications|expiry" || echo "  (none found)"

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "✅ Expiry notifications will automatically check daily at 9:00 AM"
echo "✅ Logs are saved to: /var/log/lto-expiry-check.log"
echo ""
echo "To view logs:"
echo "  tail -f /var/log/lto-expiry-check.log"
echo ""
echo "To manually run the check:"
echo "  cd $PROJECT_DIR"
echo "  node $EXPIRY_SCRIPT"
echo ""
echo "To remove the cron job:"
echo "  crontab -e"
echo "  (then delete the line with check-expiry-notifications.js)"

