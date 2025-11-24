import React from "react";
import Hamburger from "@/components/ui/hamburger";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  selectedDate: Date;
  onDateChange: (d: Date) => void;
  onBook: () => void;
  onSearch: () => void;
};

export const TopToolbarSlim: React.FC<Props> = ({ selectedDate, onDateChange, onBook, onSearch }) => {
  const isoDate = selectedDate.toISOString().slice(0, 10);

  const setToday = () => {
    const now = new Date();
    onDateChange(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  };

  return (
    <div className="sticky top-0 z-40 bg-card/95 border-b border-border">
      <div className="max-w-6xl mx-auto flex items-center gap-3 px-3 py-2">
        <div className="flex items-center gap-2">
          <Hamburger />
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={isoDate}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const [y, m, d] = v.split("-").map((s) => Number(s));
              onDateChange(new Date(y, m - 1, d));
            }}
            className="h-8"
          />
          <button className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")} onClick={setToday}>Today</button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className={cn(buttonVariants({ variant: "default", size: "sm" }), "px-3 py-1")} onClick={onBook}>Book</button>
          <button className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-3 py-1")} onClick={onSearch}>Search</button>
        </div>
      </div>
    </div>
  );
};

export default TopToolbarSlim;
