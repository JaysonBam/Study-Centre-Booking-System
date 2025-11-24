import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import Hamburger from "@/components/ui/hamburger";
import { toast } from "sonner";
import { useConfirm } from "@/context/ConfirmDialogContext";

type UserRow = {
  uid: string;
  email: string | null;
  name: string | null;
  settings: boolean | null;
  authorisation: boolean | null;
  analytics: boolean | null;
  created_at?: string | null;
  // 'enabled' flag has been removed; deletion will remove rows instead
};

const Authorization = () => {
  const { confirm } = useConfirm();
  
  const [users, setUsers] = useState<UserRow[]>([]);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const FUNCTIONS_BASE = (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string) ?? '/functions/v1';

  // Load users (deleted accounts are removed from the users table)
  const loadUsers = async () => {
    setLoading(true);
    try {
      // get current auth user uid first
      const { data: meData } = await supabase.auth.getUser();
      const meUid = meData?.user?.id ?? null;
      setCurrentUid(meUid);
      const { data, error } = await supabase
        .from("users")
        .select("uid, email, name, settings, authorisation, analytics, created_at")
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
  const toggleFlag = async (uid: string, column: keyof Omit<UserRow, "uid" | "email" | "name">, value: boolean) => {
    if (uid === currentUid) {
      toast.error('You may not change your own access flags here');
      return;
    }
    try {
      const token = (await supabase.auth.getSession()).data?.session?.access_token ?? null;
      if (!token) throw new Error('Not authenticated');
      const body: any = {};
      body[column as string] = value;
      const res = await fetch(`${FUNCTIONS_BASE}/admin-users/flags/${uid}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { /* not json */ }
      if (!res.ok) throw new Error(json?.error || text || res.statusText || 'Function error');
      setUsers((prev) => prev.map(u => u.uid === uid ? { ...u, [column]: value } : u));
      toast.success('Updated');
    } catch (err: any) {
      console.error('Failed to update user flag', err?.message ?? err);
      toast.error(err?.message ?? 'Failed to update');
    }
  };

  // Remove access to a user: perform a delete (auth + users row) via the Edge Function
  const disableUser = async (uid: string) => {
    if (uid === currentUid) {
      toast.error('You may not remove your own access');
      return;
    }
    const ok = await confirm({
      title: "Remove Access",
      description: "Remove this user's access? This will delete the user from the auth system and remove their users row.",
      confirmText: "Remove",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      // Now perform a proper delete (remove from auth and users table)
      const token = (await supabase.auth.getSession()).data?.session?.access_token ?? null;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${FUNCTIONS_BASE}/admin-users/delete/${uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { /* not json */ }
      if (!res.ok) throw new Error(json?.error || text || res.statusText || 'Function error');
      setUsers((prev) => prev.filter(u => u.uid !== uid));
      toast.success('User deleted');
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
  const { data: existingRows, error: selectErr } = await supabase.from('users').select('uid').eq('email', email).limit(1).maybeSingle();
      if (selectErr) throw selectErr;

      if (existingRows) {
        throw new Error('A users row already exists for that email');
      }

      // Create user via Edge Function (admin-users/create)
      const token = (await supabase.auth.getSession()).data?.session?.access_token ?? null;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${FUNCTIONS_BASE}/admin-users/create`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, name }),
      });

      const text = await res.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { /* not json */ }
      if (!res.ok) {
        throw new Error(json?.error || text || res.statusText || 'Edge function failed')
      }

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
        <div className="flex items-center gap-3">
          <Hamburger />
          <h1 className="text-2xl font-semibold">Authorization</h1>
        </div>
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
            <div className="text-sm text-muted-foreground">No users found.</div>
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
