import React, { useMemo, useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { addMinutes } from "date-fns";
import BookingCell from "./BookingCell";

interface Room {
  id: string;
  name: string;
  capacity?: number | null;
  is_available?: boolean | null;
}

interface Booking {
  id: string;
  room_id: string;
  start_time: string; // ISO
  end_time: string;   // ISO
  title?: string;
  color?: string;
  booked_by?: string;
  course_id?: number | null;
  course_name?: string | null;
  course?: { id: number; name: string; color_hex?: string } | null;
  state?: 'Active' | 'Reserved' | 'Ended' | undefined;
}

interface BookingGridProps {
  selectedDate: Date;
  rooms?: Room[];
  bookings?: Booking[];
  openingHours?: { start: string; end: string };
  onCellClick: (roomId: string, timeSlotIso: string) => void;
  onBookingClick: (bookingId: string) => void;
  onQuickAction?: (bookingId: string, action: 'activate' | 'end') => void;
}

const defaultRooms: Room[] = [
  { id: "r1", name: "Room 1" },
  { id: "r2", name: "Room 2" },
  { id: "r3", name: "Room 3" },
];

export const BookingGrid: React.FC<BookingGridProps> = ({
  selectedDate,
  rooms: roomsProp,
  bookings: bookingsProp,
  openingHours: openingHoursProp,
  onCellClick,
  onBookingClick,
  onQuickAction,
}) => {
  const [rooms, setRooms] = useState<Room[]>(roomsProp ?? defaultRooms);
  const [openingHours, setOpeningHours] = useState<{ start: string; end: string }>(openingHoursProp ?? { start: "06:00", end: "21:00" });
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const channelRefRef = useRef<any>(null);
  const bookingsRef = useRef<Booking[]>([]);

  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

  useEffect(() => {
    // Load rooms and opening hours from the DB. If props are provided, prefer them
    const load = async () => {
      setLoading(true);
      try {
        // Rooms: only include rooms that are available for booking (is_available).
        const { data: roomsData, error: roomsErr } = await supabase.from("rooms").select("*");
        if (roomsErr) {
          console.error("Error loading rooms:", roomsErr);
        } else if (roomsData) {
          const fetched = (roomsData as any[])
            .filter((r) => {
              // Use `is_available` to determine whether to show the room. If undefined/null, treat as available.
              return r.is_available === false ? false : true;
            })
            .map((r) => ({ id: String(r.id), name: r.name, capacity: r.capacity, is_available: r.is_available }));
          // Sort rooms by name (numeric Room N first if applicable)
          const roomRegex = /^Room\s*(\d+)$/i;
          const numericRooms = fetched
            .map((r) => ({ r, m: (r.name.match(roomRegex) || [])[1] }))
            .filter((x) => x.m)
            .map((x) => ({ room: x.r, num: parseInt(x.m, 10) }))
            .sort((a, b) => a.num - b.num)
            .map((x) => x.room);
          const otherRooms = fetched.filter((r) => !roomRegex.test(r.name)).slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
          setRooms([...numericRooms, ...otherRooms]);
        }

        // Bookings for the selected date will be loaded by fetchBookings

        // Opening hours
        const { data: hoursData, error: hoursErr } = await supabase.from("settings").select("value").eq("key", "operation_hours").single();
        if (hoursErr && (hoursErr as any).code !== "PGRST116") {
          console.error("Error loading operation_hours:", hoursErr);
        }
        if (hoursData && hoursData.value) {
          const val = hoursData.value as any;
          const start = val.start ?? val.open ?? "06:00";
          const end = val.end ?? val.close ?? "21:00";
          setOpeningHours({ start, end });
        }
      } catch (err) {
        console.error("BookingGrid load error", err);
      } finally {
        setLoading(false);
      }
    };

    // Helper to fetch bookings for a particular date string (YYYY-MM-DD)
    const fetchBookings = async (dateStr: string) => {
      try {
        const { data: bookingsData, error: bookingsErr } = await supabase
          .from("bookings")
          .select(`*, courses(id, name, color_hex)`)
          .eq("booking_day", dateStr);
        if (bookingsErr) {
          console.error("Error loading bookings:", bookingsErr);
          return;
        }
        if (bookingsData) {
          const mapped = (bookingsData as any[]).map((b) => {
            const startIso = `${b.booking_day}T${(b.start_time || "").slice(0,8)}`;
            const endIso = `${b.booking_day}T${(b.end_time || "").slice(0,8)}`;
            return {
              id: String(b.id),
              room_id: String(b.room_id),
              start_time: startIso,
              end_time: endIso,
              booked_by: b.booked_by,
              course_id: b.course_id ?? null,
              course_name: b.course_name ?? null,
              course: b.courses ?? null,
              state: b.state,
            } as Booking;
          });
          setBookings(mapped);
        }
      } catch (e) {
        console.error("Error fetching bookings", e);
      }
    };

    // If parent passed rooms or openingHours or bookings props explicitly, prefer them
    if (roomsProp && roomsProp.length > 0) {
      setRooms(roomsProp as any);
    }
    if (openingHoursProp) setOpeningHours(openingHoursProp);
    if (bookingsProp && bookingsProp.length > 0) {
      // Map incoming bookingsProp to our internal shape if needed
      setBookings(bookingsProp as any);
      setLoading(false);
    } else {
      // Always load data (rooms/opening hours) and bookings from DB when not provided.
      const init = async () => {
        await load();
        // Fetch bookings for the current selected date
        const dateStr = selectedDate.toISOString().slice(0,10);
        await fetchBookings(dateStr);

        // If there's an existing channel for a previous date, remove it first
        try {
          if (channelRefRef.current) {
            // @ts-ignore
            supabase.removeChannel(channelRefRef.current);
            channelRefRef.current = null;
          }
        } catch (e) {
          try { channelRefRef.current?.unsubscribe(); } catch (_) { /* ignore */ }
        }

        // Setup realtime subscription for bookings (listen to all changes and filter client-side)
        // We remove the server-side filter because DELETE events often don't include the booking_day column,
        // so we can't filter by it on the server.
        const channel = supabase.channel(`public:bookings:global`);
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload: any) => {
          // Check if the change affects the current view:
          // 1. New/Updated booking is on this day
          // 2. Old booking (Deleted/Updated) was on this day (check against current bookings list)
          const isRelevant = 
            (payload.new && payload.new.booking_day === dateStr) || 
            (payload.old && bookingsRef.current.some(b => b.id == payload.old.id));

          if (isRelevant) {
            console.debug('[BookingGrid] realtime update relevant, refetching', payload);
            fetchBookings(dateStr);
          }
        });

        // Subscribe and wait for subscription to be established
        try {
          const res = await channel.subscribe();
          console.debug('[BookingGrid] subscribed to bookings channel', dateStr, res);
          channelRefRef.current = channel;
        } catch (err) {
          console.warn('Failed to subscribe to bookings realtime channel', err);
        }
      };

      init();

      // Cleanup subscription when selectedDate or props change
      return () => {
        try {
          if (channelRefRef.current) {
            // @ts-ignore
            supabase.removeChannel(channelRefRef.current);
            channelRefRef.current = null;
          }
        } catch (e) {
          try { channelRefRef.current?.unsubscribe(); } catch (er) { /* ignore */ }
        }
      };
    }
  }, [roomsProp, openingHoursProp, bookingsProp, selectedDate]);
  // Generate half-hour slots between opening and closing
  const timeSlots = useMemo(() => {
    const [sh, sm] = openingHours.start.split(":").map(Number);
    const [eh, em] = openingHours.end.split(":").map(Number);
    const start = new Date(selectedDate);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(eh, em, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);

    const slots: Date[] = [];
    let cur = new Date(start);
    while (cur < end) {
      slots.push(new Date(cur));
      cur = addMinutes(cur, 30);
    }
    return slots;
  }, [selectedDate, openingHours]);

  const getBookingForCell = React.useCallback((roomId: string, slot: Date) => {
    // Use internal `bookings` state (not incoming prop) to find any booking that covers this slot
    return bookings.find((b) => {
      const s = new Date(b.start_time);
      const e = new Date(b.end_time);
      return b.room_id === roomId && slot >= s && slot < e;
    }) || null;
  }, [bookings]);

  if (loading) {
    return (
      <div className="overflow-auto h-[calc(100vh-80px)] border border-grid-border rounded-lg text-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="overflow-auto h-[calc(100vh-80px)] border border-grid-border rounded-lg text-black">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-grid-header">
          <tr>
            <th className="border-b border-grid-border p-1 text-left font-semibold min-w-[48px] md:min-w-[64px] sticky left-0 bg-grid-header text-sm">Time</th>
            {rooms.map((r) => (
              <th key={r.id} className="border-b border-grid-border text-left font-semibold p-1 min-w-[56px] md:min-w-[80px] sticky top-0 bg-grid-header text-sm">{r.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot) => (
            <tr key={slot.toISOString()} className="hover:bg-grid-cell-hover">
              <td className="border-0 border-r border-grid-border p-1 text-sm font-medium sticky left-0 bg-grid-header">{format(slot, "HH:mm")}</td>
              {rooms.map((room) => {
                const booking = getBookingForCell(room.id, slot);
                return (
                  <BookingCell
                    key={`${room.id}-${slot.toISOString()}`}
                    booking={booking}
                    roomId={room.id}
                    timeSlot={slot}
                    onCellClick={onCellClick}
                    onBookingClick={onBookingClick}
                    onQuickAction={onQuickAction}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BookingGrid;
