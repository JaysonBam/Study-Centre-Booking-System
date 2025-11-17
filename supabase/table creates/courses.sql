CREATE TABLE public.courses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color_hex CHAR(7) CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$')
);