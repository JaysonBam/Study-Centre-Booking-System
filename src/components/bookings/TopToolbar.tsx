import React from "react";
import { Button } from "@/components/ui/button";
import Hamburger from "@/components/ui/hamburger";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

interface TopToolbarProps {
  selectedDate: Date;
  onDateChange: (d: Date) => void;
  onBookClick: () => void;
  onSearchClick?: () => void;
  currentUser?: string;
  onUserChange?: (name: string) => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({ selectedDate, onDateChange, onBookClick, onSearchClick, currentUser, onUserChange }) => {
  const handleToday = () => onDateChange(new Date());

  return (
    <div className="sticky top-0 z-[60] bg-card/95 border-b border-border shadow-sm">
      <div className="max-w-full mx-auto flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Hamburger />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <span className="hidden sm:inline">{format(selectedDate, "PPP")}</span>
                <span className="sm:hidden">{format(selectedDate, "MMM d")}</span>
              </Button>
            </PopoverTrigger>
            {/* Use the project's design tokens for popover background/foreground so it follows the colour scheme
                and only add padding/shadow for readability. Avoid forcing explicit white/black values. */}
            <PopoverContent className="w-auto p-2 bg-popover text-popover-foreground rounded shadow-lg" align="start">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && onDateChange(d)} />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" onClick={handleToday}>TODAY</Button>

          <Button onClick={onBookClick} variant="default" size="sm">BOOK</Button>
          <Button onClick={onSearchClick} variant="outline" size="sm">SEARCH</Button>
        </div>

        <div className="flex items-center gap-2">
            {onUserChange && (
                <Input 
                    className="h-8 w-[150px] or sm:w-[200px]" 
                    placeholder="Employee Name" 
                    value={currentUser || ""} 
                    onChange={(e) => onUserChange(e.target.value)} 
                />
            )}
        </div>
      </div>
    </div>
  );
};

export default TopToolbar;
