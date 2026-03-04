"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import JSZip from "jszip";

export async function createFolder(name: string, parentId?: string) {
	if (!name?.trim()) return { error: "Folder name is required" };

	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const path = parentId ? `/${parentId}/${name}` : `/${name}`;

	const admin = createAdminClient();
	const { error } = await admin.from("files_metadata").insert({
		user_id: user.id,
		name: name.trim(),
		path,
		is_folder: true,
		folder_id: parentId ?? null,
	});

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/files");
	return { error: null };
}

export async function renameFile(id: string, newName: string) {
	if (!newName?.trim()) return { error: "Name is required" };

	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const { data: file } = await supabase
		.from("files_metadata")
		.select("path, name, is_folder")
		.eq("id", id)
		.eq("user_id", user.id)
		.single();

	if (!file) return { error: "File not found" };

	const newPath = file.path.replace(new RegExp(`/${file.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), `/${newName.trim()}`);

	if (!file.is_folder) {
		const oldStoragePath = `${user.id}${file.path}`;
		const newStoragePath = `${user.id}${newPath}`;
		await supabase.storage.from("files").move(oldStoragePath, newStoragePath);
	}

	const { error } = await supabase
		.from("files_metadata")
		.update({ name: newName.trim(), path: newPath })
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/files");
	return { error: null };
}

export async function loadAllFolders(userId: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user || user.id !== userId) return { data: [], error: "Unauthorized" };

	const admin = createAdminClient();
	const { data, error } = await admin
		.from("files_metadata")
		.select("id, name, folder_id")
		.eq("user_id", userId)
		.eq("is_folder", true)
		.order("name");

	if (error) return { data: [], error: error.message };
	return { data: data ?? [], error: null };
}

export async function loadFiles(userId: string, folderId: string | null) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user || user.id !== userId) return { data: [], error: "Unauthorized" };

	// Use admin client to bypass RLS (server actions may not have session in cookies)
	const admin = createAdminClient();
	let query = admin
		.from("files_metadata")
		.select("id, name, path, is_folder, folder_id, size, mime_type, created_at")
		.eq("user_id", userId)
		.order("is_folder", { ascending: false })
		.order("name");
	// Root folder: folder_id IS NULL ( .eq("folder_id", null) ne vraća ništa u SQL )
	if (folderId === null) {
		query = query.is("folder_id", null);
	} else {
		query = query.eq("folder_id", folderId);
	}
	const { data, error } = await query;

	if (error) return { data: [], error: error.message };
	return { data: data ?? [], error: null };
}

export async function uploadFileServer(formData: FormData) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const file = formData.get("file") as File;
	if (!file?.size) return { error: "No file" };

	const rawFolderId = formData.get("folderId");
	const folderId = rawFolderId && String(rawFolderId).trim() ? String(rawFolderId).trim() : null;
	const safeName = file.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
	const path = folderId ? `/${folderId}/${safeName}` : `/${safeName}`;
	const storagePath = `${user.id}${path}`;

	const admin = createAdminClient();
	const buffer = Buffer.from(await file.arrayBuffer());
	const { error: uploadError } = await admin.storage
		.from("files")
		.upload(storagePath, buffer, {
			upsert: true,
			contentType: file.type || "application/octet-stream",
		});

	if (uploadError) return { error: uploadError.message };

	const { error: metaError } = await insertFileMetadata({
		user_id: user.id,
		name: safeName,
		path,
		is_folder: false,
		folder_id: folderId,
		size: file.size,
		mime_type: file.type || null,
	});

	if (metaError) return { error: metaError };
	return { error: null };
}

export async function insertFileMetadata(params: {
	user_id: string;
	name: string;
	path: string;
	is_folder: boolean;
	folder_id: string | null;
	size: number;
	mime_type: string | null;
}) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user || user.id !== params.user_id) return { error: "Unauthorized" };

	const admin = createAdminClient();
	const { error } = await admin.from("files_metadata").insert(params);
	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/files");
	return { error: null };
}

export async function deleteFiles(ids: string[]) {
	if (!ids.length) return { error: null, deleted: 0 };
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized", deleted: 0 };

	let deleted = 0;
	for (const id of ids) {
		const { data: file } = await supabase
			.from("files_metadata")
			.select("path, is_folder")
			.eq("id", id)
			.eq("user_id", user.id)
			.single();
		if (!file) continue;
		if (!file.is_folder) {
			const storagePath = `${user.id}${file.path}`;
			await supabase.storage.from("files").remove([storagePath]);
		}
		const { error } = await supabase
			.from("files_metadata")
			.delete()
			.eq("id", id)
			.eq("user_id", user.id);
		if (!error) deleted++;
	}
	revalidatePath("/dashboard");
	revalidatePath("/files");
	return { error: null, deleted };
}

export async function deleteFile(id: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const { data: file } = await supabase
		.from("files_metadata")
		.select("path, is_folder")
		.eq("id", id)
		.eq("user_id", user.id)
		.single();

	if (!file) return { error: "File not found" };

	if (!file.is_folder) {
		const storagePath = `${user.id}${file.path}`;
		await supabase.storage.from("files").remove([storagePath]);
	}

	const { error } = await supabase
		.from("files_metadata")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/files");
	return { error: null };
}

export async function getFileContent(id: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { content: null, mimeType: null, error: "Unauthorized" };

	const { data: file } = await supabase
		.from("files_metadata")
		.select("path, mime_type")
		.eq("id", id)
		.eq("user_id", user.id)
		.eq("is_folder", false)
		.single();

	if (!file) return { content: null, mimeType: null, error: "File not found" };

	const storagePath = `${user.id}${file.path}`;
	const { data: blob, error } = await supabase.storage
		.from("files")
		.download(storagePath);

	if (error || !blob) return { content: null, mimeType: file.mime_type, error: error?.message ?? "Failed to download" };

	const mime = file.mime_type || blob.type;
	const isText =
		mime?.startsWith("text/") ||
		mime === "application/json" ||
		mime === "application/javascript" ||
		mime === "text/javascript" ||
		/\b(js|ts|tsx|jsx|css|html|htm|php|blade|md|xml|yaml|yml|json|sql|py|rb|java|c|cpp|go|rs|sh|env|txt)\b/i.test(file.path);

	if (isText) {
		const content = await blob.text();
		return { content, mimeType: mime, error: null };
	}
	return { content: null, mimeType: mime, error: "Binary file - preview not available" };
}

export async function saveFileContent(id: string, content: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const { data: file } = await supabase
		.from("files_metadata")
		.select("path")
		.eq("id", id)
		.eq("user_id", user.id)
		.eq("is_folder", false)
		.single();

	if (!file) return { error: "File not found" };

	const storagePath = `${user.id}${file.path}`;
	const blob = new Blob([content], { type: "text/plain" });
	const { error } = await supabase.storage.from("files").upload(storagePath, blob, { upsert: true });
	if (error) return { error: error.message };
	revalidatePath("/files");
	return { error: null };
}

export async function moveFileToFolder(
	fileId: string,
	targetFolderId: string | null
) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized" };

	const admin = createAdminClient();
	const { data: file } = await admin
		.from("files_metadata")
		.select("path, name, is_folder")
		.eq("id", fileId)
		.eq("user_id", user.id)
		.single();

	if (!file) return { error: "File not found" };
	if (file.is_folder) return { error: "Moving folders not supported yet" };

	if (targetFolderId) {
		const { data: folder } = await admin
			.from("files_metadata")
			.select("id")
			.eq("id", targetFolderId)
			.eq("user_id", user.id)
			.eq("is_folder", true)
			.single();
		if (!folder) return { error: "Target folder not found" };
	}
	const newPath = targetFolderId ? `/${targetFolderId}/${file.name}` : `/${file.name}`;

	const oldStoragePath = `${user.id}${file.path}`;
	const newStoragePath = `${user.id}${newPath}`;
	const { error: moveError } = await admin.storage
		.from("files")
		.move(oldStoragePath, newStoragePath);

	if (moveError) return { error: moveError.message };

	const { error } = await admin
		.from("files_metadata")
		.update({ path: newPath, folder_id: targetFolderId })
		.eq("id", fileId)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	revalidatePath("/files");
	return { error: null };
}

export async function unzipToFolder(zipFileId: string, targetFolderId: string | null) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized", extracted: 0 };
	const uid = user.id;

	const admin = createAdminClient();
	const { data: zipMeta } = await admin
		.from("files_metadata")
		.select("path, name")
		.eq("id", zipFileId)
		.eq("user_id", uid)
		.eq("is_folder", false)
		.single();

	if (!zipMeta) return { error: "ZIP file not found", extracted: 0 };
	const ext = zipMeta.name.split(".").pop()?.toLowerCase();
	if (ext !== "zip") return { error: "File is not a ZIP archive", extracted: 0 };

	const storagePath = `${uid}${zipMeta.path}`;
	const { data: blob, error: dlError } = await admin.storage
		.from("files")
		.download(storagePath);

	if (dlError || !blob) return { error: dlError?.message ?? "Failed to download ZIP", extracted: 0 };

	const buf = Buffer.from(await blob.arrayBuffer());
	const zip = await JSZip.loadAsync(buf);
	const folderIdMap = new Map<string, string>();
	folderIdMap.set("", targetFolderId ?? "");

	async function ensureFolder(parentId: string | null, name: string): Promise<string> {
		const key = parentId ? `${parentId}/${name}` : name;
		if (folderIdMap.has(key)) return folderIdMap.get(key)!;
		const path = parentId ? `/${parentId}/${name}` : `/${name}`;
		let query = admin
			.from("files_metadata")
			.select("id")
			.eq("user_id", uid)
			.eq("is_folder", true)
			.eq("name", name);
		query = parentId === null ? query.is("folder_id", null) : query.eq("folder_id", parentId);
		const { data: existing } = await query.maybeSingle();
		if (existing) {
			folderIdMap.set(key, existing.id);
			return existing.id;
		}
		const { data: inserted, error } = await admin
			.from("files_metadata")
			.insert({
				user_id: uid,
				name,
				path,
				is_folder: true,
				folder_id: parentId,
			})
			.select("id")
			.single();
		if (error || !inserted) throw new Error(error?.message ?? "Failed to create folder");
		folderIdMap.set(key, inserted.id);
		return inserted.id;
	}

	let extracted = 0;
	for (const [entryPath, entry] of Object.entries(zip.files)) {
		const cleanPath = entryPath.replace(/\/$/, "");
		if (!cleanPath) continue;
		const parts = cleanPath.split("/");
		const name = parts.pop()!;

		if (entry.dir) {
			let parentId: string | null = targetFolderId;
			for (const seg of parts) {
				const fid = await ensureFolder(parentId, seg);
				parentId = fid;
			}
			await ensureFolder(parentId, name);
			continue;
		}

		let parentId: string | null = targetFolderId;
		for (const seg of parts) {
			parentId = await ensureFolder(parentId, seg);
		}

		const safeName = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
		const filePath = parentId ? `/${parentId}/${safeName}` : `/${safeName}`;
		const fileStoragePath = `${uid}${filePath}`;
		const content = await entry.async("nodebuffer");
		const mime = entry.name?.endsWith(".json") ? "application/json" : "application/octet-stream";

		const { error: upErr } = await admin.storage
			.from("files")
			.upload(fileStoragePath, content, {
				upsert: true,
				contentType: mime,
			});
		if (upErr) continue;

		await admin.from("files_metadata").insert({
			user_id: uid,
			name: safeName,
			path: filePath,
			is_folder: false,
			folder_id: parentId,
			size: content.length,
			mime_type: mime,
		});
		extracted++;
	}

	revalidatePath("/files");
	return { error: null, extracted };
}

export async function getDownloadUrl(id: string): Promise<string | null> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return null;

	const { data: file } = await supabase
		.from("files_metadata")
		.select("path")
		.eq("id", id)
		.eq("user_id", user.id)
		.eq("is_folder", false)
		.single();

	if (!file) return null;

	const storagePath = `${user.id}${file.path}`;
	const { data } = await supabase.storage
		.from("files")
		.createSignedUrl(storagePath, 60);

	return data?.signedUrl ?? null;
}
