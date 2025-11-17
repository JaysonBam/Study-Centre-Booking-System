-- Enable RLS for the users table and add a minimal, non-recursive policy set.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- Drop any existing policies (idempotent)
DROP POLICY IF EXISTS "Users - allow self select" ON public.users;
DROP POLICY IF EXISTS "Users - allow self update" ON public.users;
DROP POLICY IF EXISTS "Users - admin full" ON public.users;

-- Allow authenticated users to SELECT their own row
CREATE POLICY "Users - allow self select"
ON public.users
FOR SELECT
TO authenticated
USING (uid = auth.uid());

-- NOTE: We intentionally do NOT create an "admin" policy that queries this same table
-- (e.g. using EXISTS(SELECT FROM public.users ...)) because that causes infinite
-- recursion: evaluating a policy that itself selects from the same table will re-enter
-- RLS for that table and can recurse indefinitely. Admin management should be done
-- via a privileged / service role or via server-side functions that run with elevated
-- privileges. If you need in-DB admin checks, implement them using a SECURITY DEFINER
-- function owned by a superuser that reads `public.users` (or add an admin claim to the
-- JWT at sign-in time), then call that function from policies.

-- For now we only allow self-SELECT for authenticated users. Admin actions should use
-- the Supabase dashboard or the service_role key.
