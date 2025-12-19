#!/bin/bash
# TrustChain LTO - Complete Contents Check (PostgreSQL + IPFS)
# Shows everything stored in the system

echo "🔍 COMPLETE SYSTEM CONTENTS CHECK"
echo "=================================="
echo ""

# Run database check
echo "📊 POSTGRESQL DATABASE CONTENTS"
echo "=================================="
bash scripts/check-database-contents.sh

echo ""
echo ""
echo "📦 IPFS STORAGE CONTENTS"
echo "=================================="
bash scripts/check-ipfs-contents.sh

echo ""
echo "✅ Complete system check finished!"
