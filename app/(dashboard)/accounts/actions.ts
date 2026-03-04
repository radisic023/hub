"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

export type AccountData = {
	id: string;
	link: string;
	username: string | null;
	email: string | null;
	password_encrypted: string;
	icon_url: string | null;
	created_at: string;
	sort_order?: number;
};

const ACCOUNT_ICONS_PREFIX = "account_icons/";

export async function loadAccounts() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { data: [], error: "Unauthorized" };

	const admin = createAdminClient();
	const { data: rows, error } = await admin
		.from("accounts")
		.select("id, link, username, email, password_encrypted, icon_url, created_at, sort_order")
		.eq("user_id", user.id)
		.order("sort_order", { ascending: true })
		.order("created_at", { ascending: false });

	if (error) return { data: [], error: error.message };
	const accounts = (rows ?? []) as AccountData[];

	// Resolve icon_url (relative path) to signed URL for display
	for (const acc of accounts) {
		if (acc.icon_url) {
			const storagePath = `${user.id}/${acc.icon_url}`;
			const { data: signed } = await supabase.storage
				.from("files")
				.createSignedUrl(storagePath, 3600);
			acc.icon_url = signed?.signedUrl ?? null;
		}
	}
	return { data: accounts, error: null };
}

export type AccountInput = {
	link: string;
	username?: string;
	email?: string;
	password: string;
	icon_url?: string | null;
};

function getIconExt(file: File): string {
	const name = file.name.toLowerCase();
	if (name.endsWith(".png")) return "png";
	if (name.endsWith(".gif")) return "gif";
	if (name.endsWith(".webp")) return "webp";
	if (name.endsWith(".svg")) return "svg";
	return "jpg";
}

export async function createAccount(formData: FormData) {
	const link = (formData.get("link") as string)?.trim();
	const username = (formData.get("username") as string)?.trim() || null;
	const email = (formData.get("email") as string)?.trim() || null;
	const password = (formData.get("password") as string)?.trim();
	const iconFile = formData.get("icon") as File | null;

	if (!link) return { error: "Link is required" };
	if (!username && !email) return { error: "Username or E-mail is required" };
	if (!password) return { error: "Password is required" };

	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const admin = createAdminClient();
	const { data: newAccount, error: insertError } = await admin
		.from("accounts")
		.insert({
			user_id: user.id,
			link,
			username: username || null,
			email: email || null,
			password_encrypted: encrypt(password),
			icon_url: null,
		})
		.select("id")
		.single();

	if (insertError) return { error: insertError.message };
	const accountId = (newAccount as { id: string }).id;

	if (iconFile?.size && iconFile.type.startsWith("image/")) {
		const ext = getIconExt(iconFile);
		const storagePath = `${user.id}/${ACCOUNT_ICONS_PREFIX}${accountId}.${ext}`;
		const buffer = Buffer.from(await iconFile.arrayBuffer());
		const { error: uploadError } = await admin.storage
			.from("files")
			.upload(storagePath, buffer, { upsert: true, contentType: iconFile.type });
		if (!uploadError) {
			await admin
				.from("accounts")
				.update({ icon_url: `${ACCOUNT_ICONS_PREFIX}${accountId}.${ext}` })
				.eq("id", accountId)
				.eq("user_id", user.id);
		}
	}

	revalidatePath("/dashboard");
	revalidatePath("/accounts");
	return { error: null };
}

export async function updateAccount(id: string, formData: FormData) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const link = (formData.get("link") as string)?.trim();
	const username = (formData.get("username") as string)?.trim() || null;
	const email = (formData.get("email") as string)?.trim() || null;
	const password = (formData.get("password") as string)?.trim();
	const iconFile = formData.get("icon") as File | null;

	const updates: Record<string, unknown> = {};
	if (link != null) updates.link = link;
	updates.username = username;
	updates.email = email;
	if (password) updates.password_encrypted = encrypt(password);

	const admin = createAdminClient();
	if (iconFile?.size && iconFile.type.startsWith("image/")) {
		const ext = getIconExt(iconFile);
		const storagePath = `${user.id}/${ACCOUNT_ICONS_PREFIX}${id}.${ext}`;
		const buffer = Buffer.from(await iconFile.arrayBuffer());
		const { error: uploadError } = await admin.storage
			.from("files")
			.upload(storagePath, buffer, { upsert: true, contentType: iconFile.type });
		if (!uploadError) {
			updates.icon_url = `${ACCOUNT_ICONS_PREFIX}${id}.${ext}`;
		}
	}

	const { error } = await admin
		.from("accounts")
		.update(updates)
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/accounts");
	return { error: null };
}

export async function updateAccountOrder(ids: string[]) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	for (let i = 0; i < ids.length; i++) {
		const { error } = await supabase
			.from("accounts")
			.update({ sort_order: i })
			.eq("id", ids[i])
			.eq("user_id", user.id);
		if (error) return { error: error.message };
	}
	revalidatePath("/dashboard");
	revalidatePath("/accounts");
	return { error: null };
}

export async function deleteAccount(id: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const { error } = await supabase
		.from("accounts")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/accounts");
	return { error: null };
}

export async function getDecryptedPassword(id: string): Promise<string | null> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return null;

	const { data } = await supabase
		.from("accounts")
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
