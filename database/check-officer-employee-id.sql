-- Check which account has LTO-OFF-001 employee_id
SELECT email, role, employee_id, badge_number, first_name, last_name
FROM users 
WHERE employee_id = 'LTO-OFF-001';
