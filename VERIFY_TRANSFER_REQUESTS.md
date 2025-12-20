# How to Verify Transfer Requests in Database

## Quick Database Queries

### 1. Check All Transfer Requests
```sql
SELECT 
    tr.id,
    tr.status,
    tr.created_at,
    tr.submitted_at,
    v.plate_number,
    seller.first_name || ' ' || seller.last_name as seller_name,
    buyer.first_name || ' ' || buyer.last_name as buyer_name,
    tr.buyer_info->>'email' as buyer_email
FROM transfer_requests tr
JOIN vehicles v ON tr.vehicle_id = v.id
JOIN users seller ON tr.seller_id = seller.id
LEFT JOIN users buyer ON tr.buyer_id = buyer.id
ORDER BY tr.created_at DESC;
```

### 2. Count Transfer Requests by Status
```sql
SELECT 
    status,
    COUNT(*) as count
FROM transfer_requests
GROUP BY status
ORDER BY count DESC;
```

### 3. Check Recent Transfer Requests (Last 7 Days)
```sql
SELECT 
    tr.id,
    tr.status,
    tr.created_at,
    v.plate_number,
    seller.email as seller_email,
    COALESCE(buyer.email, tr.buyer_info->>'email') as buyer_email
FROM transfer_requests tr
JOIN vehicles v ON tr.vehicle_id = v.id
JOIN users seller ON tr.seller_id = seller.id
LEFT JOIN users buyer ON tr.buyer_id = buyer.id
WHERE tr.created_at >= NOW() - INTERVAL '7 days'
ORDER BY tr.created_at DESC;
```

### 4. Check PENDING Transfer Requests (Waiting for Buyer)
```sql
SELECT 
    tr.id,
    tr.created_at,
    v.plate_number,
    seller.first_name || ' ' || seller.last_name as seller_name,
    tr.buyer_info->>'email' as buyer_email,
    tr.buyer_info->>'firstName' || ' ' || tr.buyer_info->>'lastName' as buyer_name
FROM transfer_requests tr
JOIN vehicles v ON tr.vehicle_id = v.id
JOIN users seller ON tr.seller_id = seller.id
WHERE tr.status = 'PENDING'
ORDER BY tr.created_at DESC;
```

### 5. Check REVIEWING Transfer Requests (Waiting for Admin)
```sql
SELECT 
    tr.id,
    tr.created_at,
    v.plate_number,
    seller.first_name || ' ' || seller.last_name as seller_name,
    COALESCE(buyer.first_name || ' ' || buyer.last_name, 
             tr.buyer_info->>'firstName' || ' ' || tr.buyer_info->>'lastName') as buyer_name
FROM transfer_requests tr
JOIN vehicles v ON tr.vehicle_id = v.id
JOIN users seller ON tr.seller_id = seller.id
LEFT JOIN users buyer ON tr.buyer_id = buyer.id
WHERE tr.status = 'REVIEWING'
ORDER BY tr.created_at DESC;
```

## Using Backend API

### Check Transfer Requests via API
```bash
# Get all transfer requests (admin only sees REVIEWING by default)
curl -X GET "http://localhost:3000/api/vehicles/transfer/requests" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get transfer statistics
curl -X GET "http://localhost:3000/api/vehicles/transfer/requests/stats" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get specific status (e.g., PENDING)
curl -X GET "http://localhost:3000/api/vehicles/transfer/requests?status=PENDING" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Common Issues

### Issue: Transfer Request Not Showing in Admin Dashboard
**Possible Causes:**
1. Status is PENDING (buyer hasn't accepted yet) - Admin only sees REVIEWING status
2. API endpoint not returning data correctly
3. Frontend not calling the correct API endpoint

**Solution:**
- Check the transfer request status in database
- If status is PENDING, the buyer needs to accept it first
- Verify the API endpoint `/api/admin/stats` is returning correct data

### Issue: Dashboard Shows Wrong Count
**Possible Causes:**
1. Dashboard reading from localStorage instead of API
2. API endpoint returning incorrect counts
3. Status mismatch (e.g., counting PENDING instead of REVIEWING)

**Solution:**
- Check browser console for API errors
- Verify `/api/admin/stats` endpoint returns correct vehicle counts
- Verify `/api/vehicles/transfer/requests/stats` returns correct transfer counts

## Testing Checklist

- [ ] Verify transfer request was created in database
- [ ] Check transfer request status (should be PENDING initially)
- [ ] Verify buyer receives notification
- [ ] Buyer accepts transfer request (status changes to REVIEWING)
- [ ] Admin dashboard shows REVIEWING transfer request
- [ ] Admin can see transfer request in admin-transfer-requests.html
- [ ] Statistics update correctly in dashboard

