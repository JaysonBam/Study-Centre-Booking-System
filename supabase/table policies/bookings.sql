-- 1. Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "Bookings - full access for authenticated" ON bookings;

-- 3. FULL ACCESS for authenticated users
CREATE POLICY "Bookings - full access for authenticated"
ON bookings
FOR ALL
TO authenticated
USING (
	-- allow only if the corresponding user row exists
	EXISTS(
		SELECT 1 FROM public.users u WHERE u.uid = auth.uid()
	)
)
WITH CHECK (
	EXISTS(
		SELECT 1 FROM public.users u WHERE u.uid = auth.uid()
	)
);
