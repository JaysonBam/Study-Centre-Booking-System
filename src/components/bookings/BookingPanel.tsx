import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeInput } from "@/components/ui/time-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/lib/supabaseClient";
import { format, parseISO, addMinutes, eachDayOfInterval, isBefore } from "date-fns";
import timeLib from "@/lib/time";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useConfirm } from "@/context/ConfirmDialogContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getBookingSoftState } from "@/lib/utils";
import { useNow } from "@/context/NowContext";

interface BookingPanelProps {
  open: boolean;
  onClose: () => void;
  prefill?: { roomId?: string; timeSlot?: string; booking?: any } | null;
  defaultStaffName?: string;
}

export const BookingPanel: React.FC<BookingPanelProps> = ({ open, onClose, prefill = null, defaultStaffName = "" }) => {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { currentTime } = useNow();

  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [borrowableItems, setBorrowableItems] = useState<string[]>([]);

  const [roomId, setRoomId] = useState<string>(prefill?.roomId ?? "");
  const [startDate, setStartDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [startClock, setStartClock] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(Math.round(now.getMinutes() / 30) * 30);
    return format(now, "HH:mm");
  });
  const [duration, setDuration] = useState<string>("30");
  const [staffName, setStaffName] = useState<string>(defaultStaffName);
  const [studentNumbers, setStudentNumbers] = useState<string>("");

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [otherCourseName, setOtherCourseName] = useState<string>("");
  const [selectedState, setSelectedState] = useState<"Active" | "Reserved" | "Ended">("Active");

  const [selectedBorrowed, setSelectedBorrowed] = useState<Record<string, boolean>>({});
  const [dayBookings, setDayBookings] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Bulk booking state
  const [isBulkBooking, setIsBulkBooking] = useState(false);
  const [bulkDates, setBulkDates] = useState<{ start: string; end: string }[]>([{ start: "", end: "" }]);
  const [bulkTimes, setBulkTimes] = useState<{ start: string; end: string }[]>([{ start: "", end: "" }]);
  const [bulkRoomIds, setBulkRoomIds] = useState<string[]>([]);

  // Load rooms and courses when panel opens
  useEffect(() => {
    if (!open) return;
    
    const load = async () => {
      setLoading(true);
      setDayBookings([]); // Clear stale bookings to prevent incorrect duration clamping
      try {
        // Reset form to defaults whenever panel opens to avoid stale values from previous edits
        setRoomId(prefill?.roomId ?? "");
        setStartDate(() => new Date().toISOString().slice(0, 10));
        const nowInit = new Date();
        nowInit.setMinutes(Math.round(nowInit.getMinutes() / 30) * 30);
        setStartClock(format(nowInit, "HH:mm"));
        setDuration("30");
        setStaffName(defaultStaffName);
        setStudentNumbers("");
        setSelectedCourseId("");
        setOtherCourseName("");
        setSelectedBorrowed({});
        setBorrowableItems([]);
        setSelectedState("Active");
        setErrors({});
        
        // Reset bulk booking state
        setIsBulkBooking(false);
        setBulkDates([{ start: "", end: "" }]);
        setBulkTimes([{ start: "", end: "" }]);
        setBulkRoomIds([]);

        // If no prefill time provided, populate defaults from testing clock / now
        if (!prefill?.timeSlot && !prefill?.booking) {
          try {
            const t = await timeLib.getTime();
            setStartDate(format(t, "yyyy-MM-dd"));
            setStartClock(format(t, "HH:mm"));
          } catch (e) {
            // ignore
          }
        }

        const [{ data: roomsData }, { data: coursesData }] = await Promise.all([
          supabase.from("rooms").select("id,name,borrowable_items,is_available").order("name"),
          supabase.from("courses").select("id,name").order("name"),
        ]);
        const rlist = (roomsData || []).filter((r: any) => r.is_available !== false).map((r: any) => ({ ...r, id: String(r.id) }));
        setRooms(rlist);
        setCourses(coursesData || []);

        // If prefill room provided, select and load its borrowable items
        if (prefill?.roomId) {
          setRoomId(prefill.roomId);
          const chosen = rlist.find((x: any) => String(x.id) === String(prefill.roomId));
          setBorrowableItems(chosen?.borrowable_items || []);
          // reset borrowed selection
          const sel: Record<string, boolean> = {};
          (chosen?.borrowable_items || []).forEach((it: string) => (sel[it] = false));
          setSelectedBorrowed(sel);
        }

        // If prefilled with a timeslot (from Book button or clicking a cell), set date/time
        if (prefill?.timeSlot) {
          try {
            const dt = new Date(prefill.timeSlot);
            // use local date/time formatting
            setStartDate(format(dt, "yyyy-MM-dd"));
            setStartClock(format(dt, "HH:mm"));
          } catch (e) {
            // ignore
          }
        }

        // If editing existing booking, prefill fields
        if (prefill?.booking) {
          const b = prefill.booking;
          setRoomId(String(b.room_id));
          setStartDate(b.booking_day);
          setStartClock(b.start_time.slice(0,5));
          // compute duration from times
          try {
            const s = parseISO(`${b.booking_day}T${b.start_time}`);
            const e = parseISO(`${b.booking_day}T${b.end_time}`);
            const mins = Math.round((e.getTime() - s.getTime())/60000);
            setDuration(String(mins));
          } catch (e) {
            // ignore
          }
          setStaffName(b.booked_by || "");
          setStudentNumbers(b.student_numbers || "");
            if (b.course_id) {
              setSelectedCourseId(String(b.course_id));
              setOtherCourseName("");
            } else if (b.course_name) {
              setSelectedCourseId("other");
              setOtherCourseName(b.course_name || "");
            } else {
              setSelectedCourseId("");
              setOtherCourseName("");
            }
          const chosen = rlist.find((x: any) => String(x.id) === String(b.room_id));
          setBorrowableItems(chosen?.borrowable_items || []);
          const sel: Record<string, boolean> = {};
          (b.borrowed_items || []).forEach((it: string) => (sel[it] = true));
          setSelectedBorrowed(sel);
          // set state when editing
          setSelectedState((b.state as any) ?? "Active");

          // Fetch bookings for this day immediately to ensure duration calculation and room status is correct
          const { data: bookingsData } = await supabase
            .from('bookings')
            .select('id, room_id, start_time, end_time, state, booking_day')
            .eq('booking_day', b.booking_day);
          if (bookingsData) {
            setDayBookings(bookingsData);
            
            // Re-calculate duration after bookings are loaded to ensure it's valid
            try {
                const s = parseISO(`${b.booking_day}T${b.start_time}`);
                const e = parseISO(`${b.booking_day}T${b.end_time}`);
                const mins = Math.round((e.getTime() - s.getTime())/60000);
                setDuration(String(mins));
            } catch (e) {
                // ignore
            }
          }
        } else {
            // Also fetch for new bookings if room is pre-selected or just default date
            const targetDate = prefill?.timeSlot ? format(new Date(prefill.timeSlot), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
            const { data: bookingsData } = await supabase
            .from('bookings')
            .select('id, room_id, start_time, end_time, state, booking_day')
            .eq('booking_day', targetDate);
             if (bookingsData) {
                setDayBookings(bookingsData);
            }
        }
      } catch (err) {
        console.error("Error loading panel data", err);
        toast({ title: "Error", description: "Failed to load booking data" });
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch bookings for the selected date (all rooms) to calculate availability
  useEffect(() => {
    if (!startDate || !open) return;
    
    const fetchBookings = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, room_id, start_time, end_time, state, booking_day')
        .eq('booking_day', startDate);
        
      if (!error && data) {
        setDayBookings(data);
      }
    };
    
    fetchBookings();
  }, [startDate, open]);

  const availableDurationOptions = React.useMemo(() => {
    if (!startClock) return [30];
    
    const parseTime = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const startMins = parseTime(startClock);
    let limitMins = 24 * 60; // End of day

    // Find the earliest start time of a booking that is AFTER our start time
    for (const b of dayBookings) {
      // Filter by selected room
      if (String(b.room_id) !== String(roomId)) continue;
      
      // If editing, skip the current booking
      if (prefill?.booking && String(b.id) === String(prefill.booking.id)) continue;

      const bStart = parseTime(b.start_time);
      const bEnd = parseTime(b.end_time);

      // If a booking overlaps our start time, we technically have 0 duration available.
      if (bStart > startMins) {
        if (bStart < limitMins) {
          limitMins = bStart;
        }
      } else if (bStart <= startMins && bEnd > startMins) {
         // We are starting inside another booking.
         limitMins = startMins; 
      }
    }

    const maxDuration = limitMins - startMins;
    const options: number[] = [];
    
    // Generate 30 min intervals up to maxDuration or a reasonable cap (e.g. 2 hours)
    for (let d = 30; d <= maxDuration && d <= 120; d += 30) {
      options.push(d);
    }

    // Ensure current duration is in the list if it's valid
    const currentDur = parseInt(duration, 10);
    if (!isNaN(currentDur) && currentDur > 0 && !options.includes(currentDur)) {
        // Only add if it fits within maxDuration OR if we are editing and it's the existing duration
        if (currentDur <= maxDuration || (prefill?.booking && currentDur <= 120)) {
             options.push(currentDur);
             options.sort((a, b) => a - b);
        }
    }
    
    return options;
  }, [startClock, dayBookings, prefill?.booking, duration]);

  const availableExtensionOptions = React.useMemo(() => {
    if (!prefill?.booking) return [];

    const parseTime = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const startMins = parseTime(startClock);
    const currentDuration = parseInt(duration, 10);
    if (isNaN(currentDuration)) return [];

    const endMins = startMins + currentDuration;
    let limitMins = 24 * 60; // End of day

    // Find the earliest start time of a booking that is AFTER our current end time
    for (const b of dayBookings) {
      if (String(b.room_id) !== String(roomId)) continue;
      if (prefill?.booking && String(b.id) === String(prefill.booking.id)) continue;

      const bStart = parseTime(b.start_time);
      
      if (bStart >= endMins) {
        if (bStart < limitMins) {
          limitMins = bStart;
        }
      }
    }

    const maxExtension = limitMins - endMins;
    const options: number[] = [];

    // Generate 30 min intervals up to maxExtension or cap at 120 mins (2 hours extension)
    for (let d = 30; d <= maxExtension && d <= 120; d += 30) {
      options.push(d);
    }

    return options;
  }, [startClock, duration, dayBookings, prefill?.booking]);

  // Adjust duration if the currently selected duration is no longer available
  useEffect(() => {
    const currentDur = parseInt(duration);
    if (availableDurationOptions.length > 0) {
        // If no duration selected, or current duration is invalid/NaN, select the first option
        if (!duration || Number.isNaN(currentDur)) {
             setDuration(String(availableDurationOptions[0]));
             return;
        }

        const max = availableDurationOptions[availableDurationOptions.length - 1];
        if (currentDur > max) {
            setDuration(String(max));
        }
    } else {
        // No options available
        if (duration !== "") {
            setDuration("");
        }
    }
  }, [availableDurationOptions, duration]);

  // When room selection changes, update borrowable items list
  useEffect(() => {
    const r = rooms.find((x) => String(x.id) === String(roomId));
    const items = r?.borrowable_items || [];
    setBorrowableItems(items);

    // If we're editing an existing booking for this same room, preserve the selected borrowed items
    if (prefill?.booking && String(prefill.booking.room_id) === String(roomId)) {
      setSelectedBorrowed((prev) => {
        const out: Record<string, boolean> = { ...(prev || {}) };
        // ensure all current borrowable items exist in the map
        items.forEach((it: string) => { if (!(it in out)) out[it] = false; });
        // remove keys that are no longer available in this room
        Object.keys(out).forEach((k) => { if (!items.includes(k)) delete out[k]; });
        return out;
      });
      return;
    }

    const sel: Record<string, boolean> = {};
    items.forEach((it: string) => (sel[it] = false));
    setSelectedBorrowed(sel);
  }, [roomId, rooms, prefill?.booking]);

  const toggleBorrowed = (item: string) => {
    setSelectedBorrowed((s) => ({ ...s, [item]: !s[item] }));
  };

  const mapDatabaseError = (error: any): string => {
    if (!error) return "An unexpected error occurred";
    if (error.code === "23P01") return "This time slot is already booked. Please choose another time.";
    if (error.code === "23514") return "Invalid booking time. Please use 30-minute intervals.";
    if (error.code === "23503") return "Invalid room or course selected. Please refresh and try again.";
    return error.message || "Unable to complete the operation.";
  };

  const handleSave = async (state: "Active" | "Reserved" | "Ended") => {
    if (isBulkBooking) {
      await handleBulkSave(state);
      return;
    }

    const newErrors: Record<string, boolean> = {};
    if (!roomId) newErrors.roomId = true;
    if (!startDate) newErrors.startDate = true;
    if (!startClock) newErrors.startClock = true;
    if (!duration) newErrors.duration = true;
    if (!staffName?.trim()) newErrors.staffName = true;
    if (!selectedCourseId) newErrors.selectedCourseId = true;
    if (selectedCourseId === "other" && !otherCourseName?.trim()) newErrors.otherCourseName = true;

    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
        return;
    }

    // Validate 30-minute increments for start time and duration
    const startParts = startClock.split(":").map((s) => parseInt(s, 10));
    const startMins = (startParts[1] ?? 0);
    const dur = parseInt(duration, 10);
    if (Number.isNaN(startMins) || (startMins % 30) !== 0) {
      toast({ title: "Invalid start time", description: "Start time must be on a 30-minute boundary (e.g. 09:00, 09:30)" });
      return;
    }
    if (Number.isNaN(dur) || dur <= 0 || (dur % 30) !== 0) {
      toast({ title: "Invalid duration", description: "Duration must be a positive multiple of 30 minutes" });
      return;
    }

    // If user selected Other course, ensure they entered a name
    // (Already checked above in newErrors logic)

    const borrowed = Object.keys(selectedBorrowed).filter((k) => selectedBorrowed[k]);

    if (state === "Ended" && borrowed.length > 0) {
      const lowercasedItems = borrowed.map((item) => item.toLowerCase());
      const itemsList = lowercasedItems.join(', ');
      const lastIndex = itemsList.lastIndexOf(', ');
      const formattedList = lastIndex !== -1 
          ? itemsList.substring(0, lastIndex) + ' and ' + itemsList.substring(lastIndex + 2)
          : itemsList;
      
      const verb = lowercasedItems.length === 1 ? 'Is' : 'Are';
      const returned = await confirm({
        title: "Confirm Return",
        description: `${verb} ${formattedList} returned?`,
        confirmText: "Yes",
        cancelText: "No",
      });
      if (!returned) {
        return;
      }
    }

    setLoading(true);
    try {
      const start = parseISO(`${startDate}T${startClock}`);
      const end = addMinutes(start, parseInt(duration, 10));
      const booking_day = startDate;
      const start_time = format(start, "HH:mm:ss");
      const end_time = format(end, "HH:mm:ss");

      const payload: any = {
        room_id: parseInt(roomId, 10),
        start_time,
        end_time,
        booking_day,
        student_numbers: studentNumbers || null,
        borrowed_items: borrowed,
        booked_by: staffName,
        state,
      };

      if (selectedCourseId && selectedCourseId !== "other") {
        payload.course_id = parseInt(selectedCourseId, 10);
        payload.course_name = null;
      } else if (selectedCourseId === "other") {
        payload.course_id = null;
        payload.course_name = otherCourseName || null;
      } else {
        payload.course_id = null;
        payload.course_name = null;
      }

      if (prefill?.booking) {
        // update
        const { error } = await supabase.from("bookings").update(payload).eq("id", prefill.booking.id);
        if (error) throw error;
        toast({ title: "Updated", description: "Booking updated" });
      } else {
        const { error } = await supabase.from("bookings").insert(payload);
        if (error) throw error;
        toast({ title: "Saved", description: "Booking created" });
      }

      // clear local form state to avoid leaking values into next new booking
      resetFormToDefaults();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Save failed", description: mapDatabaseError(err) });
    } finally {
      setLoading(false);
    }
  };

  const addBulkDate = () => setBulkDates([...bulkDates, { start: "", end: "" }]);
  const removeBulkDate = (i: number) => setBulkDates(bulkDates.filter((_, idx) => idx !== i));
  const updateBulkDate = (i: number, field: "start" | "end", val: string) => {
    const newDates = [...bulkDates];
    newDates[i][field] = val;
    setBulkDates(newDates);
  };

  const addBulkTime = () => setBulkTimes([...bulkTimes, { start: "", end: "" }]);
  const removeBulkTime = (i: number) => setBulkTimes(bulkTimes.filter((_, idx) => idx !== i));
  const updateBulkTime = (i: number, field: "start" | "end", val: string) => {
    const newTimes = [...bulkTimes];
    newTimes[i][field] = val;
    setBulkTimes(newTimes);
  };

  const toggleBulkRoom = (rId: string) => {
    setBulkRoomIds(prev => prev.includes(rId) ? prev.filter(id => id !== rId) : [...prev, rId]);
  };

  const handleBulkSave = async (state: "Active" | "Reserved" | "Ended") => {
    const newErrors: Record<string, boolean> = {};
    
    // Validation
    if (bulkRoomIds.length === 0) {
        newErrors.bulkRooms = true;
    }
    
    // Filter out empty ranges
    const validDates = bulkDates.filter(d => d.start && d.end);
    const validTimes = bulkTimes.filter(t => t.start && t.end);

    if (validDates.length === 0) {
        newErrors.bulkDates = true;
    }
    if (validTimes.length === 0) {
        newErrors.bulkTimes = true;
    }

    // Course validation
    if (!selectedCourseId) {
        newErrors.selectedCourseId = true;
    }
    if (selectedCourseId === "other" && !otherCourseName?.trim()) {
        newErrors.otherCourseName = true;
    }

    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
        return;
    }

    setLoading(true);
    try {
        const bookingsToInsert: any[] = [];

        for (const dateRange of validDates) {
            const startD = parseISO(dateRange.start);
            const endD = parseISO(dateRange.end);
            
            if (isBefore(endD, startD)) {
                 toast({ title: "Invalid date range", description: `End date ${dateRange.end} is before start date ${dateRange.start}` });
                 setLoading(false);
                 return;
            }

            const days = eachDayOfInterval({ start: startD, end: endD });

            for (const day of days) {
                const dayStr = format(day, "yyyy-MM-dd");
                
                for (const timeRange of validTimes) {
                    const tStart = timeRange.start;
                    const tEnd = timeRange.end;
                    
                    if (!tStart || !tEnd || tStart >= tEnd) {
                         continue; 
                    }

                    for (const rId of bulkRoomIds) {
                        const payload: any = {
                            room_id: parseInt(rId, 10),
                            start_time: tStart + ":00",
                            end_time: tEnd + ":00",
                            booking_day: dayStr,
                            student_numbers: null,
                            borrowed_items: [],
                            booked_by: null,
                            state: state,
                        };

                        if (selectedCourseId && selectedCourseId !== "other") {
                            payload.course_id = parseInt(selectedCourseId, 10);
                            payload.course_name = null;
                        } else if (selectedCourseId === "other") {
                            payload.course_id = null;
                            payload.course_name = otherCourseName || null;
                        } else {
                            payload.course_id = null;
                            payload.course_name = null;
                        }
                        
                        bookingsToInsert.push(payload);
                    }
                }
            }
        }

        if (bookingsToInsert.length === 0) {
             toast({ title: "No bookings generated", description: "Check your ranges." });
             return;
        }

        const { error } = await supabase.from("bookings").insert(bookingsToInsert);
        if (error) throw error;
        
        toast({ title: "Saved", description: `${bookingsToInsert.length} bookings created` });
        resetFormToDefaults();
        onClose();

    } catch (err: any) {
        console.error(err);
        toast({ title: "Save failed", description: mapDatabaseError(err) });
    } finally {
        setLoading(false);
    }
  };

  const resetFormToDefaults = () => {
    setRoomId("");
    setStartDate(() => format(new Date(), "yyyy-MM-dd"));
    const nowInit = new Date();
    nowInit.setMinutes(Math.round(nowInit.getMinutes() / 30) * 30);
    setStartClock(format(nowInit, "HH:mm"));
    setDuration("30");
    setStaffName(defaultStaffName);
    setStudentNumbers("");
    setSelectedCourseId("");
    setOtherCourseName("");
    setSelectedBorrowed({});
    setBorrowableItems([]);
    setSelectedState("Active");
    setIsBulkBooking(false);
    setBulkDates([{ start: "", end: "" }]);
    setBulkTimes([{ start: "", end: "" }]);
    setBulkRoomIds([]);
    setErrors({});
  };

  const handleDelete = async () => {
    if (!prefill?.booking?.id) return;
    const ok = await confirm({
      title: "Delete Booking",
      description: "Delete this booking? This action cannot be undone.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', prefill.booking.id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Booking has been deleted.' });
      onClose();
    } catch (err: any) {
      console.error('Delete failed', err);
      toast({ title: 'Delete failed', description: err?.message || 'Unable to delete booking' });
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = (mins: number) => {
    const currentDur = parseInt(duration, 10);
    if (isNaN(currentDur)) return;
    const newDur = currentDur + mins;
    setDuration(String(newDur));
    toast({ title: "Duration extended", description: `Added ${mins} minutes. Click Update to save.` });
  };

  const getRoomStatus = (rId: string) => {
    if (!startClock || !startDate) return null;
    
    // Check if selected date is today
    const isToday = format(currentTime, "yyyy-MM-dd") === startDate;
    
    const [h, m] = startClock.split(':').map(Number);
    const selectedTimeMins = h * 60 + m;

    // 1. Check for Overdue (Any active booking ended before now) - Only if today
    if (isToday) {
        const overdueBooking = dayBookings.find(b => {
            if (String(b.room_id) !== String(rId)) return false;
            if (b.state !== 'Active') return false;
            const endDate = new Date(`${b.booking_day}T${b.end_time}`);
            return currentTime > endDate;
        });

        if (overdueBooking) {
             const endDate = new Date(`${overdueBooking.booking_day}T${overdueBooking.end_time}`);
             const diff = Math.floor((currentTime.getTime() - endDate.getTime()) / 60000);
             return { color: 'text-red-500', text: `Overdue ${diff} min` };
        }
    }

    // 2. Check for Overlapping booking
    const overlappingBooking = dayBookings.find(b => {
        if (String(b.room_id) !== String(rId)) return false;
        // If editing, skip the current booking
        if (prefill?.booking && String(b.id) === String(prefill.booking.id)) return false;

        const [sh, sm] = b.start_time.split(':').map(Number);
        const [eh, em] = b.end_time.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        return startMins <= selectedTimeMins && endMins > selectedTimeMins;
    });

    if (overlappingBooking) {
        if (overlappingBooking.state === 'Active') {
             return { color: 'text-red-500', text: 'Occupied' };
        }
        // Check if Late
        if (isToday && overlappingBooking.state === 'Reserved') {
             const startDateObj = new Date(`${overlappingBooking.booking_day}T${overlappingBooking.start_time}`);
             const lateThreshold = new Date(startDateObj.getTime() + 10 * 60000);
             if (currentTime > lateThreshold) {
                 const diff = Math.floor((currentTime.getTime() - startDateObj.getTime()) / 60000);
                 return { color: 'text-orange-500', text: `${diff} min late` };
             }
             return { color: 'text-yellow-600', text: 'Reserved' };
        }
        if (overlappingBooking.state === 'Reserved') {
             return { color: 'text-yellow-600', text: 'Reserved' };
        }
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border-none p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
        <div className="flex flex-col h-full">
          <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/5">
             <h2 className="text-lg font-semibold">
                {prefill?.booking ? "Edit Booking" : "New Booking"}
             </h2>
             {!prefill?.booking && (
               <div className="flex items-center gap-2 mr-8">
                 <Label htmlFor="bulk-mode" className="text-sm cursor-pointer">Bulk Mode</Label>
                 <Switch id="bulk-mode" checked={isBulkBooking} onCheckedChange={setIsBulkBooking} />
               </div>
             )}
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
            {isBulkBooking ? (
              <div className="space-y-6">
                {/* Date Ranges */}
                <div>
                    <div className={cn("text-sm font-medium mb-2", errors.bulkDates && "text-destructive")}>Date Ranges</div>
                    {bulkDates.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 mb-2">
                            <Input type="date" value={d.start} onChange={e => updateBulkDate(i, 'start', e.target.value)} className={cn(errors.bulkDates && !d.start && "border-destructive")} />
                            <span>to</span>
                            <Input type="date" value={d.end} onChange={e => updateBulkDate(i, 'end', e.target.value)} className={cn(errors.bulkDates && !d.end && "border-destructive")} />
                            <Button variant="ghost" size="icon" onClick={() => removeBulkDate(i)} disabled={bulkDates.length === 1}>✕</Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addBulkDate}>Add Date Range</Button>
                </div>

                {/* Time Ranges */}
                <div>
                    <div className={cn("text-sm font-medium mb-2", errors.bulkTimes && "text-destructive")}>Time Ranges</div>
                    {bulkTimes.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 mb-2">
                            <TimeInput value={t.start} onChange={(val: any) => updateBulkTime(i, 'start', String(val))} className={cn(errors.bulkTimes && !t.start && "border-destructive")} />
                            <span>to</span>
                            <TimeInput value={t.end} onChange={(val: any) => updateBulkTime(i, 'end', String(val))} className={cn(errors.bulkTimes && !t.end && "border-destructive")} />
                            <Button variant="ghost" size="icon" onClick={() => removeBulkTime(i)} disabled={bulkTimes.length === 1}>✕</Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addBulkTime}>Add Time Range</Button>
                </div>

                {/* Rooms */}
                <div>
                    <div className={cn("text-sm font-medium mb-2", errors.bulkRooms && "text-destructive")}>Rooms</div>
                    <div className={cn("border rounded p-2 max-h-40 overflow-y-auto grid grid-cols-2 gap-2", errors.bulkRooms && "border-destructive")}>
                        {rooms.map(r => (
                            <div key={r.id} className="flex items-center gap-2">
                                <Checkbox id={`room-${r.id}`} checked={bulkRoomIds.includes(String(r.id))} onCheckedChange={() => toggleBulkRoom(String(r.id))} />
                                <Label htmlFor={`room-${r.id}`} className="cursor-pointer">{r.name}</Label>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Course */}
                <div className="space-y-2">
                  <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                    <SelectTrigger id="course-bulk" className={cn(errors.selectedCourseId && "border-destructive")}><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedCourseId === "other" && (
                    <Input placeholder="Course name" value={otherCourseName} onChange={(e) => setOtherCourseName(e.target.value)} className={cn(errors.otherCourseName && "border-destructive")} />
                  )}
                </div>
              </div>
            ) : (
            <>
            <div className="space-y-2">
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger id="room" className={cn(errors.roomId && "border-destructive")}>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent className="min-w-[300px]">
                  {rooms
                    .map((r) => ({ r, status: getRoomStatus(String(r.id)) }))
                    .filter(({ r, status }) => {
                        // Always show the currently selected room
                        if (String(r.id) === String(roomId)) return true;

                        // Hide Occupied (Active) and Reserved (unless Late)
                        if (status?.text === 'Occupied') return false;
                        if (status?.text === 'Reserved') return false;
                        return true;
                    })
                    .map(({ r, status }) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className={status?.color}>{r.name}</span>
                          {status?.text && <span className={`text-xs ${status.color} whitespace-nowrap`}>{status.text}</span>}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="space-y-2">
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={cn(errors.startDate && "border-destructive")} />
              </div>
              <div className="space-y-2">
                <TimeInput id="startClock" value={startClock} onChange={(val: any) => setStartClock(String(val))} className={cn(errors.startClock && "border-destructive")} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="space-y-2">
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger id="duration" className={cn(errors.duration && "border-destructive")}>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDurationOptions.length === 0 ? (
                      <SelectItem value="none" disabled>No times available</SelectItem>
                    ) : (
                      availableDurationOptions.map((d) => (
                        <SelectItem key={d} value={String(d)}>{d} mins</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Input id="staffName" value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="Staff Name" className={cn(errors.staffName && "border-destructive")} />
              </div>
            </div>

            <div className="space-y-2 mt-3">
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger id="course" className={cn(errors.selectedCourseId && "border-destructive")}><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {selectedCourseId === "other" && (
                <Input placeholder="Course name" value={otherCourseName} onChange={(e) => setOtherCourseName(e.target.value)} className={cn(errors.otherCourseName && "border-destructive")} />
              )}
            </div>

            <div className="space-y-2 mt-3">
              <Textarea id="studentNumbers" value={studentNumbers} onChange={(e) => setStudentNumbers(e.target.value)} rows={4} placeholder="Student Numbers" />
            </div>

            <div className="space-y-2 mt-3">
              <div className="text-sm font-medium mb-2">Borrowed items</div>
              <div className="grid grid-cols-2 gap-2">
                {borrowableItems.length === 0 && <div className="text-sm text-muted-foreground">No borrowable items for this room</div>}
                {borrowableItems.map((it) => (
                  <label key={it} className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={!!selectedBorrowed[it]} onChange={() => toggleBorrowed(it)} />
                    <span className="text-sm">{it}</span>
                  </label>
                ))}
              </div>
            </div>
            </>
            )}
          </div>

          <div className="px-6 py-4 bg-muted/5 flex flex-wrap gap-2 items-center justify-end border-t">
            {prefill?.booking ? (
              <>
                {availableExtensionOptions.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="mr-2">Extend</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-40 p-2" align="end">
                      <div className="grid gap-2">
                        <h4 className="font-medium leading-none mb-1">Extend by</h4>
                        <div className="grid gap-1">
                          {availableExtensionOptions.map((mins) => (
                            <Button key={mins} size="sm" variant="ghost" className="justify-start font-normal" onClick={() => handleExtend(mins)}>
                              +{mins} mins
                            </Button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <div className="flex items-center gap-2 mr-2">
                  <Select value={selectedState} onValueChange={(v: any) => setSelectedState(v)}>
                    <SelectTrigger className="min-w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Reserved">Reserved</SelectItem>
                      <SelectItem value="Ended">Ended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="destructive" onClick={handleDelete} disabled={loading}>Delete</Button>
                  <Button onClick={() => handleSave(selectedState)} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}</Button>
                </div>
              </>
            ) : (
              <>
                <Button onClick={() => handleSave("Reserved")} disabled={loading} variant="secondary">Reserve</Button>
                <Button onClick={() => handleSave("Active")} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Book-in (Active)"}</Button>
              </>
            )}
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingPanel;
