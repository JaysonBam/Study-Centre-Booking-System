import React, { createContext, useContext, useState } from "react";

interface CompactContextShape {
  compact: boolean;
  setCompact: (v: boolean) => void;
}

const CompactContext = createContext<CompactContextShape | null>(null);

export const CompactToolbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [compact, setCompact] = useState<boolean>(false);
  return (
    <CompactContext.Provider value={{ compact, setCompact }}>
      {children}
    </CompactContext.Provider>
  );
};

export const useCompactToolbar = () => {
  const ctx = useContext(CompactContext);
  if (!ctx) {
    throw new Error("useCompactToolbar must be used within CompactToolbarProvider");
  }
  return ctx;
};

export default CompactToolbarProvider;
