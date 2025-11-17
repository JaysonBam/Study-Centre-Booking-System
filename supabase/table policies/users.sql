-- Enable RLS for the users table and add a minimal, non-recursive policy set.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- Drop any existing policies (idempotent)
DROP POLICY IF EXISTS "Users - allow self select" ON public.users;
DROP POLICY IF EXISTS "Users - allow self update" ON public.users;
DROP POLICY IF EXISTS "Users - admin full" ON public.users;

-- Allow authenticated users to SELECT their own row
-- Create a SECURITY DEFINER helper function so policies can safely check if
-- the current requester is marked as an admin (authorisation = true).
-- This avoids RLS recursion because the function runs with the function owner's
-- privileges when evaluating the policy.
CREATE OR REPLACE FUNCTION public.is_admin(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
	SELECT EXISTS(SELECT 1 FROM public.users u WHERE u.uid = p_uid AND u.authorisation = true);
$$;

-- Policies:
-- - SELECT: allow if it's the user's own row or the requester is an admin
-- - UPDATE: allow if it's the user's own row or the requester is an admin
-- - INSERT: allow if the requester is creating their own row (uid = auth.uid()) or the requester is an admin
-- - DELETE: only admins can delete

CREATE POLICY "Users - select own or admin"
ON public.users
FOR SELECT
TO authenticated
USING (
	auth.uid() = uid OR public.is_admin(auth.uid())
);

CREATE POLICY "Users - update own or admin"
ON public.users
FOR UPDATE
TO authenticated
USING (
	auth.uid() = uid OR public.is_admin(auth.uid())
)
WITH CHECK (
	auth.uid() = uid OR public.is_admin(auth.uid())
);

CREATE POLICY "Users - insert own or admin"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
	auth.uid() = uid OR public.is_admin(auth.uid())
);

CREATE POLICY "Users - admin delete"
ON public.users
FOR DELETE
TO authenticated
USING (
	public.is_admin(auth.uid())
);

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
