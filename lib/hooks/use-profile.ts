"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Profile = {
	id: string;
	username: string;
	email: string;
	first_name: string;
	last_name: string;
	role: string;
};

export function useProfile() {
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const supabase = createClient();

		async function load() {
			const { data: { user: u } } = await supabase.auth.getUser();
			setUser(u);
			if (u) {
				const { data: p } = await supabase
					.from("profiles")
					.select("id, username, email, first_name, last_name, role")
					.eq("id", u.id)
					.single();
				setProfile(p ?? null);
			}
			setLoading(false);
		}

		load();
		const { data: { subscription } } = supabase.auth.onAuthStateChange(load);
		return () => subscription.unsubscribe();
	}, []);

	return { user, profile, loading };
}

export function getInitials(
	firstName?: string | null,
	lastName?: string | null,
	fallback?: string | null
) {
	const f = firstName?.trim().charAt(0)?.toUpperCase() ?? "";
	const l = lastName?.trim().charAt(0)?.toUpperCase() ?? "";
	const fromName = f + l;
	if (fromName) return fromName;
	// Fallback: use username (2 chars) or email (first 2 chars before @)
	if (fallback?.trim()) {
		const s = fallback.trim();
		const beforeAt = s.split("@")[0];
		const base = beforeAt.length >= 2 ? beforeAt : s;
		return base.slice(0, 2).toUpperCase();
	}
	return "?";
}
