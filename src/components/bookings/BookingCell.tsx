import React, { useState, useRef } from "react";
import { parseISO } from "date-fns";
import { Button } from "@/components/ui/button";

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
  onQuickAction?: (bookingId: string, action: 'activate' | 'end') => void;
  onHover?: (isHovering: boolean) => void;
  isCurrentRow?: boolean;
}

export const BookingCell: React.FC<BookingCellProps> = ({ booking, roomId, timeSlot, onCellClick, onBookingClick, onQuickAction, onHover, isCurrentRow }) => {
  const [showQuickAction, setShowQuickAction] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    onHover?.(true);
    if (!booking || booking.state === 'Ended') return;
    hoverTimeoutRef.current = setTimeout(() => {
      setShowQuickAction(true);
    }, 1000);
  };

  const handleMouseLeave = () => {
    onHover?.(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowQuickAction(false);
  };

  const handleQuickActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!booking || !onQuickAction) return;
    if (booking.state === 'Reserved') {
      onQuickAction(booking.id, 'activate');
    } else if (booking.state === 'Active') {
      onQuickAction(booking.id, 'end');
    }
    setShowQuickAction(false);
  };

  if (!booking) {
    return (
      <td
        className={`border border-grid-border p-1 cursor-pointer hover:bg-primary/20 ${isCurrentRow ? 'bg-accent/10' : 'bg-grid-cell'}`}
        onClick={() => onCellClick(roomId, timeSlot.toISOString())}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
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
      className={`relative border border-grid-border cursor-pointer p-0 ${textColorClass} ${stateClass} hover:brightness-90 transition-all`}
      onClick={() => onBookingClick(booking.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ backgroundColor: bgColor }}
    >
      <div className="h-full w-full rounded p-2 relative group">
        <div className="font-semibold text-sm">{booking.course?.name ?? booking.course_name ?? 'Course'}</div>
        <div className="text-xs opacity-90">{booking.booked_by}</div>
        
        {showQuickAction && onQuickAction && booking.state !== 'Ended' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] animate-in fade-in duration-200">
             <Button 
               size="sm" 
               variant={booking.state === 'Reserved' ? 'default' : 'destructive'}
               className="h-7 text-xs shadow-lg"
               onClick={handleQuickActionClick}
             >
               {booking.state === 'Reserved' ? 'Activate' : 'End'}
             </Button>
          </div>
        )}
      </div>
    </td>
  );
};

export default BookingCell;
