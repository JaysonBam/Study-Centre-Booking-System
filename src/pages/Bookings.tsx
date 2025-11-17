import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { notifyAccessRemovedOnce } from "@/lib/supabaseClient";

type AppUserRow = {
    email?: string;
    name?: string;
    settings?: boolean;
    authorisation?: boolean;
    analytics?: boolean;
    enabled?: boolean;
};

const Bookings = () => {
    const navigate = useNavigate();
    const [userRow, setUserRow] = useState<AppUserRow | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const showSettings = !!userRow?.settings;
    const showAuthorization = !!userRow?.authorisation;
    const showAnalytics = !!userRow?.analytics;

    useEffect(() => {
        let mounted = true;
        async function loadUserRow() {
            setLoadingUser(true);
            try {
                const { data: authData, error: authError } = await supabase.auth.getUser();
                if (authError) throw authError;
                const uid = authData?.user?.id ?? null;
                if (!uid) {
                    if (mounted) setUserRow(null);
                    return;
                }

                const { data: row, error: rowError } = await supabase
                    .from('users')
                    .select('email, name, settings, authorisation, analytics, enabled')
                    .eq('uid', uid)
                    .maybeSingle();

                if (rowError) {
                    console.error('Failed to load users row:', rowError.message || rowError);
                }

                if (mounted) setUserRow(row ?? null);

                // If the user row is missing or explicitly disabled, sign them out and inform them.
                if (!row || row.enabled === false) {
                    await supabase.auth.signOut();
                    notifyAccessRemovedOnce(uid ?? undefined);
                    navigate('/login');
                }

            } catch (err: any) {
                console.error('Failed to load user:', err?.message ?? err);
            } finally {
                if (mounted) setLoadingUser(false);
            }
        }

        loadUserRow();

        return () => { mounted = false; };
    }, [navigate]);

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
                    ) : userRow ? (
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