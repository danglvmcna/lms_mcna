-- 031_consolidate_to_three_roles.sql
-- Consolidate roles to exactly 3 core roles: admin, teacher, student

-- 1. Drop existing check constraint on users role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Safely migrate managers, super_admins and any legacy roles to admin
UPDATE users SET role = 'admin' WHERE role IN (
  'manager', 'super_admin', 'ke_toan', 'finance', 'le_tan', 'sale', 'academic_admin', 'academic', 'quan_ly_hoc_vu'
);

UPDATE users SET role = 'teacher' WHERE role = 'advisor';

-- 3. Clean up parent records
DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE role = 'parent');
DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE role = 'parent');
DELETE FROM parent_links;
DELETE FROM users WHERE role = 'parent';

-- 4. Apply strict constraint for only 3 core roles
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
  'admin', 'teacher', 'student'
));
