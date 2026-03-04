"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function signInWithUsername(username: string, password: string) {
	const admin = createAdminClient();

	const { data: profile } = await admin
		.from("profiles")
		.select("email")
		.eq("username", username.toLowerCase().trim())
		.single();

	if (!profile) {
		return { error: "Invalid username or password" };
	}

	const supabase = await createClient();
	const { error } = await supabase.auth.signInWithPassword({
		email: profile.email,
		password,
	});

	if (error) {
		return { error: "Invalid username or password" };
	}

	return { error: null };
}

export async function signOut() {
	const supabase = await createClient();
	await supabase.auth.signOut();
}
