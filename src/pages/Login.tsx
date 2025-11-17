import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if the users insession, direct to login if not
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Attempt sign-in first. After sign-in we'll validate the users row by UID
  const signInRes = await supabase.auth.signInWithPassword({ email, password });
  const signInError = (signInRes as any).error as any | null;
  if (signInError) throw signInError;

  // get uid from signed-in user (support both possible shapes)
  const signedInUser = (signInRes as any).data?.user ?? (signInRes as any).user ?? null;
  const uid = signedInUser?.id ?? null;
      if (!uid) {
        // unexpected - navigate home and hope for the best
        navigate("/");
        return;
      }

      // Now, as an authenticated user, check the users table for enabled flag
      try {
        const { data: row, error: rowError } = await supabase.from('users').select('enabled').eq('uid', uid).maybeSingle();
        if (rowError) {
          console.error('Failed to check users row after sign-in', rowError);
          // if we cannot check, conservatively allow the user (avoid locking out due to RLS)
          navigate('/');
          return;
        }

          if (!row || row.enabled === false) {
            // Sign out and show message (single-notify)
            await supabase.auth.signOut();
            try {
              // import-by-path to avoid circular import at top
              const { notifyAccessRemovedOnce } = await import('@/lib/supabaseClient');
              notifyAccessRemovedOnce(uid ?? undefined);
            } catch (e) {
              toast.error('Your account does not have access. Contact an administrator.');
            }
            setLoading(false);
            return;
          }

        // All good
        navigate('/');
        return;
      } catch (err) {
        console.error('Error while validating users row after sign-in', err);
        navigate('/');
        return;
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error("Please enter your email address to reset your password.");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      toast.success("If that account exists, a password reset email has been sent.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send password reset email.");
    }
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
  <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" />

  <Card className="w-full max-w-md relative z-10 bg-white text-black shadow-xl">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
          </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder=""
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder=""
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-black text-white hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors duration-150"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:underline"
                onClick={handleResetPassword}
              >
                Forgot password?
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
