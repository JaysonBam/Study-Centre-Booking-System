import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type UserMeta = { raw_app_meta_data?: Record<string, any> };

const Bookings = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserMeta | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const appMeta = (user as any)?.raw_app_meta_data ?? (user as any)?.app_metadata ?? {};
    const { settings, authorization, authorisation, analytics } = appMeta as Record<string, any>;

    const showSettings = !!settings;
    const showAuthorization = !!authorization || !!authorisation;
    const showAnalytics = !!analytics;

    useEffect(() => {
        let mounted = true;
        async function loadUser() {
            setLoadingUser(true);
            try {
                const { data, error } = await supabase.auth.getUser();
                if (error) throw error;
                const u = data?.user ?? null;
                if (mounted) setUser(u as unknown as UserMeta);
            } catch (err: any) {
                console.error("Failed to load user:", err?.message ?? err);
            } finally {
                if (mounted) setLoadingUser(false);
            }
        }

        loadUser();

        return () => { mounted = false;};
    }, []);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast.error(error.message || "Failed to sign out");
            return;
        }
        navigate("/login");
    };
        

    return (
        <main className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-semibold">Bookings</h1>
                <Button variant="ghost" onClick={handleLogout}>
                    Logout
                </Button>
            </div>

            <section className="mb-6">
                <div className="p-4 rounded-md bg-gray-50 text-gray-900">
                                {loadingUser ? (
                        <div>Loading user...</div>
                    ) : user ? (
                        <div className="space-y-2">
                            <div className="text-sm">App meta flags:</div>
                            <div className="flex gap-2 mt-2">
                                {showSettings && (
                                    <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>Settings</Button>
                                )}
                                {showAuthorization && (
                                    <Button variant="outline" size="sm" onClick={() => navigate("/authorization")}>Authorization</Button>
                                )}
                                {showAnalytics && (
                                    <Button variant="outline" size="sm" onClick={() => navigate("/analytics")}>Analytics</Button>
                                )}
                                {!showSettings && !showAuthorization && !showAnalytics && (
                                    <span className="text-xs text-muted-foreground">No app meta flags present</span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">Not signed in</div>
                    )}
                </div>
            </section>
        </main>
    );
};

export default Bookings;