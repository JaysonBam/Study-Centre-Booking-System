CREATE EXTENSION IF NOT EXISTS btree_gist;

DROP TABLE IF EXISTS public.bookings;

CREATE TABLE public.bookings (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL
    REFERENCES public.rooms(id) ON DELETE CASCADE,
  course_id INT
    REFERENCES public.courses(id) ON DELETE SET NULL,
  course_name TEXT,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  booking_day DATE NOT NULL,
  student_numbers TEXT,
  borrowed_items TEXT[] DEFAULT '{}',
  booked_by TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('Active', 'Reserved', 'Ended')) DEFAULT 'Reserved',

  CONSTRAINT bookings_time_order CHECK (
    end_time > start_time
  ),

  -- no overlapping bookings allow
  EXCLUDE USING gist (
    room_id WITH =,
    booking_day WITH =,
    tsrange(
      (booking_day + start_time)::timestamp,
      (booking_day + end_time)::timestamp
    ) WITH &&
  )
);