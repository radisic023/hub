"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function loadTodos() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { data: [], error: "Unauthorized" };

	const admin = createAdminClient();
	const { data, error } = await admin
		.from("todo_items")
		.select("id, title, done, created_at")
		.eq("user_id", user.id)
		.order("created_at", { ascending: false });

	if (error) return { data: [], error: error.message };
	return { data: data ?? [], error: null };
}

export async function createTodo(title: string) {
	if (!title?.trim()) return { error: "Title is required" };

	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const admin = createAdminClient();
	const { data, error } = await admin.from("todo_items").insert({
		user_id: user.id,
		title: title.trim(),
		done: false,
	}).select("id, title, done, created_at").single();

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/todo");
	return { error: null, data: data as { id: string; title: string; done: boolean; created_at: string } };
}

export async function toggleTodo(id: string, done: boolean) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const { error } = await supabase
		.from("todo_items")
		.update({ done })
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/todo");
	return { error: null };
}

export async function updateTodo(id: string, title: string) {
	if (!title?.trim()) return { error: "Title is required" };

	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const { error } = await supabase
		.from("todo_items")
		.update({ title: title.trim() })
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/todo");
	return { error: null };
}

export async function deleteTodo(id: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const { error } = await supabase
		.from("todo_items")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/todo");
	return { error: null };
}
