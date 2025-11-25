import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompactToolbar } from "@/context/CompactToolbarContext";
import { supabase } from "@/lib/supabaseClient";
import { format, parseISO, addMinutes, startOfDay, isSameDay } from "date-fns";
import { useNow } from "@/context/NowContext";
import { BookingCell } from "./BookingCell";
import { cn, roundToNearest30 } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface Room {
  id: string;
  name: string;
  capacity: number;
  enabled: boolean;
}

interface Booking {
  id: string;
  room_id: string;
  start_time: string;
  end_time: string;
  staff_name: string;
  student_numbers: string | null;
  status: string;
  discipline_id: string;
  disciplines: {
    name: string;
    color_hex: string;
  };
}

interface BookingGridProps {
  selectedDate: Date;
  onCellClick: (roomId: string, timeSlot: string) => void;
  onBookingClick: (booking: Booking) => void;
}

export const BookingGrid = ({ selectedDate, onCellClick, onBookingClick }: BookingGridProps) => {
  const { compact } = useCompactToolbar();
  const { getNow } = useNow();
  const reconcileCooldownRef = useRef<number>(0);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingHours, setOpeningHours] = useState({ start: "06:00", end: "21:00" });

  const fetchOpening = async (): Promise<{ start: string; end: string }> => {
    try {
      const { data, error } = await supabase.from("settings").select("*").eq("key", "opening_hours").limit(1).single();
      if (error) {
        if ((error as any).code !== "PGRST116") throw error;
      }
      const val = (data?.value ?? null) as any;
      if (val) return { start: val.start ?? val.open ?? "06:00", end: val.end ?? val.close ?? "21:00" };
    } catch (err) {
      console.error("Error fetching opening_hours from DB, falling back to localStorage/default:", err);
    }

    try {
      if (typeof window !== "undefined") {
        const ls = localStorage.getItem("opening_hours");
        if (ls) {
          const parsed = JSON.parse(ls);
          return { start: parsed.start ?? parsed.open ?? "06:00", end: parsed.end ?? parsed.close ?? "21:00" };
        }
      }
    } catch (e) {
      console.error("Failed to read opening_hours from localStorage", e);
    }

    return { start: "06:00", end: "21:00" };
  };

  const { data: openingData } = useQuery<{ start: string; end: string }, Error>(
    { queryKey: ["opening_hours"], queryFn: fetchOpening }
  );

  useEffect(() => {
    if (openingData) setOpeningHours(openingData as any);
  }, [openingData]);

  const generateTimeSlots = () => {
    const slots: Date[] = [];
    const startStr = (openingHours as any).start ?? (openingHours as any).open ?? "06:00";
    const endStr = (openingHours as any).end ?? (openingHours as any).close ?? "21:00";
    const [startHour, startMin] = String(startStr).trim().split(":").map(Number);
    const [endHour, endMin] = String(endStr).trim().split(":").map(Number);
    
    const start = new Date(selectedDate);
    start.setHours(startHour, startMin, 0, 0);

    const end = new Date(selectedDate);
    end.setHours(endHour, endMin, 0, 0);

    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }
    
    let current = start;
    while (current < end) {
      slots.push(new Date(current));
      current = addMinutes(current, 30);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  useEffect(() => {
    loadData();

    const bookingsChannel = supabase
      .channel("bookings-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
          const nowTs = Date.now();
          if (nowTs - reconcileCooldownRef.current < 1200) return;
          loadBookings();
        }
      )
      .subscribe();

    const roomsChannel = supabase
      .channel("rooms-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => {
          loadRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(roomsChannel);
    };
  }, [selectedDate]);

  useEffect(() => {
    checkOverdueBookings();
    const id = setInterval(() => {
      checkOverdueBookings();
    }, 60000);
    return () => clearInterval(id);
  }, [getNow]);

  const checkOverdueBookings = async (sourceBookings?: Booking[]) => {
    const now = getNow();
    const list = sourceBookings ?? bookings;
    try {
      const activePast = list.filter((b) => {
        const bookingStart = parseISO(b.start_time);
        return b.status === "active" && parseISO(b.end_time) < now && isSameDay(bookingStart, now);
      });
      if (activePast.length > 0) {
        const ids = activePast.map((b) => b.id);
        const { data: updated, error } = await supabase
          .from("bookings")
          .update({ status: "overdue" })
          .in("id", ids)
          .eq("status", "active")
          .select("*, disciplines(name, color_hex)");
        if (error) {
          console.error("Error marking bookings overdue:", error);
        } else if (updated && updated.length > 0) {
          setBookings((prev) => {
            const map = new Map(prev.map((p) => [p.id, p]));
            for (const u of updated) map.set(u.id, u as Booking);
            return Array.from(map.values());
          });
          reconcileCooldownRef.current = Date.now();
        }
      }

      const overdueNowGood = list.filter((b) => {
        const bookingStart = parseISO(b.start_time);
        return b.status === "overdue" && parseISO(b.end_time) > now && isSameDay(bookingStart, now);
      });
      if (overdueNowGood.length > 0) {
        const ids = overdueNowGood.map((b) => b.id);
        const { data: updated, error } = await supabase
          .from("bookings")
          .update({ status: "active" })
          .in("id", ids)
          .eq("status", "overdue")
          .select("*, disciplines(name, color_hex)");
        if (error) {
          console.error("Error re-activating bookings:", error);
        } else if (updated && updated.length > 0) {
          setBookings((prev) => {
            const map = new Map(prev.map((p) => [p.id, p]));
            for (const u of updated) map.set(u.id, u as Booking);
            return Array.from(map.values());
          });
          reconcileCooldownRef.current = Date.now();
        }
      }
    } catch (err) {
      console.error("checkOverdueBookings error:", err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadRooms(), loadBookings(), loadSettings()]);
    setLoading(false);
  };

  const loadRooms = async () => {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("enabled", true)
      .order("name");

    if (error) {
      console.error("Error loading rooms:", error);
      return;
    }
    const roomsList: Room[] = data || [];
    const roomRegex = /^Room\s*(\d+)$/i;

    const numericRooms = roomsList
      .map((r) => ({ r, m: (r.name.match(roomRegex) || [])[1] }))
      .filter((x) => x.m)
      .map((x) => ({ room: x.r, num: parseInt(x.m, 10) }))
      .sort((a, b) => a.num - b.num)
      .map((x) => x.room);

    const otherRooms = roomsList
      .filter((r) => !roomRegex.test(r.name))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    setRooms([...numericRooms, ...otherRooms]);
  };

  const loadBookings = async () => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("bookings")
      .select(`
        *,
        disciplines (
          name,
          color_hex
        )
      `)
      .gte("start_time", dayStart.toISOString())
      .lte("start_time", dayEnd.toISOString())
      .neq("status", "cancelled");

    if (error) {
      console.error("Error loading bookings:", error);
      return;
    }
    setBookings(data || []);
    checkOverdueBookings(data || []);
  };

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "opening_hours")
      .single();

    if (error) {
      console.error("Error loading settings:", error);
      return;
    }
    if (data) {
      const val = data.value as any;
      const normalized = {
        start: val.start ?? val.open ?? "06:00",
        end: val.end ?? val.close ?? "21:00",
      };
      setOpeningHours(normalized as any);
    }
  };

  const getBookingForCell = (roomId: string, timeSlot: Date) => {
    return bookings.find((booking) => {
      const bookingStart = parseISO(booking.start_time);
      const bookingEnd = parseISO(booking.end_time);
      return (
        booking.room_id === roomId &&
        timeSlot >= bookingStart &&
        timeSlot < bookingEnd
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="overflow-auto h-[calc(100vh-64px-2rem)] border border-grid-border rounded-lg text-black">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-grid-header">
            <th className="border-b border-grid-border p-2 text-left font-semibold min-w-[80px] sticky left-0 top-0 z-30 bg-grid-header">
              Time
            </th>
            {rooms.map((room) => (
              <th
                key={room.id}
                className={cn(
                  "border-b border-grid-border text-left font-semibold sticky top-0 z-30 bg-grid-header",
                  compact ? "p-1 min-w-[80px]" : "p-2 min-w-[120px]"
                )}
              >
                <div className={compact ? "text-sm" : ""}>{room.name}</div>
                <div className={cn("text-xs text-muted-foreground font-normal", compact && "hidden")}>
                  Capacity: {room.capacity}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot) => {
            const nowSlot = roundToNearest30(getNow());
            const isNowRow = slot.getTime() === nowSlot.getTime();
            return (
            <tr key={slot.toISOString()} className={cn("hover:bg-grid-cell-hover") }>
              <td className={cn(
                "border-0 border-r border-grid-border p-2 text-sm font-medium sticky left-0 z-30",
                isNowRow ? "bg-sky-100" : "bg-grid-header"
              )}>
                  {format(slot, "HH:mm")}
                </td>
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
                      compact={compact}
                      isNowRow={isNowRow}
                    />
                  );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default BookingGrid;
