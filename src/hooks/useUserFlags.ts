import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

type Flags = {
  settings?: boolean | null;
  authorisation?: boolean | null;
  analytics?: boolean | null;
};

type UserRow = {
  uid?: string;
  email?: string | null;
  name?: string | null;
} & Flags;

export function useUserFlags() {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id ?? null;
        if (!uid) {
          if (mounted) setUser(null);
          return;
        }

        const { data: row, error } = await supabase
          .from("users")
          .select("uid, email, name, settings, authorisation, analytics")
          .eq("uid", uid)
          .maybeSingle();

        if (error) {
          console.error("useUserFlags: failed to read users row", error);
          if (mounted) setUser(null);
          return;
        }

        if (!row) {
          // user no longer has a users row -> sign them out and redirect to login
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.warn("Failed to sign out missing user", e);
          }
          toast.error("Your account no longer has access. Contact an administrator.");
          // hard redirect to avoid rendering protected UI
          window.location.href = "/login";
          return;
        }

        if (mounted) setUser(row as UserRow);
      } catch (err) {
        console.error("useUserFlags failed:", err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      mounted = false;
      try {
        sub?.subscription?.unsubscribe();
      } catch {}
    };
  }, []);

  return { user, flags: user ? { settings: user.settings, authorisation: user.authorisation, analytics: user.analytics } : null, loading } as {
    user: UserRow | null;
    flags: Flags | null;
    loading: boolean;
  };
}
