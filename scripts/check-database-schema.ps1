# TrustChain LTO - Database Schema Verification Script (PowerShell)
# Checks if all required schema elements are in place for the transfer refactoring

Write-Host "🔍 Checking Database Schema..." -ForegroundColor Cyan
Write-Host ""

# Database connection details (adjust if needed)
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "lto_blockchain" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "lto_user" }
$DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "lto_password" }

# Connection string
$connString = "Host=$DB_HOST;Port=$DB_PORT;Database=$DB_NAME;Username=$DB_USER;Password=$DB_PASSWORD"

# Function to run SQL query
function Run-Query {
    param([string]$query)
    try {
        $result = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -A -c $query 2>$null
        return $result
    } catch {
        Write-Host "Error running query: $_" -ForegroundColor Red
        return $null
    }
}

# Function to check if exists
function Check-Exists {
    param([string]$query, [string]$description)
    $result = Run-Query $query
    if ($result -and $result.Trim() -ne "") {
        Write-Host "✅ $description" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ $description" -ForegroundColor Red
        return $false
    }
}

Write-Host "📋 Checking Required Tables..." -ForegroundColor Yellow
Write-Host ""

# Check tables
Check-Exists "SELECT 1 FROM information_schema.tables WHERE table_name = 'documents';" "documents table exists"
Check-Exists "SELECT 1 FROM information_schema.tables WHERE table_name = 'transfer_requests';" "transfer_requests table exists"
Check-Exists "SELECT 1 FROM information_schema.tables WHERE table_name = 'transfer_documents';" "transfer_documents table exists"

Write-Host ""
Write-Host "📋 Checking document_type ENUM Values..." -ForegroundColor Yellow
Write-Host ""

# Get ENUM values
$enumQuery = "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type') ORDER BY enumsortorder;"
$enumValues = Run-Query $enumQuery

$requiredEnums = @("registration_cert", "insurance_cert", "emission_cert", "owner_id", "deed_of_sale", "seller_id", "buyer_id", "other")

foreach ($enum in $requiredEnums) {
    if ($enumValues -match $enum) {
        Write-Host "✅ ENUM value '$enum' exists" -ForegroundColor Green
    } else {
        Write-Host "❌ ENUM value '$enum' MISSING" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📋 Current ENUM Values:" -ForegroundColor Yellow
$enumValues -split "`n" | Where-Object { $_.Trim() -ne "" } | ForEach-Object {
    Write-Host "  - $_"
}

Write-Host ""
Write-Host "📋 Checking documents Table Structure..." -ForegroundColor Yellow
Write-Host ""

Check-Exists "SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'document_type';" "documents.document_type column exists"
Check-Exists "SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'ipfs_cid';" "documents.ipfs_cid column exists"

# Check ENUM type
$enumTypeQuery = "SELECT udt_name FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'document_type';"
$enumType = Run-Query $enumTypeQuery
if ($enumType -match "document_type") {
    Write-Host "✅ documents.document_type is ENUM type" -ForegroundColor Green
} else {
    Write-Host "❌ documents.document_type is NOT ENUM type (found: $enumType)" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 Checking transfer_documents Table Structure..." -ForegroundColor Yellow
Write-Host ""

Check-Exists "SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_documents' AND column_name = 'document_type';" "transfer_documents.document_type column exists"

# Check constraint
$constraintQuery = "SELECT check_clause FROM information_schema.check_constraints WHERE constraint_name LIKE '%transfer_document%' LIMIT 1;"
$constraint = Run-Query $constraintQuery
if ($constraint) {
    Write-Host "✅ transfer_documents has CHECK constraint" -ForegroundColor Green
    Write-Host "   Constraint: $constraint"
} else {
    Write-Host "❌ transfer_documents CHECK constraint NOT FOUND" -ForegroundColor Red
}

Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Yellow
Write-Host ""

# Count documents by type
Write-Host "Documents by type:"
$docCountQuery = "SELECT document_type, COUNT(*) as count FROM documents GROUP BY document_type ORDER BY document_type;"
$docCounts = Run-Query $docCountQuery
$docCounts -split "`n" | Where-Object { $_.Trim() -ne "" } | ForEach-Object {
    Write-Host "  $_"
}

# Count transfer requests
$transferCount = Run-Query "SELECT COUNT(*) FROM transfer_requests;"
Write-Host "Total transfer requests: $transferCount"

# Count transfer documents
$transferDocsCount = Run-Query "SELECT COUNT(*) FROM transfer_documents;"
Write-Host "Total transfer documents: $transferDocsCount"

Write-Host ""
Write-Host "✅ Schema check complete!" -ForegroundColor Green
