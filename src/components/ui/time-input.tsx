import * as React from "react";
import { Input } from "@/components/ui/input";

type TimeInputProps = React.ComponentProps<typeof Input> & {
  value: string;
  onChange: (val: string) => void;
};

// Simple 24-hour time input that accepts and emits HH:mm strings.
export const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(({ value, onChange, ...props }, ref) => {
  const [internal, setInternal] = React.useState(value ?? "");

  React.useEffect(() => setInternal(value ?? ""), [value]);

  const normalize = (v: string) => {
    const m = v.match(/^(\d{1,2}):?(\d{0,2})$/);
    if (!m) return "";
    let hh = parseInt(m[1], 10);
    let mm = m[2] ? parseInt(m[2], 10) : 0;
    if (Number.isNaN(hh)) hh = 0;
    if (Number.isNaN(mm)) mm = 0;
    hh = Math.max(0, Math.min(23, hh));
    mm = Math.max(0, Math.min(59, mm));
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
  };

  return (
    <Input
      {...props}
      ref={ref}
      value={internal}
      onChange={(e) => {
        setInternal(e.target.value);
        // pass raw through; final normalization onBlur to avoid preventing typing
        onChange(e.target.value);
      }}
      onBlur={(e) => {
        const norm = normalize(e.target.value);
        setInternal(norm);
        onChange(norm);
      }}
      placeholder="HH:mm"
    />
  );
});
TimeInput.displayName = "TimeInput";
