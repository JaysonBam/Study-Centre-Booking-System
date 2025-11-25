import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBookingSoftState(booking: any, now: Date): 'late' | 'overdue' | null {
  if (!booking) return null;
  
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  
  // Late: Reserved and now > start + 10 mins
  if (booking.state === 'Reserved') {
    const lateThreshold = new Date(start.getTime() + 10 * 60000);
    if (now > lateThreshold) {
      return 'late';
    }
  }
  
  // Overdue: Active and now > end
  if (booking.state === 'Active') {
    if (now > end) {
      return 'overdue';
    }
  }
  
  return null;
}