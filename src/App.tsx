import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Bookings from "./pages/Bookings";
import Settings from "./pages/Settings";
import Analytics from "./pages/Analytics";
import Authorization from "./pages/Authorization";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { supabase } from "./lib/supabaseClient";

const queryClient = new QueryClient();

const RootRedirect = () => {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Check current session once on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setHasSession(!!session);
      setChecking(false);
    }).catch(() => {
      if (!mounted) return;
      setHasSession(false);
      setChecking(false);
    });

    return () => { mounted = false };
  }, []);

  if (checking) return null; // or a loader
  return <Navigate to={hasSession ? "/bookings" : "/login"} replace />;
};

const Protected = ({ children }: { children: JSX.Element }) => {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setHasSession(!!session);
      setChecking(false);
    }).catch(() => {
      if (!mounted) return;
      setHasSession(false);
      setChecking(false);
    });
    return () => { mounted = false };
  }, []);

  if (checking) return null;
  return hasSession ? children : <Navigate to="/login" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
            <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/bookings" element={<Protected><Bookings /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
            <Route path="/authorization" element={<Protected><Authorization /></Protected>} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
