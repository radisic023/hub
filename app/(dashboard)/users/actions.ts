"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ProfileData = {
	id: string;
	username: string;
	email: string;
	first_name: string;
	last_name: string;
	role: string;
};

export async function loadProfiles() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { data: [], profile: null, error: "Unauthorized" };

	// Use admin client to bypass RLS (server actions may not have session in cookies)
	const admin = createAdminClient();
	const { data: profile } = await admin
		.from("profiles")
		.select("id, username, email, first_name, last_name, role")
		.eq("id", user.id)
		.single();

	let query = admin
		.from("profiles")
		.select("id, username, email, first_name, last_name, role")
		.order("first_name");

	if (profile?.role !== "admin") {
		query = query.eq("id", user.id);
	}

	const { data: list, error } = await query;

	if (error) return { data: [], profile: profile ?? null, error: error.message };
	let profiles = (list ?? []) as ProfileData[];
	if (profile && !profiles.some((p) => p.id === profile.id)) {
		profiles = [profile, ...profiles];
	}
	return { data: profiles, profile: profile ?? null, error: null };
}

export type UserInput = {
	first_name: string;
	last_name: string;
	email: string;
	password: string;
	role: "admin" | "editor" | "viewer";
	username?: string;
};

export async function createUser(input: UserInput) {
	if (!input.first_name?.trim()) return { error: "First name is required" };
	if (!input.last_name?.trim()) return { error: "Last name is required" };
	if (!input.email?.trim()) return { error: "E-mail is required" };
	if (!input.password?.trim()) return { error: "Password is required" };
	if (!input.role) return { error: "Role is required" };

	const supabase = await createClient();
	const { data: { user: currentUser } } = await supabase.auth.getUser();
	if (!currentUser) return { error: "Unauthorized" };

	const admin = createAdminClient();

	const { data: profile } = await admin
		.from("profiles")
		.select("role")
		.eq("id", currentUser.id)
		.single();

	if (profile?.role !== "admin") {
		return { error: "Only admins can add users" };
	}

	const username =
		input.username?.trim() ||
		input.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");

	const { data: newUser, error: authError } = await admin.auth.admin.createUser({
		email: input.email.trim(),
		password: input.password,
		email_confirm: true,
	});

	if (authError) {
		return { error: authError.message };
	}

	if (!newUser.user) return { error: "Failed to create user" };

	let uniqueUsername = username;
	let suffix = 0;
	while (true) {
		const { data: existing } = await admin
			.from("profiles")
			.select("id")
			.eq("username", uniqueUsername)
			.single();
		if (!existing) break;
		suffix++;
		uniqueUsername = `${username}${suffix}`;
	}

	const { error: profileError } = await admin.from("profiles").insert({
		id: newUser.user.id,
		username: uniqueUsername,
		email: input.email.trim(),
		first_name: input.first_name.trim(),
		last_name: input.last_name.trim(),
		role: input.role,
	});

	if (profileError) {
		return { error: profileError.message };
	}

	revalidatePath("/dashboard");
	revalidatePath("/users");
	return { error: null };
}

export async function deleteUser(id: string) {
	const supabase = await createClient();
	const { data: { user: currentUser } } = await supabase.auth.getUser();
	if (!currentUser) return { error: "Unauthorized" };

	const admin = createAdminClient();

	const { data: profile } = await admin
		.from("profiles")
		.select("role")
		.eq("id", currentUser.id)
		.single();

	if (profile?.role !== "admin") {
		return { error: "Only admins can delete users" };
	}

	if (id === currentUser.id) {
		return { error: "Cannot delete yourself" };
	}

	const { error } = await admin.auth.admin.deleteUser(id);
	if (error) return { error: error.message };

	revalidatePath("/dashboard");
	revalidatePath("/users");
	return { error: null };
}
