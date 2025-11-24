import React from "react";
import { parseISO } from "date-fns";

interface BookingCellProps {
  booking?: {
    id: string;
    room_id: string;
    start_time: string;
    end_time: string;
    title?: string;
    color?: string;
    state?: 'Active' | 'Reserved' | 'Ended';
    booked_by?: string;
  course_id?: number | null;
  course_name?: string | null;
    course?: {
      id: number;
      name: string;
      color_hex?: string | null;
    } | null;
    borrowed_items?: string[];
  } | null;
  roomId: string;
  timeSlot: Date;
  onCellClick: (roomId: string, timeSlotIso: string) => void;
  onBookingClick: (bookingId: string) => void;
}

export const BookingCell: React.FC<BookingCellProps> = ({ booking, roomId, timeSlot, onCellClick, onBookingClick }) => {
  if (!booking) {
    return (
      <td
        className="border border-grid-border p-1 cursor-pointer hover:bg-grid-cell-hover bg-grid-cell"
        onClick={() => onCellClick(roomId, timeSlot.toISOString())}
        role="button"
        tabIndex={0}
      />
    );
  }

  // Determine if this timeSlot is the start of the booking
  const start = parseISO(booking.start_time);
  const isStart = start.getHours() === timeSlot.getHours() && start.getMinutes() === timeSlot.getMinutes();
  if (!isStart) return null;

  const end = parseISO(booking.end_time);
  const durationMinutes = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000));
  const rowSpan = Math.max(1, Math.floor(durationMinutes / 30));

  // Determine background color from course color, or fallback to blue-gray
  const bgColor = booking.course?.color_hex ?? booking.color ?? "#64748b"; // slate-500 fallback

  // Decide text color based on background luminance for readability
  const getTextColorClass = (hex: string) => {
    try {
      const h = hex.replace('#','');
      const r = parseInt(h.substring(0,2),16)/255;
      const g = parseInt(h.substring(2,4),16)/255;
      const b = parseInt(h.substring(4,6),16)/255;
      const lum = 0.2126*r + 0.7152*g + 0.0722*b;
      return lum > 0.6 ? 'text-black' : 'text-white';
    } catch (e) {
      return 'text-white';
    }
  };

  const textColorClass = getTextColorClass(bgColor);

  const stateClass = booking.state === 'Ended' ? 'brightness-75' : booking.state === 'Reserved' ? 'opacity-60' : '';

  return (
    <td
      rowSpan={rowSpan}
      className={`relative border border-grid-border cursor-pointer p-0 ${textColorClass} ${stateClass}`}
      onClick={() => onBookingClick(booking.id)}
      style={{ backgroundColor: bgColor }}
    >
      <div className="h-full w-full rounded p-2">
        <div className="font-semibold text-sm">{booking.course?.name ?? booking.course_name ?? 'Course'}</div>
        <div className="text-xs opacity-90">{booking.booked_by}</div>
      </div>
    </td>
  );
};

export default BookingCell;
