"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const SITE_SETTINGS_PREFIX = "site_settings/";

export type SiteSettingsData = {
	id: string;
	user_id: string;
	title: string | null;
	description: string | null;
	keywords: string | null;
	seo_banner_path: string | null;
	favicon_path: string | null;
	seo_banner_url: string | null;
	favicon_url: string | null;
	created_at: string;
	updated_at: string;
};

function getExt(file: File): string {
	const name = file.name.toLowerCase();
	if (name.endsWith(".png")) return "png";
	if (name.endsWith(".gif")) return "gif";
	if (name.endsWith(".webp")) return "webp";
	if (name.endsWith(".ico")) return "ico";
	if (name.endsWith(".svg")) return "svg";
	return "jpg";
}

export async function loadSiteSettings() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { data: null, error: "Unauthorized" };

	const admin = createAdminClient();
	const { data, error } = await admin
		.from("site_settings")
		.select("id, user_id, title, description, keywords, seo_banner_path, favicon_path, created_at, updated_at")
		.eq("user_id", user.id)
		.single();

	if (error && error.code !== "PGRST116") return { data: null, error: error.message };
	const row = data as SiteSettingsData | null;
	if (!row) return { data: null, error: null };

	row.seo_banner_url = null;
	row.favicon_url = null;
	if (row.seo_banner_path) {
		const path = `${user.id}/${row.seo_banner_path}`;
		const { data: signed } = await supabase.storage.from("files").createSignedUrl(path, 3600);
		row.seo_banner_url = signed?.signedUrl ?? null;
	}
	if (row.favicon_path) {
		const path = `${user.id}/${row.favicon_path}`;
		const { data: signed } = await supabase.storage.from("files").createSignedUrl(path, 3600);
		row.favicon_url = signed?.signedUrl ?? null;
	}
	return { data: row, error: null };
}

export async function upsertSiteSettings(formData: FormData) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const title = (formData.get("title") as string)?.trim() || null;
	const description = (formData.get("description") as string)?.trim() || null;
	const keywords = (formData.get("keywords") as string)?.trim() || null;
	const bannerFile = formData.get("banner") as File | null;
	const faviconFile = formData.get("favicon") as File | null;

	const admin = createAdminClient();
	const { data: existing } = await admin
		.from("site_settings")
		.select("id, seo_banner_path, favicon_path")
		.eq("user_id", user.id)
		.single();

	const updates: Record<string, unknown> = {
		title,
		description,
		keywords,
		updated_at: new Date().toISOString(),
	};

	if (bannerFile?.size && bannerFile.type.startsWith("image/")) {
		const ext = getExt(bannerFile);
		const path = `${user.id}/${SITE_SETTINGS_PREFIX}banner.${ext}`;
		const buf = Buffer.from(await bannerFile.arrayBuffer());
		await admin.storage.from("files").upload(path, buf, { upsert: true, contentType: bannerFile.type });
		updates.seo_banner_path = `${SITE_SETTINGS_PREFIX}banner.${ext}`;
	}
	if (faviconFile?.size && faviconFile.type.startsWith("image/")) {
		const ext = getExt(faviconFile);
		const path = `${user.id}/${SITE_SETTINGS_PREFIX}favicon.${ext}`;
		const buf = Buffer.from(await faviconFile.arrayBuffer());
		await admin.storage.from("files").upload(path, buf, { upsert: true, contentType: faviconFile.type });
		updates.favicon_path = `${SITE_SETTINGS_PREFIX}favicon.${ext}`;
	}

	if (existing) {
		const { error } = await admin
			.from("site_settings")
			.update(updates)
			.eq("user_id", user.id);
		if (error) return { error: error.message };
	} else {
		const { error } = await admin.from("site_settings").insert({
			user_id: user.id,
			...updates,
		});
		if (error) return { error: error.message };
	}

	revalidatePath("/settings");
	revalidatePath("/dashboard");
	revalidatePath("/");
	return { error: null };
}
