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
        <div className="origin-top-right absolute left-0 mt-2 w-44 rounded-md shadow-lg bg-white ring-1 ring-black/5 z-50">
          <div className="py-1">
            <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100" onClick={() => handleNavigate("/bookings")}>Bookings</button>
            {!loading && showSettings && (
              <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100" onClick={() => handleNavigate("/settings")}>Settings</button>
            )}
            {!loading && showAuthorization && (
              <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100" onClick={() => handleNavigate("/authorization")}>Authorization</button>
            )}
            {!loading && showAnalytics && (
              <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100" onClick={() => handleNavigate("/analytics")}>Analytics</button>
            )}
            <div className="border-t my-1" />
            <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100" onClick={handleSignOut}>Logout</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hamburger;
