import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, setSuppressAuthListener } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type UserRow = {
  uid: string;
  email: string | null;
  name: string | null;
  settings: boolean | null;
  authorisation: boolean | null;
  analytics: boolean | null;
  created_at?: string | null;
  enabled: boolean | null;
};

const Authorization = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  // Load enabled users
  const loadUsers = async () => {
    setLoading(true);
    try {
      // get current auth user uid first
      const { data: meData } = await supabase.auth.getUser();
      const meUid = meData?.user?.id ?? null;
      setCurrentUid(meUid);
      const { data, error } = await supabase
        .from("users")
        .select("uid, email, name, settings, authorisation, analytics, enabled, created_at")
        .eq("enabled", true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const allUsers = (data as any) ?? [];
      // Separate the current user into its own row (top) and list others below
      if (meUid) {
        const meRow = allUsers.find((r: any) => r.uid === meUid) ?? null;
        const others = allUsers.filter((r: any) => r.uid !== meUid);
        setCurrentUser(meRow);
        setUsers(others);
      } else {
        setCurrentUser(null);
        setUsers(allUsers);
      }
    } catch (err: any) {
      console.error("Failed to load users:", err.message ?? err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Toggle a boolean column for a user
  const toggleFlag = async (uid: string, column: keyof Omit<UserRow, "uid" | "email" | "name" | "enabled">, value: boolean) => {
    if (uid === currentUid) {
      toast.error('You may not change your own access flags here');
      return;
    }
    try {
      const updates: any = {};
      updates[column] = value;
      // Request the updated row back so we can confirm the change (and surfacing errors from RLS)
      const { data, error } = await supabase.from('users').update(updates).eq('uid', uid).select();
      if (error) throw error;
      if (!data || (Array.isArray(data) && data.length === 0)) throw new Error('No rows updated (permission or missing row)');
      setUsers((prev) => prev.map(u => u.uid === uid ? { ...u, [column]: value } : u));
      toast.success('Updated');
    } catch (err: any) {
      console.error('Failed to update user flag', err?.message ?? err);
      toast.error(err?.message ?? 'Failed to update');
    }
  };

  // Disable (remove access) a user: set enabled=false and clear flags
  const disableUser = async (uid: string) => {
    if (uid === currentUid) {
      toast.error('You may not remove your own access');
      return;
    }
    const ok = confirm(
      `Disable this user?\n\nThey will lose access.\n\nThey can be re-enabled later by adding their email again.`
    );
    if (!ok) return;
    try {
      const { data, error } = await supabase.from('users').update({ enabled: false, settings: false, authorisation: false, analytics: false }).eq('uid', uid).select();
      if (error) throw error;
      if (!data || (Array.isArray(data) && data.length === 0)) throw new Error('No rows updated (permission or missing row)');
      setUsers((prev) => prev.filter(u => u.uid !== uid));
      toast.success('User disabled — can be re-enabled by adding their email again');
    } catch (err: any) {
      console.error('Failed to disable user', err?.message ?? err);
      toast.error(err?.message ?? 'Failed to remove access');
    }
  };

  // Add a user. Default password 'MISC'. If a users row exists but disabled, enable it instead of creating auth.
  const handleAddUser = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const email = newEmail.trim();
    const name = newName.trim() || null;
    if (!email) {
      toast.error('Enter an email');
      return;
    }
    setAdding(true);
    try {
      // Check if there's a users row with this email
      const { data: existingRows, error: selectErr } = await supabase.from('users').select('uid, enabled').eq('email', email).limit(1).maybeSingle();
      if (selectErr) throw selectErr;

      // If exists and disabled -> enable it (do not create auth user)
      if (existingRows && (existingRows as any).enabled === false) {
        const uid = (existingRows as any).uid as string;
        const { data: reenabled, error: updErr } = await supabase.from('users').update({ enabled: true, name }).eq('uid', uid).select();
        if (updErr) throw updErr;
        if (!reenabled || (Array.isArray(reenabled) && reenabled.length === 0)) throw new Error('Failed to re-enable (permission or missing row)');
        toast.success('User re-enabled');
        await loadUsers();
        setNewEmail(''); setNewName('');
        return;
      }

  // Preserve current session so creating a new user doesn't sign us out.
  const { data } = await supabase.auth.getSession();
  const sessionBefore = (data as any)?.session ?? null;
  const prevAccess = sessionBefore?.access_token ?? null;
  const prevRefresh = sessionBefore?.refresh_token ?? null;

      // Otherwise create auth user with default password (>=6 chars). If password policy fails, retry with longer password.
      let password = 'MISC123';
      let signData: any = null;
      let signErr: any = null;
      try {
        // Temporarily suppress global auth-state validation so the signUp side-effect
        // (which signs in the new user) doesn't trigger a sign-out or affect the admin session.
        setSuppressAuthListener(true);
        const res = await supabase.auth.signUp({ email, password });
        setSuppressAuthListener(false);
        signData = res.data ?? res;
        signErr = res.error ?? null;
        if (signErr) throw signErr;
      } catch (err: any) {
        // Ensure suppression is cleared on error as well
        try { setSuppressAuthListener(false); } catch {}
        const msg = err?.message ?? String(err);
        console.warn('Sign up error, will attempt fallback or continue to create users row if possible:', msg);
        signErr = err;
        if (msg && msg.toLowerCase().includes('password') && password.length < 8) {
          // retry with a stronger password
          password = 'MISC1234';
          try {
            setSuppressAuthListener(true);
            const res2 = await supabase.auth.signUp({ email, password });
            setSuppressAuthListener(false);
            signData = res2.data ?? res2;
            signErr = res2.error ?? null;
            if (signErr) console.warn('Second signUp attempt also returned error:', signErr.message ?? signErr);
          } catch (err2: any) {
            try { setSuppressAuthListener(false); } catch {}
            console.warn('Second signUp attempt failed:', err2?.message ?? err2);
            signErr = err2;
          }
        }
      }

      // If signUp created a session for the new user, restore the previous session so the admin stays logged in.
      try {
        if (prevAccess || prevRefresh) {
          // setSession expects the tokens; restore the admin session if possible
          await supabase.auth.setSession({ access_token: prevAccess, refresh_token: prevRefresh });
        }
      } catch (restoreErr) {
        console.warn('Failed to restore previous session after signUp:', restoreErr);
      }

      // Get uid: if signData.user?.id exists use it, otherwise attempt to find by email in auth via users table insert returning uid from auth? We'll optimistically try to find the created auth user by calling getUser
      let uid: string | null = (signData as any)?.user?.id ?? null;
      if (!uid) {
        // try to locate a users row with this email (maybe created earlier) and use its uid
        try {
          const { data: found, error: findErr } = await supabase.from('users').select('uid').eq('email', email).limit(1).maybeSingle();
          if (!findErr && found) uid = (found as any).uid ?? null;
        } catch (e) {
          // ignore
        }
      }

      // Insert into users table. If uid present, include it, otherwise insert without uid (if your DB requires uid, this may fail)
      const insertRow: any = { email, name, settings: false, authorisation: false, analytics: false, enabled: true };
      if (uid) insertRow.uid = uid;

      let insData: any = null;
      let insErr: any = null;
      if (uid) {
        // If we have an auth uid, use upsert on uid to avoid unique-constraint errors.
        const res = await supabase.from('users').upsert(insertRow, { onConflict: 'uid' }).select();
        insData = res.data ?? null;
        insErr = res.error ?? null;
      } else {
        const res = await supabase.from('users').insert(insertRow).select();
        insData = res.data ?? null;
        insErr = res.error ?? null;
      }
      if (insErr) throw insErr;
      if (!insData || (Array.isArray(insData) && insData.length === 0)) throw new Error('Insert did not return row (permission issue)');

      toast.success('User created and added to users table');
      setNewEmail(''); setNewName('');
      await loadUsers();
    } catch (err: any) {
      console.error('Failed to add user', err?.message ?? err);
      toast.error('Failed to add user');
    } finally {
      setAdding(false);
    }
  };

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Authorization</h1>
        <Button variant="ghost" onClick={() => navigate('/bookings')}>Back</Button>
      </div>

      <section className="mb-6">
        <div className="p-4 rounded-md bg-gray-50 text-gray-900">
          <div className="mb-4 flex gap-2 items-center">
            <h2 className="text-lg font-medium">Manage users</h2>
          </div>

          {currentUser && (
            <div className="mb-4 p-3 rounded-md bg-white/80 border">
              <div className="text-sm font-medium">Your account</div>
              <div className="mt-2 flex items-center gap-4">
                <div className="text-sm">{currentUser.email}</div>
                <div className="text-sm text-muted-foreground">{currentUser.name}</div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs">Settings</label>
                  <input type="checkbox" checked={!!currentUser.settings} disabled />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs">Auth</label>
                  <input type="checkbox" checked={!!currentUser.authorisation} disabled />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs">Analytics</label>
                  <input type="checkbox" checked={!!currentUser.analytics} disabled />
                </div>
              </div>
            </div>
          )}

          <form className="mb-4 flex gap-2" onSubmit={handleAddUser}>
            <input type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="px-3 py-2 rounded border" />
            <input type="text" placeholder="Name (optional)" value={newName} onChange={(e) => setNewName(e.target.value)} className="px-3 py-2 rounded border" />
            <Button type="submit" disabled={adding}>{adding ? 'Adding...' : 'Add'}</Button>
          </form>

          {loading ? (
            <div>Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-sm text-muted-foreground">No enabled users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Email</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Settings</th>
                    <th className="p-2">Auth</th>
                    <th className="p-2">Analytics</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.uid} className="border-b">
                      <td className="p-2 align-top">{u.email}</td>
                      <td className="p-2 align-top">{u.name}</td>
                      <td className="p-2 align-top">
                        <input type="checkbox" checked={!!u.settings} onChange={(e) => toggleFlag(u.uid, 'settings', e.target.checked)} />
                      </td>
                      <td className="p-2 align-top">
                        <input type="checkbox" checked={!!u.authorisation} onChange={(e) => toggleFlag(u.uid, 'authorisation', e.target.checked)} />
                      </td>
                      <td className="p-2 align-top">
                        <input type="checkbox" checked={!!u.analytics} onChange={(e) => toggleFlag(u.uid, 'analytics', e.target.checked)} />
                      </td>
                      <td className="p-2 align-top">
                        <Button variant="destructive" size="sm" onClick={() => disableUser(u.uid)}>Remove access</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default Authorization;
