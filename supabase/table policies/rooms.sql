-- 1. Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms FORCE ROW LEVEL SECURITY;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "Rooms - authenticated view" ON rooms;
DROP POLICY IF EXISTS "Rooms - authenticated edit" ON rooms;
DROP POLICY IF EXISTS "Rooms - settings full access" ON rooms;

-- 3. SELECT access for ALL authenticated users
CREATE POLICY "Rooms - authenticated view"
ON rooms
FOR SELECT
TO authenticated
USING (
    EXISTS(SELECT 1 FROM public.users u WHERE u.uid = auth.uid())
);

-- 4. UPDATE access for ALL authenticated users
CREATE POLICY "Rooms - authenticated edit"
ON rooms
FOR UPDATE
TO authenticated
USING (
    EXISTS(SELECT 1 FROM public.users u WHERE u.uid = auth.uid())
)
WITH CHECK (
    EXISTS(SELECT 1 FROM public.users u WHERE u.uid = auth.uid())
);

-- 5. INSERT, UPDATE, DELETE access ONLY for users with settings = true
CREATE POLICY "Rooms - settings full access"
ON rooms
FOR ALL
TO authenticated
USING (
    EXISTS(SELECT 1 FROM public.users u WHERE u.uid = auth.uid() AND u.settings = true)
)
WITH CHECK (
    EXISTS(SELECT 1 FROM public.users u WHERE u.uid = auth.uid() AND u.settings = true)
);
