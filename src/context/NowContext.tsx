import React, { createContext, useContext, useState, useEffect } from "react";
import timeLib from "@/lib/time";

interface NowContextShape {
  nowDate: string;
  nowTime: string;
  setNowDate: (d: string) => void;
  setNowTime: (t: string) => void;
  currentTime: Date;
  useRealTime: boolean;
  setUseRealTime: (v: boolean) => void;
}

const NowContext = createContext<NowContextShape | null>(null);

export const NowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [nowDate, setNowDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [nowTime, setNowTime] = useState<string>(() => new Date().toTimeString().slice(0,5));
  const [useRealTime, setUseRealTime] = useState<boolean>(true);

  useEffect(() => {
    const updateTime = async () => {
      if (useRealTime) {
        try {
          const t = await timeLib.getTime();
          setCurrentTime(t);
        } catch (e) {
          setCurrentTime(new Date());
        }
      } else {
        try {
          const d = new Date(`${nowDate}T${nowTime}`);
          if (!isNaN(d.getTime())) {
             setCurrentTime(d);
          }
        } catch (e) {
          // ignore
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [useRealTime, nowDate, nowTime]);

  return (
    <NowContext.Provider value={{ nowDate, nowTime, setNowDate, setNowTime, currentTime, useRealTime, setUseRealTime }}>
      {children}
    </NowContext.Provider>
  );
};

export const useNow = () => {
  const ctx = useContext(NowContext);
  if (!ctx) {
    throw new Error("useNow must be used within NowProvider");
  }
  return ctx;
};

export default NowProvider;
