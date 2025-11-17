-- Create a dedicated users table that maps to auth.users and stores app flags
CREATE TABLE public.users (
  id SERIAL PRIMARY KEY,
  uid uuid NOT NULL UNIQUE, -- references auth.users(id)
  email text NOT NULL,
  name text,
  settings boolean DEFAULT false,
  authorisation boolean DEFAULT false,
  analytics boolean DEFAULT false,
  enabled boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Optional index on uid for quick lookups
CREATE INDEX IF NOT EXISTS idx_users_uid ON public.users(uid);
