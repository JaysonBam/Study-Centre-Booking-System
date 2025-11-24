import React, { createContext, useContext, useState, useCallback } from "react";

interface NowContextShape {
  nowDate: string;
  nowTime: string;
  setNowDate: (d: string) => void;
  setNowTime: (t: string) => void;
  getNow: () => Date;
  useRealTime: boolean;
  setUseRealTime: (v: boolean) => void;
}

const NowContext = createContext<NowContextShape | null>(null);

export const NowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const now = new Date();
  const [nowDate, setNowDate] = useState<string>(() => now.toISOString().slice(0, 10));
  const [nowTime, setNowTime] = useState<string>(() => now.toTimeString().slice(0,5));
  const [useRealTime, setUseRealTime] = useState<boolean>(true);

  const getNow = useCallback(() => {
    if (useRealTime) return new Date();
    // combine nowDate and nowTime
    try {
      return new Date(`${nowDate}T${nowTime}`);
    } catch (e) {
      return new Date();
    }
  }, [nowDate, nowTime, useRealTime]);

  return (
    <NowContext.Provider value={{ nowDate, nowTime, setNowDate, setNowTime, getNow, useRealTime, setUseRealTime }}>
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
