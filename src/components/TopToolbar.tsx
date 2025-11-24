import React from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, LogOut, Settings, Minimize2, Maximize2 } from "lucide-react";
import { useCompactToolbar } from "@/context/CompactToolbarContext";
import { useNow } from "@/context/NowContext";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { TimeInput } from "@/components/ui/time-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/lib/supabaseClient";

interface TopToolbarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onBookNow: () => void;
  onAdminClick?: () => void;
}

export const TopToolbar = ({
  selectedDate,
  onDateChange,
  onBookNow,
  onAdminClick,
}: TopToolbarProps) => {
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore
    }
  };

  const { compact, setCompact } = useCompactToolbar();
  const toggleCompact = () => setCompact(!compact);

  const handleToday = () => {
    onDateChange(new Date());
    const now = new Date();
    setTempNowDate(format(now, "yyyy-MM-dd"));
    setTempNowTime(format(now, "HH:mm"));
    setNowDate(format(now, "yyyy-MM-dd"));
    setNowTime(format(now, "HH:mm"));
  };

  const { nowDate, nowTime, setNowDate, setNowTime, useRealTime } = useNow();

  const [tempNowDate, setTempNowDate] = React.useState<string>(nowDate);
  const [tempNowTime, setTempNowTime] = React.useState<string>(nowTime);

  React.useEffect(() => {
    setTempNowDate(nowDate);
    setTempNowTime(nowTime);
  }, [nowDate, nowTime]);

  const applyNow = () => {
    setNowDate(tempNowDate);
    setNowTime(tempNowTime);
  };

  const cancelNowEdit = () => {
    setTempNowDate(nowDate);
    setTempNowTime(nowTime);
  };

  return (
    <div className="sticky top-0 z-40 backdrop-blur bg-card/95 border-b border-border shadow-sm">
      <div className={`max-w-full mx-auto flex items-center justify-between ${compact ? "px-2 py-1" : "px-3 py-2"}`}>
        <div className={`flex items-center ${compact ? "gap-1" : "gap-2"}`}>
          <img
            src="/logo.svg"
            alt="Centre logo"
            className={`${compact ? "h-8" : "h-12"} w-auto ${compact ? "" : "mr-1"}`}
          />
          <h1 className={`${compact ? "sr-only" : "text-lg font-semibold"}`}>MISC Bookings</h1>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={`${compact ? "py-1 px-1 text-sm" : "gap-2 py-1 px-2 text-sm"}`}>
                <CalendarIcon className="h-4 w-4" />
                {!compact && format(selectedDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && onDateChange(date)}
              />
            </PopoverContent>
          </Popover>

          <Button onClick={handleToday} variant="outline" className={`${compact ? "py-1 px-1 text-xs" : "py-1 px-2 text-sm"}`}>
            TODAY
          </Button>
          {!useRealTime && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={tempNowDate}
                onChange={(e) => setTempNowDate(e.target.value)}
                className="rounded border px-2 py-1 text-sm"
                title="Override 'now' date (temp)"
              />
              <TimeInput value={tempNowTime} onChange={(val: any) => setTempNowTime(String(val))} className="rounded border px-2 py-1 text-sm w-28" />
              <Button onClick={applyNow} variant="outline" size="sm">Apply</Button>
              <Button onClick={cancelNowEdit} variant="ghost" size="sm">Cancel</Button>
            </div>
          )}
          <Button onClick={onBookNow} className={`${compact ? "py-1 px-1 text-xs" : "gap-2 py-1 px-2 text-sm"}`}>
            {compact ? "BOOK" : "BOOK NOW"}
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button onClick={toggleCompact} variant="outline" size="icon" title="Toggle compact toolbar">
            {compact ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>

          {onAdminClick && (
            <Button onClick={onAdminClick} variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={signOut} variant="outline" size="icon">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TopToolbar;
