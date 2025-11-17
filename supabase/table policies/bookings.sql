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
USING (true)
WITH CHECK (true);
