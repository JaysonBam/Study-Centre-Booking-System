-- 1. Enable RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses FORCE ROW LEVEL SECURITY;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated full select" ON courses;
DROP POLICY IF EXISTS "Allow settings edit only" ON courses;

-- 3. Policy for SELECT (VIEW) Access
CREATE POLICY "Allow authenticated full select"
ON courses
FOR SELECT
TO authenticated
USING (
    -- only if the user row exists
    EXISTS(SELECT 1 FROM public.users u WHERE u.uid = auth.uid())
);

-- 4. Policy for INSERT, UPDATE, DELETE (WRITE) Access
CREATE POLICY "Allow settings edit only"
ON courses
FOR ALL
TO authenticated
USING (
    EXISTS(SELECT 1 FROM public.users u WHERE u.uid = auth.uid() AND u.settings = true)
)
WITH CHECK (
    EXISTS(SELECT 1 FROM public.users u WHERE u.uid = auth.uid() AND u.settings = true)
);