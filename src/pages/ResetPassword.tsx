import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

function parseHash(hash: string) {
  if (!hash) return {} as Record<string, string>;
  return Object.fromEntries(
    hash.replace(/^#/, "").split("&").map((part) => {
      const [k, v] = part.split("=");
      return [decodeURIComponent(k), decodeURIComponent(v)];
    }),
  );
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const tokens = parseHash(window.location.hash);
    if (tokens.access_token) {
      supabase.auth
        .setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        })
        .then(({ error }) => {
          if (error) {
            console.error("Failed to set session:", error);
            toast.error("Failed to set recovery session. Try the link again or request a new password reset.");
          } else {
            setHasSession(true);
            history.replaceState(null, "", window.location.pathname);
          }
        });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Please enter a password of at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated");
      navigate("/login");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("signOut on cancel failed", err);
    }
    setHasSession(false);
    navigate('/login');
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: "url('/login-bg.svg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />

      <Card className="w-full max-w-md relative z-10 bg-white text-black shadow-xl">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasSession && (
            <div className="p-2 mb-4 rounded bg-yellow-50 text-yellow-900">Check your email for the reset link. If it expired, request a new one.</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm">New password</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={loading || !hasSession}>
                {loading ? "Saving..." : "Set new password"}
              </Button>
              <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;