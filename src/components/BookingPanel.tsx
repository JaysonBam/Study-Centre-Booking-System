import { useState, useEffect } from "react";
import { useNow } from "@/context/NowContext";
import { supabase } from "@/lib/supabaseClient";
import { format, parseISO, addMinutes, startOfDay, differenceInMinutes } from "date-fns";
import { roundToNearest30, roundUpToNearest30 } from "@/lib/utils";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeInput } from "@/components/ui/time-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const bookingSchema = z.object({
  staff_name: z.string().trim().min(1, "Staff name is required").max(100, "Staff name must be less than 100 characters"),
  student_numbers: z.string().max(1000, "Student numbers must be less than 1000 characters").optional(),
  room_id: z.string().uuid("Invalid room selected"),
  discipline_id: z.string().uuid("Invalid discipline selected"),
  start_time: z.string().datetime("Invalid start time"),
  end_time: z.string().datetime("Invalid end time"),
});

const mapDatabaseError = (error: any): string => {
  if (!error) return "An unexpected error occurred";
  if (error.code === "23P01") {
    return "This time slot is already booked. Please choose another time.";
  }
  if (error.code === "23514") {
    return "Invalid booking time. Please use 30-minute intervals.";
  }
  if (error.code === "23503") {
    return "Invalid room or discipline selected. Please refresh and try again.";
  }
  if (error.code === "42501" || error.message?.includes("permission denied")) {
    return "You don't have permission to perform this action.";
  }
  return "Unable to complete the operation. Please try again or contact support.";
};

interface Room {
  id: string;
  name: string;
  capacity: number;
  hasOverdue?: boolean;
  overdueLabel?: string;
  hasReservedLate?: boolean;
  reservedLateLabel?: string;
}

interface Discipline {
  id: string;
  name: string;
  color_hex: string;
}

interface BookingPanelProps {
  open: boolean;
  onClose: () => void;
  prefillData?: {
    roomId?: string;
    timeSlot?: string;
    booking?: any;
  };
}

