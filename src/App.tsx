import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useUserFlags } from "./hooks/useUserFlags";
import Bookings from "./pages/Bookings";
import Settings from "./pages/Settings";
import Analytics from "./pages/Analytics";
import Authorization from "./pages/Authorization";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import RoomMaintenance from "./pages/RoomMaintenance";
import NotFound from "./pages/NotFound";
import { supabase } from "./lib/supabaseClient";
import { ConfirmDialogProvider } from "./context/ConfirmDialogContext";
import { NowProvider } from "./context/NowContext";

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



// Protected route that enforces per-user flags from the users row.
const ProtectedWithFlag = ({ children, requiredFlag }: { children: JSX.Element; requiredFlag?: "settings" | "authorisation" | "analytics" }) => {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const { flags, loading } = useUserFlags();

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

  if (checking || loading) return null;
  if (!hasSession) return <Navigate to="/login" replace />;
  if (!requiredFlag) return children;

  if (flags && flags[requiredFlag]) return children;
  return <Navigate to="/bookings" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <NowProvider>
        <ConfirmDialogProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
              <Routes>
              <Route path="/bookings" element={<ProtectedWithFlag><Bookings /></ProtectedWithFlag>} />
              <Route path="/room-maintenance" element={<ProtectedWithFlag><RoomMaintenance /></ProtectedWithFlag>} />
              <Route path="/settings" element={<ProtectedWithFlag requiredFlag="settings"><Settings /></ProtectedWithFlag>} />
              <Route path="/settings" element={<ProtectedWithFlag requiredFlag="settings"><Settings /></ProtectedWithFlag>} />
              <Route path="/analytics" element={<ProtectedWithFlag requiredFlag="analytics"><Analytics /></ProtectedWithFlag>} />
              <Route path="/authorization" element={<ProtectedWithFlag requiredFlag="authorisation"><Authorization /></ProtectedWithFlag>} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ConfirmDialogProvider>
      </NowProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
