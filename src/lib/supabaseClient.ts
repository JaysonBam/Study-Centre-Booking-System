import { createClient } from '@supabase/supabase-js'
import { toast } from 'sonner'

declare const process: { env?: Record<string, string | undefined> } | undefined
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? process?.env?.SUPABASE_URL) as string
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? process?.env?.SUPABASE_KEY) as string

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const notifierKey = '__scbs_access_removed_notifier';
const globalAny = globalThis as any;
if (!globalAny[notifierKey]) {
	globalAny[notifierKey] = { lastUid: null as string | null, lastAt: 0 };
}
const NOTIFY_TTL_MS = 10_000; 

export function notifyAccessRemovedOnce(uid?: string) {
	const now = Date.now();
	const state = globalAny[notifierKey];
	if (uid) {
		if (uid === state.lastUid && now - state.lastAt < NOTIFY_TTL_MS) return;
		state.lastUid = uid;
		state.lastAt = now;
	} else {
		if (now - state.lastAt < NOTIFY_TTL_MS) return;
		state.lastAt = now;
	}

	try {
		toast.error('Your account no longer has access. Contact an administrator.');
	} catch (e) {
		console.warn('Failed to show access removed toast', e);
	}
}

export function resetAccessRemovedNotification(uid?: string) {
	const state = globalAny[notifierKey];
	if (uid) {
		if (uid === state.lastUid) {
			state.lastUid = null;
			state.lastAt = 0;
		}
	} else {
		state.lastUid = null;
		state.lastAt = 0;
	}
}

async function checkAccountEnabledByUid(uid: string | undefined | null) {
	if (!uid) return;
	try {
		const { data, error } = await supabase.from('users').select('enabled').eq('uid', uid).maybeSingle();
		if (error) {
			console.error('Failed to check user enabled flag', error);
			return;
		}
		// If there's no row or enabled is explicitly false, treat the account as not allowed.
		const hasRow = !!data;
		const enabled = (data as any)?.enabled;
		if (!hasRow || enabled === false) {
			// clear session / token
			await supabase.auth.signOut();
			// notify user once (pass uid for per-user suppression)
			notifyAccessRemovedOnce(uid ?? undefined);
		} else {
			// valid account — clear any prior notification so future revokes can show again
			resetAccessRemovedNotification(uid ?? undefined);
		}
	} catch (err) {
		console.error('Error while checking user enabled status', err);
	}
}

// Listen to auth state changes to block accounts that have been disabled in the users table.
supabase.auth.onAuthStateChange((event, session) => {
	const uid = session?.user?.id ?? null;
	// When signed in (or session restored), validate enabled flag
	if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
		checkAccountEnabledByUid(uid);
	}
	// Also when a session is present on init
	if (session?.user) {
		checkAccountEnabledByUid(uid);
	}
});