export const BookingPanel = ({ open, onClose, prefillData }: BookingPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [openingHours, setOpeningHours] = useState({ start: "06:00", end: "21:00" });
  
  const [roomId, setRoomId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startClock, setStartClock] = useState("");
  const [duration, setDuration] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [staffName, setStaffName] = useState("");
  const [studentNumbers, setStudentNumbers] = useState("");
  const [extendMinutes, setExtendMinutes] = useState<number | null>(null);
  const [availableExtends, setAvailableExtends] = useState<number[]>([]);

  const STANDARD_INCREMENTS = [30, 60, 90, 120];

  const isEditMode = !!prefillData?.booking;

  const computeAvailableExtends = async (booking: any) => {
    try {
  const start = parseISO(booking.start_time);
  const end = parseISO(booking.end_time);
  const currentDuration = (end.getTime() - start.getTime()) / (1000 * 60);
      const { data: nextData, error: nextError } = await supabase
        .from("bookings")
        .select("start_time")
        .eq("room_id", booking.room_id)
        .gte("start_time", booking.end_time)
        .neq("status", "cancelled")
        .order("start_time", { ascending: true })
        .limit(1);

      if (nextError) {
        console.error("Error fetching next booking:", nextError);
        setAvailableExtends([]);
        return;
      }

      let allowedAdditionalMinutes = 0;
      if (nextData && nextData.length > 0) {
        const nextStart = parseISO(nextData[0].start_time);
        allowedAdditionalMinutes = Math.max(0, Math.floor((nextStart.getTime() - end.getTime()) / (1000 * 60)));
      } else {
        const dayEnd = new Date(start);
        const [endHour, endMin] = String((openingHours as any).end ?? (openingHours as any).close ?? "21:00").split(":").map(Number);
        dayEnd.setHours(endHour, endMin, 0, 0);
        if (dayEnd <= start) dayEnd.setDate(dayEnd.getDate() + 1);
        allowedAdditionalMinutes = Math.max(0, Math.floor((dayEnd.getTime() - end.getTime()) / (1000 * 60)));
      }
      console.debug("computeAvailableExtends", {
        bookingId: booking.id,
        allowedAdditionalMinutes,
        nextFound: !!(nextData && nextData.length > 0),
        openingEnd: (openingHours as any).end,
      });

      const increments = STANDARD_INCREMENTS.filter((m) => m <= allowedAdditionalMinutes);
      setAvailableExtends(increments);
      if (extendMinutes && !increments.includes(extendMinutes)) setExtendMinutes(null);
    } catch (err) {
      console.error("computeAvailableExtends error", err);
      setAvailableExtends([]);
    }
  };

  const computeAvailableForStart = async (startIso: string, roomIdVal: string) => {
    try {
      if (!startIso || !roomIdVal) {
        setAvailableExtends([]);
        return;
      }

      const start = parseISO(startIso);

      const startIsoFull = start.toISOString();

      const { data: nextData, error: nextError } = await supabase
        .from("bookings")
        .select("start_time")
        .eq("room_id", roomIdVal)
        .gte("start_time", startIsoFull)
        .neq("status", "cancelled")
        .order("start_time", { ascending: true })
        .limit(1);

      if (nextError) {
        console.error("Error fetching next booking for start compute:", nextError);
        setAvailableExtends([]);
        return;
      }

      let allowedMinutes = 0;
      if (nextData && nextData.length > 0) {
        const nextStart = parseISO(nextData[0].start_time);
        allowedMinutes = Math.max(0, Math.floor((nextStart.getTime() - start.getTime()) / (1000 * 60)));
      } else {
        const dayEnd = new Date(start);
        const [endHour, endMin] = String((openingHours as any).end ?? (openingHours as any).close ?? "21:00").split(":").map(Number);
        dayEnd.setHours(endHour, endMin, 0, 0);
        if (dayEnd <= start) dayEnd.setDate(dayEnd.getDate() + 1);
        allowedMinutes = Math.max(0, Math.floor((dayEnd.getTime() - start.getTime()) / (1000 * 60)));
      }

      const increments = STANDARD_INCREMENTS.filter((m) => m <= allowedMinutes);
      setAvailableExtends(increments);
      if (duration && !increments.includes(parseInt(duration, 10))) setDuration("");
    } catch (err) {
      console.error("computeAvailableForStart error", err);
      setAvailableExtends([]);
    }
  };

  const loadData = async () => {
    const [roomsRes, disciplinesRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("enabled", true).order("name"),
      supabase.from("disciplines").select("*").order("name"),
    ]);

    const roomsData = roomsRes.data || [];
    const roomRegex = /^Room\s*(\d+)$/i;

    const numericRooms = roomsData
      .map((r) => ({ r, m: (r.name.match(roomRegex) || [])[1] }))
      .filter((x) => x.m)
      .map((x) => ({ room: x.r, num: parseInt(x.m, 10) }))
      .sort((a, b) => a.num - b.num)
      .map((x) => x.room);

    const otherRooms = roomsData
      .filter((r) => !roomRegex.test(r.name))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const sortedRooms = [...numericRooms, ...otherRooms];

    if (prefillData?.roomId) {
      const idx = sortedRooms.findIndex((r) => r.id === prefillData.roomId);
      if (idx > 0) {
        const [pref] = sortedRooms.splice(idx, 1);
        sortedRooms.unshift(pref);
      }
    }

    setRooms(sortedRooms);
    setDisciplines(disciplinesRes.data || []);
    try {
      const { data } = await supabase.from("settings").select("value").eq("key", "opening_hours").single();
      if (data) {
        const val = data.value as any;
        setOpeningHours({ start: val.start ?? val.open ?? "06:00", end: val.end ?? val.close ?? "21:00" });
      }
    } catch (err) {
      // ignore
    }
    return sortedRooms;
  };

  async function prefillForm(loadedRooms?: Room[]) {
    if (isEditMode && prefillData?.booking) {
      const booking = prefillData.booking;
      setRoomId(booking.room_id);
      const combined = format(parseISO(booking.start_time), "yyyy-MM-dd'T'HH:mm");
      setStartTime(combined);
      setStartDate(format(parseISO(booking.start_time), "yyyy-MM-dd"));
      setStartClock(format(parseISO(booking.start_time), "HH:mm"));
      const start = parseISO(booking.start_time);
      const end = parseISO(booking.end_time);
      const mins = (end.getTime() - start.getTime()) / (1000 * 60);
      setDuration(mins.toString());
      setDisciplineId(booking.discipline_id);
      setStaffName(booking.staff_name);
      setStudentNumbers(booking.student_numbers || "");

      if (booking.status === "active" || booking.status === "overdue") {
        await computeAvailableExtends(booking);
      } else {
        setAvailableExtends([]);
      }
  } else {
      if (prefillData?.roomId) setRoomId(prefillData.roomId);
      if (prefillData?.timeSlot) {
        const combined = format(parseISO(prefillData.timeSlot), "yyyy-MM-dd'T'HH:mm");
        setStartTime(combined);
        setStartDate(format(parseISO(prefillData.timeSlot), "yyyy-MM-dd"));
        setStartClock(format(parseISO(prefillData.timeSlot), "HH:mm"));
      } else {
  const now = roundToNearest30(getNow());
  const todayStart = new Date(now);
  const [startHour, startMin] = String((openingHours as any).start ?? (openingHours as any).open ?? "06:00").split(":").map(Number);
  todayStart.setHours(startHour, startMin, 0, 0);
  const todayEnd = new Date(now);
  const [endHour, endMin] = String((openingHours as any).end ?? (openingHours as any).close ?? "21:00").split(":").map(Number);
  todayEnd.setHours(endHour, endMin, 0, 0);
  let chosen = now;
  if (chosen < todayStart) chosen = todayStart;
  if (chosen >= todayEnd) {
    const nextStart = new Date(todayStart);
    nextStart.setDate(nextStart.getDate() + 1);
    chosen = nextStart;
  }
        const combined = format(chosen, "yyyy-MM-dd'T'HH:mm");
        setStartTime(combined);
        setStartDate(format(chosen, "yyyy-MM-dd"));
        setStartClock(format(chosen, "HH:mm"));
  let available: Room[] = [];
    try {
          const chosenIso = chosen.toISOString();
          const { data: busyData, error: busyError } = await supabase
            .from("bookings")
            .select("room_id, status, start_time, end_time")
            .neq("status", "cancelled")
            .lte("start_time", chosenIso)
            .gt("end_time", chosenIso);

            if (!busyError) {
            const nowDt = getNow();
            const busySet = new Set<string>();
            const reservedLateMap = new Map<string, number>();
            for (const b of (busyData || [])) {
              try {
                const rid = b.room_id as string;
                const status = b.status as string;
                const start = parseISO(b.start_time);
                if (status === 'reserved') {
                  const minsLate = Math.max(0, differenceInMinutes(nowDt, start));
                  if (minsLate > 10) {
                    reservedLateMap.set(rid, minsLate);
                    continue;
                  }
                }
                busySet.add(b.room_id);
              } catch (e) {
                if (b && b.room_id) busySet.add(b.room_id);
              }
            }
            const baseRooms = (loadedRooms && loadedRooms.length > 0) ? loadedRooms : (rooms || []);

            let annotatedRooms = baseRooms.map((r) => {
              const mins = reservedLateMap.get(r.id);
              if (!mins) return r;
              const hours = Math.floor(mins / 60);
              const minutes = mins % 60;
              const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
              return { ...r, hasReservedLate: true, reservedLateLabel: label };
            });
            
              try {
              const baseRoomIds = baseRooms.map((r) => r.id);
              if (baseRoomIds.length > 0) {
                const nowIso = getNow().toISOString();
                const chosenDate = parseISO(chosenIso);
                const dayStartIso = startOfDay(chosenDate).toISOString();
                const [overdueRes, activeLateRes] = await Promise.all([
                  supabase
                    .from("bookings")
                    .select("room_id, end_time")
                    .in("room_id", baseRoomIds)
                    .eq("status", "overdue")
                    .gte("start_time", dayStartIso)
                    .lt("start_time", chosenIso),
                  supabase
                    .from("bookings")
                    .select("room_id, end_time")
                    .in("room_id", baseRoomIds)
                    .eq("status", "active")
                    .lt("end_time", nowIso)
                    .gte("start_time", dayStartIso)
                    .lt("start_time", chosenIso),
                ]);

                const overdueMap = new Map<string, string>();
                if (!overdueRes.error && overdueRes.data) {
                  for (const r of overdueRes.data) {
                    try {
                      const existing = overdueMap.get(r.room_id);
                      if (!existing || parseISO(r.end_time) > parseISO(existing)) {
                        overdueMap.set(r.room_id, r.end_time);
                      }
                    } catch (e) {
                    }
                  }
                }
                if (!activeLateRes.error && activeLateRes.data) {
                  for (const r of activeLateRes.data) {
                    try {
                      const existing = overdueMap.get(r.room_id);
                      if (!existing || parseISO(r.end_time) > parseISO(existing)) {
                        overdueMap.set(r.room_id, r.end_time);
                      }
                    } catch (e) {
                    }
                  }
                }

                if (overdueMap.size > 0) {
                  const nowDt = getNow();
                  annotatedRooms = annotatedRooms.map((r) => {
                    const endIso = overdueMap.get(r.id);
                    if (!endIso) return { ...r, hasOverdue: false };
                    const endDt = parseISO(endIso);
                    const mins = Math.max(0, differenceInMinutes(nowDt, endDt));
                    const hours = Math.floor(mins / 60);
                    const minutes = mins % 60;
                    const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                    return { ...r, hasOverdue: true, overdueLabel: label };
                  });
                }

            available = annotatedRooms.filter((r) => {
              const hasOverdue = (r as any).hasOverdue === true;
              const hasReservedLate = (r as any).hasReservedLate === true;
              return !busySet.has(r.id) || hasOverdue || hasReservedLate;
            });
              }
            } catch (err) {
              console.error("Error checking previous overdue bookings:", err);
            }
            if (prefillData?.roomId) {
              const hasPrefill = available.find((r) => r.id === prefillData.roomId);
              if (!hasPrefill) {
                const pref = (rooms || []).find((r) => r.id === prefillData.roomId);
                if (pref) available.unshift(pref);
              }
            }
            setRooms(available);
          }
        } catch (err) {
          console.error("Error checking room availability:", err);
        }
      }
      setDuration("");
      setDisciplineId("");
      setStaffName("");
      setStudentNumbers("");
      setAvailableExtends([]);
    }
  }

  useEffect(() => {
    if (open) {
      loadData().then((loaded) => prefillForm(loaded)).catch((err) => console.error(err));
    }
  }, [open, prefillData]);

  useEffect(() => {
    if (!isEditMode) {
      if (roomId && startTime) {
        computeAvailableForStart(startTime, roomId);
      } else {
        setAvailableExtends([]);
      }
    }
  }, [roomId, startTime, isEditMode]);

  const { getNow } = useNow();

  useEffect(() => {
    if (startDate && startClock) {
      setStartTime(`${startDate}T${startClock}`);
    }
  }, [startDate, startClock]);

  const handleSave = async (status: "active" | "reserved") => {
    if (!roomId || !startTime || !duration || !disciplineId || !staffName) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);

    try {
      const start = new Date(startTime);
      const end = addMinutes(start, parseInt(duration));

      const bookingData = {
        room_id: roomId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        discipline_id: disciplineId,
        staff_name: staffName.trim(),
        student_numbers: studentNumbers?.trim() || null,
        status,
      };

      const validation = bookingSchema.safeParse(bookingData);
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast.error(firstError.message);
        return;
      }

      if (isEditMode) {
        const { error } = await supabase
          .from("bookings")
          .update(bookingData)
          .eq("id", prefillData.booking.id);

        if (error) throw error;
        toast.success("Booking updated successfully");
      } else {
        const { error } = await supabase.from("bookings").insert(bookingData);

        if (error) throw error;
        toast.success("Booking created successfully");
      }

      onClose();
    } catch (error: any) {
      toast.error(mapDatabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!prefillData?.booking) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", prefillData.booking.id);

      if (error) throw error;
      toast.success("Booking deleted successfully");
      onClose();
    } catch (error: any) {
      toast.error(mapDatabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEndBooking = async () => {
    if (!prefillData?.booking) return;

    setLoading(true);
    try {
  const now = roundToNearest30(getNow());
      const currentEndTime = parseISO(prefillData.booking.end_time);
      const newEndTime = now > currentEndTime ? currentEndTime : now;
      
      const { error } = await supabase
        .from("bookings")
        .update({
          end_time: newEndTime.toISOString(),
          status: "ended",
        })
        .eq("id", prefillData.booking.id);

      if (error) throw error;
      toast.success("Booking ended successfully");
      onClose();
    } catch (error: any) {
      toast.error(mapDatabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleActivateBooking = async () => {
    if (!prefillData?.booking) return;

    setLoading(true);
    try {
      const booking = prefillData.booking;
  const now = roundUpToNearest30(getNow());
      const originalEnd = parseISO(booking.end_time);

      let newEnd = originalEnd;
      if (getNow() < originalEnd) {
        newEnd = roundToNearest30(originalEnd);
      }

      const { error } = await supabase
        .from("bookings")
        .update({
          status: "active",
          end_time: newEnd.toISOString(),
        })
        .eq("id", booking.id);

      if (error) throw error;
      toast.success("Booking activated successfully");
      onClose();
    } catch (error: any) {
      toast.error(mapDatabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async () => {
    if (!prefillData?.booking || !extendMinutes) return;
    setLoading(true);
    try {
      const booking = prefillData.booking;
      const originalEnd = parseISO(booking.end_time);
      const newEnd = addMinutes(originalEnd, extendMinutes);

      if (!availableExtends.includes(extendMinutes)) {
        toast.error("Selected extension exceeds available gap to next booking");
        setLoading(false);
        return;
      }

      const now = roundToNearest30(getNow());
      const updatePayload: any = { end_time: newEnd.toISOString() };
      if (newEnd > getNow()) {
        updatePayload.status = "active";
      }

      const { error } = await supabase
        .from("bookings")
        .update(updatePayload)
        .eq("id", booking.id);

      if (error) throw error;
      toast.success("Booking extended successfully");
      onClose();
    } catch (error: any) {
      toast.error(mapDatabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <div className="space-y-3">
          <div className="max-h-[72vh] overflow-auto px-3 py-3">
          
          <div className="space-y-2">
            <Label htmlFor="room">Room</Label>
            <Select value={roomId} onValueChange={setRoomId} disabled={loading}>
              <SelectTrigger id="room">
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    <div className="flex flex-col">
                      <div className={room.hasOverdue ? "font-medium text-red-600" : room.hasReservedLate ? "font-medium text-amber-700" : "font-medium text-black"}>
                        {room.name}
                      </div>
                      <div className={room.hasOverdue ? "text-xs text-red-500" : room.hasReservedLate ? "text-xs text-amber-600" : "text-xs text-muted-foreground"}>
                        Capacity: {room.capacity}
                        {room.hasOverdue && (` — Previous booking overdue${room.overdueLabel ? ` (${room.overdueLabel})` : ""}`)}
                        {room.hasReservedLate && (` — Reserved, people late${room.reservedLateLabel ? ` (${room.reservedLateLabel})` : ""}`)}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startClock">Time</Label>
              <TimeInput
                id="startClock"
                value={startClock}
                onChange={(val: any) => setStartClock(String(val))}
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select value={duration} onValueChange={setDuration} disabled={loading}>
                <SelectTrigger id="duration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {(!isEditMode && availableExtends && availableExtends.length > 0) ? (
                    availableExtends.map((m) => (
                      <SelectItem key={m} value={m.toString()}>{m === 60 ? '1 hour' : m === 90 ? '1.5 hours' : m === 120 ? '2 hours' : `${m} minutes`}</SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discipline">Discipline</Label>
              <Select value={disciplineId} onValueChange={setDisciplineId} disabled={loading}>
                <SelectTrigger id="discipline">
                  <SelectValue placeholder="Select discipline" />
                </SelectTrigger>
                <SelectContent>
                  {disciplines.map((discipline) => (
                    <SelectItem key={discipline.id} value={discipline.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: discipline.color_hex }}
                        />
                        {discipline.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="staffName">Staff Name</Label>
            <Input
              id="staffName"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Your name"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="studentNumbers">Student Numbers</Label>
            <Textarea
              id="studentNumbers"
              value={studentNumbers}
              onChange={(e) => setStudentNumbers(e.target.value)}
              placeholder="One student number per line"
              disabled={loading}
              rows={4}
              className="min-h-[6rem] resize-y"
            />
          </div>

          </div>
        </div>

  <div className="px-3 py-2 bg-muted/5 flex flex-wrap gap-2 items-center justify-end">
          {isEditMode ? (
            <>
              <Button onClick={() => handleSave(prefillData.booking.status)} disabled={loading} className="min-w-[140px]">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>

              {(prefillData.booking.status === "active" || prefillData.booking.status === "overdue") && (
                <>
                  <Button onClick={handleEndBooking} disabled={loading} variant="secondary">
                    End Booking
                  </Button>

                  {(!availableExtends || availableExtends.length === 0) ? (
                    <div className="text-sm text-muted-foreground mr-2">No extension available</div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Select value={extendMinutes?.toString() ?? ""} onValueChange={(v) => setExtendMinutes(v ? parseInt(v, 10) : null)} disabled={loading}>
                        <SelectTrigger id="extend">
                          <SelectValue placeholder="Extend" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableExtends.map((m) => (
                            <SelectItem key={m} value={m.toString()}>{`+${m} mins`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleExtend} disabled={loading || !extendMinutes} variant="ghost">Extend</Button>
                    </div>
                  )}
                </>
              )}

              {prefillData.booking.status === "reserved" && (
                <Button onClick={handleActivateBooking} disabled={loading} variant="secondary">
                  Activate
                </Button>
              )}

              <Button onClick={handleDelete} disabled={loading} variant="destructive">
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => handleSave("active")} disabled={loading} className="min-w-[140px]">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Book-in (Active)
              </Button>
              <Button onClick={() => handleSave("reserved")} disabled={loading} variant="secondary">
                Reserve (Future)
              </Button>
            </>
          )}
  </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingPanel;
