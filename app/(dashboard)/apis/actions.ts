"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

export type ApiData = {
	id: string;
	name: string;
	type: "simple" | "header_body";
	code_encrypted: string | null;
	header_code_encrypted: string | null;
	body_code_encrypted: string | null;
	/** Decrypted header value for display (only for header_body, when header is set) */
	header_display?: string | null;
	/** Decrypted body value for display (only for header_body, when body is set) */
	body_display?: string | null;
	/** Decrypted code for display (only for simple type) */
	code_display?: string | null;
	created_at: string;
	sort_order?: number;
};

export async function loadApis() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { data: [], error: "Unauthorized" };

	const admin = createAdminClient();
	const { data, error } = await admin
		.from("apis")
		.select("id, name, type, code_encrypted, header_code_encrypted, body_code_encrypted, created_at, sort_order")
		.eq("user_id", user.id)
		.order("sort_order", { ascending: true })
		.order("created_at", { ascending: false });

	if (error) return { data: [], error: error.message };
	const list = (data ?? []) as ApiData[];
	for (const row of list) {
		if (row.type === "simple" && row.code_encrypted) {
			try {
				row.code_display = decrypt(row.code_encrypted);
			} catch {
				row.code_display = null;
			}
		}
		if (row.type === "header_body") {
			if (row.header_code_encrypted) {
				try {
					row.header_display = decrypt(row.header_code_encrypted);
				} catch {
					row.header_display = null;
				}
			}
			if (row.body_code_encrypted) {
				try {
					row.body_display = decrypt(row.body_code_encrypted);
				} catch {
					row.body_display = null;
				}
			}
		}
	}
	return { data: list, error: null };
}

export type ApiInputSimple = {
	type: "simple";
	name: string;
	code: string;
};

export type ApiInputHeaderBody = {
	type: "header_body";
	name: string;
	headerCode?: string;
	bodyCode?: string;
};

export type ApiInput = ApiInputSimple | ApiInputHeaderBody;

export async function createApi(input: ApiInput) {
	if (!input.name?.trim()) return { error: "Name is required" };

	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	if (input.type === "simple") {
		if (!input.code?.trim()) return { error: "API code is required" };
		const { error } = await supabase.from("apis").insert({
			user_id: user.id,
			name: input.name.trim(),
			type: "simple",
			code_encrypted: encrypt(input.code),
			header_code_encrypted: null,
			body_code_encrypted: null,
		});
		if (error) return { error: error.message };
	} else {
		const hasHeader = !!input.headerCode?.trim();
		const hasBody = !!input.bodyCode?.trim();
		if (!hasHeader && !hasBody) return { error: "At least one of Header code or Body code is required" };
		const { error } = await supabase.from("apis").insert({
			user_id: user.id,
			name: input.name.trim(),
			type: "header_body",
			code_encrypted: null,
			header_code_encrypted: hasHeader ? encrypt(input.headerCode!) : null,
			body_code_encrypted: hasBody ? encrypt(input.bodyCode!) : null,
		});
		if (error) return { error: error.message };
	}

	revalidatePath("/dashboard");
	revalidatePath("/apis");
	return { error: null };
}

export async function updateApi(
	id: string,
	input: { name?: string; code?: string; headerCode?: string; bodyCode?: string }
) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const { data: existing } = await supabase
		.from("apis")
		.select("type")
		.eq("id", id)
		.eq("user_id", user.id)
		.single();

	if (!existing) return { error: "API not found" };

	const updates: Record<string, unknown> = {};
	if (input.name != null) updates.name = input.name.trim();
	if (existing.type === "simple" && input.code != null && input.code.trim()) {
		updates.code_encrypted = encrypt(input.code);
	}
	if (existing.type === "header_body") {
		if (input.headerCode != null && input.headerCode.trim())
			updates.header_code_encrypted = encrypt(input.headerCode);
		if (input.bodyCode != null && input.bodyCode.trim())
			updates.body_code_encrypted = encrypt(input.bodyCode);
	}

	const { error } = await supabase
		.from("apis")
		.update(updates)
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/apis");
	return { error: null };
}

export async function updateApiOrder(ids: string[]) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	for (let i = 0; i < ids.length; i++) {
		const { error } = await supabase
			.from("apis")
			.update({ sort_order: i })
			.eq("id", ids[i])
			.eq("user_id", user.id);
		if (error) return { error: error.message };
	}
	revalidatePath("/dashboard");
	revalidatePath("/apis");
	return { error: null };
}

export async function deleteApi(id: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const { error } = await supabase
		.from("apis")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/apis");
	return { error: null };
}

export async function getDecryptedCode(id: string): Promise<{ code?: string; headerCode?: string; bodyCode?: string } | null> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return null;

	const { data } = await supabase
		.from("apis")
		.select("type, code_encrypted, header_code_encrypted, body_code_encrypted")
		.eq("id", id)
		.eq("user_id", user.id)
		.single();

	if (!data) return null;
	try {
		if (data.type === "simple" && data.code_encrypted) {
			return { code: decrypt(data.code_encrypted) };
		}
		if (data.type === "header_body" && (data.header_code_encrypted || data.body_code_encrypted)) {
			const result: { headerCode?: string; bodyCode?: string } = {};
			if (data.header_code_encrypted) result.headerCode = decrypt(data.header_code_encrypted);
			if (data.body_code_encrypted) result.bodyCode = decrypt(data.body_code_encrypted);
			return result;
		}
	} catch {
		// ignore
	}
	return null;
}
