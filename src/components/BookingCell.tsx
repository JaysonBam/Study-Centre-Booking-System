import { format, parseISO } from "date-fns";
import { useState, useRef } from "react";
import { useNow } from "@/context/NowContext";
import { cn, getTextColorForBackground, roundToNearest30, roundUpToNearest30 } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

interface BookingCellProps {
  booking?: Booking;
  roomId: string;
  timeSlot: Date;
  onCellClick: (roomId: string, timeSlot: string) => void;
  onBookingClick: (booking: Booking) => void;
  compact?: boolean;
  isNowRow?: boolean;
}

export const BookingCell = ({
  booking,
  roomId,
  timeSlot,
  onCellClick,
  onBookingClick,
  compact = false,
  isNowRow = false,
}: BookingCellProps) => {
  const { getNow } = useNow();
  const [showQuick, setShowQuick] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const hoverTimeout = useRef<number | null>(null);

  const clearHover = () => {
    if (hoverTimeout.current) {
      window.clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearHover();
    hoverTimeout.current = window.setTimeout(() => setShowQuick(true), 500);
  };

  const handleMouseLeave = () => {
    clearHover();
    setShowQuick(false);
  };

  const handleEndQuick = async () => {
    setActionLoading(true);
    try {
      const now = roundToNearest30(getNow());
      const currentEnd = parseISO(booking!.end_time);
      const newEnd = now > currentEnd ? currentEnd : now;
      const { error } = await supabase
        .from("bookings")
        .update({ end_time: newEnd.toISOString(), status: "ended" })
        .eq("id", booking!.id);
      if (error) throw error;
      toast.success("Booking ended");
      setShowQuick(false);
    } catch (err) {
      console.error(err);
      toast.error("Unable to end booking");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartQuick = async () => {
    setActionLoading(true);
    try {
      const now = roundUpToNearest30(getNow());
      const originalEnd = parseISO(booking!.end_time);
      let newEnd = originalEnd;
      if (getNow() < originalEnd) newEnd = roundToNearest30(originalEnd);

      const { error } = await supabase
        .from("bookings")
        .update({ status: "active", end_time: newEnd.toISOString() })
        .eq("id", booking!.id);
      if (error) throw error;
      toast.success("Booking started");
      setShowQuick(false);
    } catch (err) {
      console.error(err);
      toast.error("Unable to start booking");
    } finally {
      setActionLoading(false);
    }
  };
  if (!booking) {
    return (
      <td
        className={cn(
          "border border-grid-border p-2 cursor-pointer hover:bg-grid-cell-hover",
          // If this row corresponds to now, highlight the empty cell background
          isNowRow ? "bg-sky-100" : "bg-grid-cell"
        )}
        onClick={() => onCellClick(roomId, timeSlot.toISOString())}
      />
    );
  }

  const isFirstCell = format(parseISO(booking.start_time), "HH:mm") === format(timeSlot, "HH:mm");
  
  if (!isFirstCell) {
    return null;
  }

  const startTime = parseISO(booking.start_time);
  const endTime = parseISO(booking.end_time);
  const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  const rowSpan = durationMinutes / 30;

  const isActive = booking.status === "active";
  const isReserved = booking.status === "reserved";
  const opacity = isReserved ? "opacity-40" : "";
  const statusStyle = booking.status === "overdue" ? "border-2 border-destructive" : "";

  const textColorClass = getTextColorForBackground(booking.disciplines.color_hex);
  const statusLabel = booking.status ? booking.status.toUpperCase() : "";
  const statusDotClass = booking.status === "active"
    ? "bg-green-600"
    : booking.status === "reserved"
    ? "bg-amber-400"
    : booking.status === "ended"
    ? "bg-gray-400"
    : booking.status === "overdue"
    ? "bg-red-600"
    : "bg-gray-300";

  return (
    <td
      rowSpan={rowSpan}
    className={cn(
      "relative border border-grid-border cursor-pointer z-0",
        compact ? "p-1 text-xs" : "p-2",
        "hover:brightness-90 transition-all",
        statusStyle,
        opacity,
        textColorClass
      )}
      style={{ backgroundColor: booking.disciplines.color_hex }}
  onClick={() => onBookingClick(booking)}
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
      tabIndex={0}
    >
      {showQuick && (
        <div className="absolute right-2 top-2 z-10">
          <div
            className={cn("rounded-lg shadow-lg p-2 flex gap-2 items-center text-sm", textColorClass)}
            style={{ backgroundColor: booking.disciplines.color_hex, border: `1px solid ${booking.disciplines.color_hex}` }}
          >
            {booking.status === "reserved" && (
              <button
                onClick={(e) => { e.stopPropagation(); handleStartQuick(); }}
                disabled={actionLoading}
                className={cn(
                  "px-3 py-1.5 rounded font-semibold text-sm shadow-md",
                  "bg-amber-500 hover:bg-amber-600 text-white",
                )}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start"}
              </button>
            )}
            {(booking.status === "active" || booking.status === "overdue") && (
              <button
                onClick={(e) => { e.stopPropagation(); handleEndQuick(); }}
                disabled={actionLoading}
                className={cn(
                  "px-3 py-1.5 rounded font-semibold text-sm shadow-md",
                  "bg-red-600 hover:bg-red-700 text-white",
                )}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "End"}
              </button>
            )}
          </div>
        </div>
      )}
  <div className={`absolute top-1 right-1 z-10 w-3 h-3 rounded-full ${statusDotClass}`} aria-hidden="true" />
      <span className="sr-only">{statusLabel}</span>

      {compact ? (
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold">{booking.disciplines.name}</div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">{format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}</div>
          </div>
          <div className="text-xs mt-1">{booking.staff_name}</div>
          <div className="text-xs opacity-90">{booking.disciplines.name}</div>
        </>
      )}
    </td>
  );
};

export default BookingCell;
