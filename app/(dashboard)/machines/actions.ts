"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

export type MachineData = {
	id: string;
	title: string | null;
	hostname: string;
	username: string;
	password_encrypted: string;
	port: number;
	created_at: string;
};

export async function loadMachines() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { data: [], error: "Unauthorized" };

	// Use admin for reliable server-side loading
	const admin = createAdminClient();
	const { data, error } = await admin
		.from("machines")
		.select("id, title, hostname, username, password_encrypted, port, created_at")
		.eq("user_id", user.id)
		.order("created_at", { ascending: false });

	if (error) return { data: [], error: error.message };
	return { data: (data ?? []) as MachineData[], error: null };
}

export type MachineInput = {
	title?: string | null;
	hostname: string;
	username: string;
	password: string;
	port: number;
};

export async function createMachine(input: MachineInput) {
	if (!input.hostname?.trim()) return { error: "Hostname is required" };
	if (!input.username?.trim()) return { error: "Username is required" };
	if (!input.password?.trim()) return { error: "Password is required" };
	const port = Number(input.port) || 22;
	if (port < 1 || port > 65535) return { error: "Port must be 1-65535" };

	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const { error } = await supabase.from("machines").insert({
		user_id: user.id,
		title: input.title?.trim() || null,
		hostname: input.hostname.trim(),
		username: input.username.trim(),
		password_encrypted: encrypt(input.password),
		port,
	});

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/machines");
	return { error: null };
}

export async function updateMachine(id: string, input: Partial<MachineInput>) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const updates: Record<string, unknown> = {};
	if (input.title !== undefined) updates.title = input.title?.trim() || null;
	if (input.hostname != null) updates.hostname = input.hostname.trim();
	if (input.username != null) updates.username = input.username.trim();
	if (input.password != null && input.password.trim())
		updates.password_encrypted = encrypt(input.password);
	if (input.port != null) {
		const port = Number(input.port) || 22;
		if (port >= 1 && port <= 65535) updates.port = port;
	}

	const { error } = await supabase
		.from("machines")
		.update(updates)
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/machines");
	return { error: null };
}

export async function deleteMachine(id: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const { error } = await supabase
		.from("machines")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/machines");
	return { error: null };
}

export async function getDecryptedPassword(id: string): Promise<string | null> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return null;

	const { data } = await supabase
		.from("machines")
		.select("password_encrypted")
		.eq("id", id)
		.eq("user_id", user.id)
		.single();

	if (!data?.password_encrypted) return null;
	try {
		return decrypt(data.password_encrypted);
	} catch {
		return null;
	}
}
