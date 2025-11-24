import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "./button";
import { useUserFlags } from "@/hooks/useUserFlags";

export const Hamburger: React.FC = () => {
  const navigate = useNavigate();
  const { flags, loading } = useUserFlags();
  const [open, setOpen] = useState(false);

  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    setOpen(false);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Sign out failed", e);
    }
    navigate("/login");
  };

  const showSettings = !!flags?.settings;
  const showAuthorization = !!flags?.authorisation;
  const showAnalytics = !!flags?.analytics;

  return (
    <div className="relative inline-block text-left">
      <Button variant="ghost" size="icon" onClick={() => setOpen((s) => !s)} aria-expanded={open} aria-label="Open menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-current">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>

      {open && (
        <div className="origin-top-right absolute left-0 mt-2 w-44 rounded-md shadow-lg bg-white ring-1 ring-black/5 z-[100]">
          <div className="py-1">
            <Button variant="ghost" className="w-full justify-start rounded-none h-auto px-4 py-2 font-normal" onClick={() => handleNavigate("/bookings")}>Bookings</Button>
            {!loading && showSettings && (
              <Button variant="ghost" className="w-full justify-start rounded-none h-auto px-4 py-2 font-normal" onClick={() => handleNavigate("/settings")}>Settings</Button>
            )}
            {!loading && showAuthorization && (
              <Button variant="ghost" className="w-full justify-start rounded-none h-auto px-4 py-2 font-normal" onClick={() => handleNavigate("/authorization")}>Authorization</Button>
            )}
            {!loading && showAnalytics && (
              <Button variant="ghost" className="w-full justify-start rounded-none h-auto px-4 py-2 font-normal" onClick={() => handleNavigate("/analytics")}>Analytics</Button>
            )}
            <div className="border-t my-1" />
            <Button variant="ghost" className="w-full justify-start rounded-none h-auto px-4 py-2 font-normal text-red-600 hover:text-red-600 hover:bg-red-50" onClick={handleSignOut}>Logout</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hamburger;
