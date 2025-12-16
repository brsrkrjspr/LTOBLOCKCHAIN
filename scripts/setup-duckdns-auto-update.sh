#!/bin/bash
# TrustChain LTO - DuckDNS Auto-Update Script
# This script sets up automatic IP updates for DuckDNS
# Run this AFTER you have your DuckDNS token

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== DuckDNS Auto-Update Setup ===${NC}"
echo ""
echo "This will set up automatic IP updates for your DuckDNS domain."
echo "Your domain: ${GREEN}ltoblockchain.duckdns.org${NC}"
echo ""

# Get DuckDNS token
read -p "Enter your DuckDNS token (from https://www.duckdns.org): " DUCKDNS_TOKEN

if [ -z "$DUCKDNS_TOKEN" ]; then
    echo -e "${RED}❌ Error: Token cannot be empty${NC}"
    exit 1
fi

# Test the token
echo ""
echo -e "${BLUE}Testing DuckDNS token...${NC}"
RESPONSE=$(curl -s "https://www.duckdns.org/update?domains=ltoblockchain&token=${DUCKDNS_TOKEN}&ip=")

if [ "$RESPONSE" = "OK" ]; then
    echo -e "${GREEN}✅ Token is valid!${NC}"
else
    echo -e "${RED}❌ Token test failed. Response: ${RESPONSE}${NC}"
    echo "Please check your token at https://www.duckdns.org"
    exit 1
fi

# Create update script
echo ""
echo -e "${BLUE}Creating update script...${NC}"
cat > /usr/local/bin/update-duckdns.sh << EOF
#!/bin/bash
# DuckDNS Auto-Update Script
# Updates ltoblockchain.duckdns.org IP address

TOKEN="${DUCKDNS_TOKEN}"
DOMAIN="ltoblockchain"

# Get current public IP
IP=\$(curl -s https://api.ipify.org)

# Update DuckDNS
RESPONSE=\$(curl -s "https://www.duckdns.org/update?domains=\${DOMAIN}&token=\${TOKEN}&ip=\${IP}")

if [ "\$RESPONSE" = "OK" ]; then
    echo "\$(date): IP updated to \${IP}" >> /var/log/duckdns.log
else
    echo "\$(date): Update failed - \${RESPONSE}" >> /var/log/duckdns.log
fi
EOF

chmod +x /usr/local/bin/update-duckdns.sh
echo -e "${GREEN}✅ Update script created${NC}"

# Test the script
echo ""
echo -e "${BLUE}Testing update script...${NC}"
/usr/local/bin/update-duckdns.sh

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Script works!${NC}"
else
    echo -e "${RED}❌ Script test failed${NC}"
    exit 1
fi

# Add to crontab
echo ""
echo -e "${BLUE}Setting up cron job (runs every 5 minutes)...${NC}"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "update-duckdns.sh"; then
    echo -e "${YELLOW}⚠️  Cron job already exists, skipping...${NC}"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/update-duckdns.sh > /dev/null 2>&1") | crontab -
    echo -e "${GREEN}✅ Cron job added${NC}"
fi

# Show cron jobs
echo ""
echo -e "${BLUE}Current cron jobs:${NC}"
crontab -l | grep -E "update-duckdns|DUCKDNS" || echo "  (none found)"

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "✅ DuckDNS will automatically update every 5 minutes"
echo "✅ Logs are saved to: /var/log/duckdns.log"
echo ""
echo "To view logs:"
echo "  tail -f /var/log/duckdns.log"
echo ""
echo "To manually update:"
echo "  /usr/local/bin/update-duckdns.sh"
echo ""

