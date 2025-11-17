CREATE TABLE public.rooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  capacity SMALLINT CHECK (capacity > 0),
  is_open BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  dynamic_labels TEXT[] DEFAULT '{}',
  borrowable_items TEXT[] DEFAULT '{}'      
);