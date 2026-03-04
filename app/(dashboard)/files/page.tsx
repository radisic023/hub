"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
	FolderOpen,
	File,
	FileCode,
	FileImage,
	FileText,
	FileVideo,
	FolderArchive,
	FolderPlus,
	Upload,
	Download,
	Pencil,
	Trash2,
	ArrowLeft,
	Eye,
	FolderInput,
	Archive,
	GripVertical,
	FileArchive,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	loadFiles,
	loadAllFolders,
	createFolder,
	uploadFileServer,
	renameFile,
	deleteFile,
	deleteFiles,
	getDownloadUrl,
	getFileContent,
	saveFileContent,
	moveFileToFolder,
	unzipToFolder,
} from "./actions";
import { useProfileContext } from "@/components/providers/profile-provider";
import { useRouter } from "next/navigation";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import JSZip from "jszip";

type FileItem = {
	id: string;
	name: string;
	path: string;
	is_folder: boolean;
	folder_id: string | null;
	size: number;
	mime_type: string | null;
	created_at: string;
};

const formSchema = z.object({
	name: z.string().min(1, "Name is required"),
});

function getFileIcon(name: string): LucideIcon {
	const ext = name.split(".").pop()?.toLowerCase() ?? "";
	const codeExts = ["tsx", "ts", "jsx", "js", "php", "blade", "html", "htm", "css", "scss", "json", "yaml", "yml", "xml", "md", "sql", "py", "rb", "java", "c", "cpp", "go", "rs", "sh", "env"];
	const videoExts = ["mp4", "webm", "mov", "avi", "mkv", "m4v", "flv", "wmv"];
	const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico"];
	const textExts = ["txt", "doc", "docx", "rtf", "odt"];
	if (codeExts.includes(ext)) return FileCode;
	if (videoExts.includes(ext)) return FileVideo;
	if (imageExts.includes(ext)) return FileImage;
	if (textExts.includes(ext)) return FileText;
	if (ext === "zip" || ext === "rar" || ext === "7z" || ext === "tar" || ext === "gz") return FolderArchive;
	return File;
}

function getLanguageFromFileName(name: string): string {
	const parts = name.split(".");
	const ext = parts.pop()?.toLowerCase();
	const prev = parts.pop()?.toLowerCase();
	const lang: Record<string, string> = {
		js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
		css: "css", scss: "scss", html: "html", htm: "html", php: "php", blade: "php",
		json: "json", yaml: "yaml", yml: "yaml", xml: "xml", md: "markdown",
		sql: "sql", py: "python", rb: "ruby", java: "java", c: "c", cpp: "cpp",
		go: "go", rs: "rust", sh: "bash", env: "bash", txt: "plaintext",
	};
	if (prev === "blade" && ext === "php") return "php";
	return lang[ext ?? ""] || "plaintext";
}

export default function FilesPage() {
	const router = useRouter();
	const { userId } = useProfileContext();
	const [items, setItems] = useState<FileItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
	const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
	const [folderDialogOpen, setFolderDialogOpen] = useState(false);
	const [renameDialogOpen, setRenameDialogOpen] = useState(false);
	const [renameItem, setRenameItem] = useState<FileItem | null>(null);
	const [renameName, setRenameName] = useState("");
	const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
	const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
	const [previewContent, setPreviewContent] = useState("");
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewEditMode, setPreviewEditMode] = useState(false);
	const [previewSaving, setPreviewSaving] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteItem, setDeleteItem] = useState<FileItem | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
	const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [moveDialogOpen, setMoveDialogOpen] = useState(false);
	const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null);
	const [moveLoading, setMoveLoading] = useState(false);
	const [unzipDialogOpen, setUnzipDialogOpen] = useState(false);
	const [unzipItem, setUnzipItem] = useState<FileItem | null>(null);
	const [unzipTargetFolderId, setUnzipTargetFolderId] = useState<string | null>(null);
	const [unzipLoading, setUnzipLoading] = useState(false);
	const [allFolders, setAllFolders] = useState<{ id: string; name: string; folder_id: string | null }[]>([]);
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [dropTargetId, setDropTargetId] = useState<string | null>(null);
	const gridRef = useRef<HTMLDivElement>(null);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: { name: "" },
	});

	const loadItems = useCallback(async () => {
		if (!userId) {
			setLoading(false);
			return;
		}
		try {
			const { data } = await loadFiles(userId, currentFolderId);
			setItems((data as FileItem[]) ?? []);
		} finally {
			setLoading(false);
		}
	}, [currentFolderId, userId]);

	useEffect(() => {
		loadItems();
	}, [loadItems]);

	async function onSubmitFolder(values: z.infer<typeof formSchema>) {
		const { error } = await createFolder(values.name, currentFolderId ?? undefined);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success("Folder created");
		setFolderDialogOpen(false);
		form.reset({ name: "" });
		loadItems();
	}

	async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const files = e.target.files;
		if (!files?.length || !userId) return;

		setUploading(true);
		let ok = 0;
		try {
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				const fd = new FormData();
				fd.set("file", file);
				fd.set("folderId", currentFolderId ?? "");
				const { error } = await uploadFileServer(fd);
				if (error) {
					toast.error(`Failed to upload ${file.name}: ${error}`);
					continue;
				}
				ok++;
			}
			if (ok > 0) {
				toast.success("Files uploaded");
				loadItems();
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setUploading(false);
		}
		e.target.value = "";
	}

	function openRenameDialog(item: FileItem) {
		setRenameItem(item);
		setRenameName(item.name);
		setRenameDialogOpen(true);
	}

	async function handleRename() {
		if (!renameItem || !renameName.trim()) return;
		const { error } = await renameFile(renameItem.id, renameName);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success("Renamed");
		setRenameDialogOpen(false);
		setRenameItem(null);
		setRenameName("");
		loadItems();
	}

	async function openPreview(item: FileItem) {
		if (item.is_folder) return;
		setPreviewItem(item);
		setPreviewDialogOpen(true);
		setPreviewContent("");
		setPreviewUrl(null);
		setPreviewError(null);
		setPreviewLoading(true);
		setPreviewEditMode(false);
		try {
			const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(item.name);
			const isVideo = /\.(mp4|webm|mov|avi|mkv|m4v|ogg)$/i.test(item.name);
			const isPdfOrDoc = /\.(pdf|doc|docx)$/i.test(item.name);
			if (isImage || isVideo || isPdfOrDoc) {
				const url = await getDownloadUrl(item.id);
				if (url) setPreviewUrl(url);
				else setPreviewError(isPdfOrDoc ? "Could not load document" : isVideo ? "Could not load video" : "Could not load image");
			} else {
				const { content, error } = await getFileContent(item.id);
				if (error) setPreviewError(error);
				else if (content !== null) setPreviewContent(content);
				else setPreviewError("Preview not available for this file");
			}
		} finally {
			setPreviewLoading(false);
		}
	}

	async function handlePreviewSave() {
		if (!previewItem || !previewEditMode) return;
		setPreviewSaving(true);
		const { error } = await saveFileContent(previewItem.id, previewContent);
		setPreviewSaving(false);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success("File saved");
		setPreviewEditMode(false);
	}

	function openDeleteDialog(item: FileItem) {
		setDeleteItem(item);
		setDeleteDialogOpen(true);
	}

	async function handleDelete() {
		if (!deleteItem) return;
		setDeleteLoading(true);
		const { error } = await deleteFile(deleteItem.id);
		setDeleteLoading(false);
		setDeleteDialogOpen(false);
		setDeleteItem(null);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success("Deleted");
		clearSelection();
		await loadItems();
		router.refresh();
	}

	async function handleBatchDelete() {
		const ids = Array.from(selectedIds);
		if (!ids.length) return;
		setBatchDeleteLoading(true);
		const { error, deleted } = await deleteFiles(ids);
		setBatchDeleteLoading(false);
		setBatchDeleteDialogOpen(false);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success(deleted === 1 ? "1 item deleted" : `${deleted} items deleted`);
		clearSelection();
		await loadItems();
		router.refresh();
	}

	async function handleDownload(id: string) {
		const url = await getDownloadUrl(id);
		if (url) {
			window.open(url, "_blank");
		} else {
			toast.error("Could not get download link");
		}
	}

	function openFolder(id: string, name: string) {
		setCurrentFolderId(id);
		setBreadcrumb((prev) => [...prev, { id, name }]);
	}

	function goToFolder(index: number) {
		const newCrumb = breadcrumb.slice(0, index + 1);
		setBreadcrumb(newCrumb);
		setCurrentFolderId(newCrumb.length ? newCrumb[newCrumb.length - 1].id : null);
	}

	function toggleSelect(itemId: string, ev?: React.MouseEvent) {
		ev?.stopPropagation();
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(itemId)) next.delete(itemId);
			else next.add(itemId);
			return next;
		});
	}

	function selectOnly(itemId: string) {
		setSelectedIds(new Set([itemId]));
	}

	function clearSelection() {
		setSelectedIds(new Set());
	}

	const selectedItems = items.filter((i) => selectedIds.has(i.id));
	const selectedFiles = selectedItems.filter((i) => !i.is_folder);
	const hasSelection = selectedIds.size > 0;

	async function handleDownloadAsZip(ids: string[]) {
		if (!ids.length) return;
		const fileItems = items.filter((i) => !i.is_folder && ids.includes(i.id));
		if (!fileItems.length) {
			toast.error("No files to compress");
			return;
		}
		const zip = new JSZip();
		try {
			for (const item of fileItems) {
				const url = await getDownloadUrl(item.id);
				if (!url) continue;
				const res = await fetch(url);
				const blob = await res.blob();
				zip.file(item.name, blob);
			}
			const content = await zip.generateAsync({ type: "blob" });
			const a = document.createElement("a");
			a.href = URL.createObjectURL(content);
			a.download = fileItems.length === 1 ? `${fileItems[0].name.replace(/\.[^/.]+$/, "")}.zip` : "files.zip";
			a.click();
			URL.revokeObjectURL(a.href);
			toast.success("Download started");
			clearSelection();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "ZIP download failed");
		}
	}

	async function handleMoveToFolder(targetId: string | null) {
		const toMove = selectedFiles.length ? selectedFiles : selectedItems.filter((i) => !i.is_folder);
		if (!toMove.length) {
			toast.error("Select files to move");
			return;
		}
		if (targetId === undefined) targetId = null;
		setMoveLoading(true);
		let ok = 0;
		for (const item of toMove) {
			if (item.folder_id === targetId) continue;
			const { error } = await moveFileToFolder(item.id, targetId);
			if (error) toast.error(`${item.name}: ${error}`);
			else ok++;
		}
		setMoveLoading(false);
		setMoveDialogOpen(false);
		setMoveTargetFolderId(null);
		if (ok > 0) {
			toast.success(ok === 1 ? "File moved" : `${ok} files moved`);
			clearSelection();
			loadItems();
		}
	}

	async function openMoveDialog() {
		if (!userId) return;
		const { data } = await loadAllFolders(userId);
		setAllFolders((data as { id: string; name: string; folder_id: string | null }[]) ?? []);
		setMoveTargetFolderId(currentFolderId);
		setMoveDialogOpen(true);
	}

	async function openUnzipDialog(item: FileItem) {
		if (!userId || item.is_folder) return;
		const ext = item.name.split(".").pop()?.toLowerCase();
		if (ext !== "zip") return;
		const { data } = await loadAllFolders(userId);
		setAllFolders((data as { id: string; name: string; folder_id: string | null }[]) ?? []);
		setUnzipItem(item);
		setUnzipTargetFolderId(currentFolderId);
		setUnzipDialogOpen(true);
	}

	async function handleUnzip() {
		if (!unzipItem) return;
		setUnzipLoading(true);
		const { error, extracted } = await unzipToFolder(unzipItem.id, unzipTargetFolderId);
		setUnzipLoading(false);
		setUnzipDialogOpen(false);
		setUnzipItem(null);
		setUnzipTargetFolderId(null);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success(`Extracted ${extracted} file(s)`);
		loadItems();
	}

	function handleCardClick(item: FileItem, ev: React.MouseEvent) {
		if ((ev.target as HTMLElement).closest("button, [role=button], [data-no-select]")) return;
		if (ev.ctrlKey || ev.metaKey) {
			toggleSelect(item.id, ev);
		} else {
			selectOnly(item.id);
		}
	}

	function handleGridClick(ev: React.MouseEvent) {
		const t = ev.target as HTMLElement;
		if (gridRef.current?.contains(t) && !t.closest("[data-file-card]")) clearSelection();
	}

	function handleDragStart(item: FileItem, ev: React.DragEvent) {
		if (item.is_folder) return;
		setDraggingId(item.id);
		ev.dataTransfer.setData("text/plain", item.id);
		ev.dataTransfer.effectAllowed = "move";
	}

	function handleDragOver(folder: FileItem, ev: React.DragEvent) {
		if (!folder.is_folder || !draggingId) return;
		ev.preventDefault();
		ev.dataTransfer.dropEffect = "move";
		setDropTargetId(folder.id);
	}

	function handleDragLeave(ev: React.DragEvent) {
		if (!(ev.currentTarget as HTMLElement).contains(ev.relatedTarget as Node)) {
			setDropTargetId(null);
		}
	}

	async function handleDrop(folder: FileItem, ev: React.DragEvent) {
		ev.preventDefault();
		setDropTargetId(null);
		setDraggingId(null);
		const id = ev.dataTransfer.getData("text/plain");
		if (!id || !folder.is_folder) return;
		const { error } = await moveFileToFolder(id, folder.id);
		if (error) toast.error(error);
		else {
			toast.success("File moved");
			loadItems();
		}
	}

	function handleDragEnd() {
		setDraggingId(null);
		setDropTargetId(null);
	}

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl font-bold tracking-tight">Files</h1>
					<p className="text-lg text-muted-foreground">
						Manage your files and folders
					</p>
				</div>
				<div className="flex gap-2">
					<Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
						<DialogTrigger asChild>
							<Button onClick={() => form.reset({ name: "" })}>
								<FolderPlus className="mr-2 h-4 w-4" />
								New Folder
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>New Folder</DialogTitle>
								<DialogDescription>Create a new folder</DialogDescription>
							</DialogHeader>
							<Form {...form}>
								<form onSubmit={form.handleSubmit(onSubmitFolder)} className="space-y-4">
									<FormField
										control={form.control}
										name="name"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Folder name</FormLabel>
												<FormControl>
													<Input placeholder="My folder" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<DialogFooter>
										<Button type="button" variant="outline" onClick={() => setFolderDialogOpen(false)}>
											Cancel
										</Button>
										<Button type="submit">Create</Button>
									</DialogFooter>
								</form>
							</Form>
						</DialogContent>
					</Dialog>
					<Button variant="outline" asChild disabled={uploading}>
						<label className="cursor-pointer">
							<Upload className="mr-2 h-4 w-4" />
							{uploading ? "Uploading..." : "Upload"}
							<input
								type="file"
								className="hidden"
								multiple
								accept="*/*"
								onChange={handleUpload}
							/>
						</label>
					</Button>
				</div>
			</div>

			{/* Breadcrumb */}
			{breadcrumb.length > 0 && (
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setBreadcrumb([]);
							setCurrentFolderId(null);
						}}
					>
						<ArrowLeft className="mr-1 h-4 w-4" />
						Root
					</Button>
					{breadcrumb.map((crumb, i) => (
						<Button
							key={crumb.id}
							variant="ghost"
							size="sm"
							onClick={() => goToFolder(i)}
						>
							/ {crumb.name}
						</Button>
					))}
				</div>
			)}

			{loading ? (
				<p className="text-muted-foreground">Loading...</p>
			) : items.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
						<p className="mb-4 text-muted-foreground">
							No files yet. Upload files or create a folder.
						</p>
						<div className="flex gap-2">
							<Button onClick={() => setFolderDialogOpen(true)}>
								<FolderPlus className="mr-2 h-4 w-4" />
								New Folder
							</Button>
							<Button variant="outline" asChild>
								<label className="cursor-pointer">
									<Upload className="mr-2 h-4 w-4" />
									Upload
									<input
										type="file"
										className="hidden"
										multiple
										accept="*/*"
										onChange={handleUpload}
									/>
								</label>
							</Button>
						</div>
					</CardContent>
				</Card>
			) : (
				<>
				{hasSelection && (
					<div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
						<span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
						{selectedFiles.length > 0 && (
							<>
								<Button size="sm" variant="outline" onClick={() => handleDownloadAsZip(Array.from(selectedIds))}>
									<Archive className="mr-1 h-4 w-4" />
									Download as ZIP
								</Button>
								<Button size="sm" variant="outline" onClick={openMoveDialog}>
									<FolderInput className="mr-1 h-4 w-4" />
									Move to folder
								</Button>
							</>
						)}
						<Button size="sm" variant="destructive" onClick={() => setBatchDeleteDialogOpen(true)}>
							<Trash2 className="mr-1 h-4 w-4" />
							Delete
						</Button>
						<Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
					</div>
				)}
				<div
					ref={gridRef}
					data-files-grid
					className="grid gap-2 md:grid-cols-2 lg:grid-cols-4"
					onClick={handleGridClick}
				>
					{items.map((item) => {
						const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(item.name);
						const isVideo = /\.(mp4|webm|mov|avi|mkv|m4v|ogg)$/i.test(item.name);
						const isPdfOrDoc = /\.(pdf|doc|docx)$/i.test(item.name);
						const isCode = /\b(js|ts|tsx|jsx|css|html|htm|php|blade|json|yaml|yml|xml|md|sql|py|rb|java|c|cpp|go|rs|sh|env|txt)$/i.test(item.name);
						const canPreview = !item.is_folder && (isImage || isVideo || isCode || isPdfOrDoc);
						const FileIconComponent = getFileIcon(item.name);
						return (
						<ContextMenu key={item.id}>
							<ContextMenuTrigger asChild>
								<Card
									data-file-card
									className={`group cursor-context-menu transition-opacity ${
										draggingId === item.id ? "opacity-50" : ""
									} ${dropTargetId === item.id ? "ring-2 ring-primary" : ""}`}
									onClick={(ev) => handleCardClick(item, ev)}
									draggable={!item.is_folder}
									onDragStart={(ev) => handleDragStart(item, ev)}
									onDragEnd={handleDragEnd}
									onDragOver={item.is_folder ? (ev) => handleDragOver(item, ev) : undefined}
									onDragLeave={item.is_folder ? handleDragLeave : undefined}
									onDrop={item.is_folder ? (ev) => handleDrop(item, ev) : undefined}
								>
									<CardContent className="flex items-center gap-3 p-4">
										<Checkbox
											checked={selectedIds.has(item.id)}
											onCheckedChange={() => toggleSelect(item.id)}
											onClick={(ev) => ev.stopPropagation()}
											className="shrink-0"
										/>
										{item.is_folder ? (
											<button
												type="button"
												className="flex flex-1 items-center gap-3 text-left min-w-0"
												onClick={(ev) => { ev.stopPropagation(); openFolder(item.id, item.name); }}
											>
												<FolderOpen className="h-8 w-8 shrink-0 text-amber-500" />
												<div className="min-w-0 flex-1">
													<p className="truncate font-medium">{item.name}</p>
													<p className="text-xs text-muted-foreground">Folder</p>
												</div>
											</button>
										) : (
											<div
												className={`flex flex-1 items-center gap-3 min-w-0 ${canPreview ? "cursor-pointer" : ""}`}
												onClick={(ev) => { ev.stopPropagation(); if (canPreview) openPreview(item); }}
												onKeyDown={(e) => { if (canPreview && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openPreview(item); } }}
												role={canPreview ? "button" : undefined}
												tabIndex={canPreview ? 0 : undefined}
											>
												<GripVertical className="h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden />
												<FileIconComponent className="h-8 w-8 shrink-0 text-muted-foreground" />
												<div className="min-w-0 flex-1">
													<p className="truncate font-medium">{item.name}</p>
													<p className="text-xs text-muted-foreground">
														{typeof item.size === "number" && item.size > 0
															? `${(item.size / 1024).toFixed(1)} KB`
															: "File"}
													</p>
												</div>
											</div>
										)}
									</CardContent>
								</Card>
							</ContextMenuTrigger>
						<ContextMenuContent>
							{item.is_folder ? (
								<ContextMenuItem onClick={() => openFolder(item.id, item.name)}>
									<FolderOpen className="mr-2 h-4 w-4" />
									Open
								</ContextMenuItem>
							) : (
								<>
									<ContextMenuItem onClick={() => openPreview(item)}>
										<Eye className="mr-2 h-4 w-4" />
										Preview
									</ContextMenuItem>
									<ContextMenuItem onClick={() => handleDownload(item.id)}>
										<Download className="mr-2 h-4 w-4" />
										Download
									</ContextMenuItem>
									<ContextMenuItem onClick={() => handleDownloadAsZip([item.id])}>
										<Archive className="mr-2 h-4 w-4" />
										Download as ZIP
									</ContextMenuItem>
									{/\.zip$/i.test(item.name) && (
										<ContextMenuItem onClick={() => openUnzipDialog(item)}>
											<FileArchive className="mr-2 h-4 w-4" />
											Unzip
										</ContextMenuItem>
									)}
									<ContextMenuItem onClick={() => { selectOnly(item.id); openMoveDialog(); }}>
										<FolderInput className="mr-2 h-4 w-4" />
										Move to folder
									</ContextMenuItem>
								</>
							)}
							<ContextMenuItem onClick={() => openRenameDialog(item)}>
								<Pencil className="mr-2 h-4 w-4" />
								Rename
							</ContextMenuItem>
							<ContextMenuItem className="text-destructive" onClick={() => openDeleteDialog(item)}>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
					);
					})}
				</div>
				</>
			)}

			{/* Rename Dialog */}
			<Dialog open={renameDialogOpen} onOpenChange={(o) => { setRenameDialogOpen(o); if (!o) setRenameItem(null); }}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Rename</DialogTitle>
						<DialogDescription>
							{renameItem?.is_folder ? "Enter new folder name" : "Enter new file name"}
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4 py-4">
						<Input
							value={renameName}
							onChange={(e) => setRenameName(e.target.value)}
							placeholder="Name"
							autoFocus
							onKeyDown={(e) => e.key === "Enter" && handleRename()}
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleRename} disabled={!renameName.trim()}>
							Rename
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Preview Dialog */}
			<Dialog open={previewDialogOpen} onOpenChange={(o) => { setPreviewDialogOpen(o); if (!o) setPreviewItem(null); setPreviewEditMode(false); }}>
				<DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col" aria-describedby={undefined}>
					<DialogHeader>
						<DialogTitle>{previewItem?.name ?? "Preview"}</DialogTitle>
						{previewItem && !previewItem.is_folder && (
							<div className="flex items-center gap-2 mt-1">
								{!previewUrl && !previewEditMode && (
									<Button size="sm" variant="outline" onClick={() => setPreviewEditMode(true)}>
										Edit
									</Button>
								)}
								{previewEditMode && (
									<>
										<Button size="sm" onClick={handlePreviewSave} disabled={previewSaving}>
											{previewSaving ? "Saving..." : "Save"}
										</Button>
										<Button size="sm" variant="outline" onClick={() => setPreviewEditMode(false)}>
											Cancel
										</Button>
									</>
								)}
								<Button size="sm" variant="outline" onClick={() => previewItem && handleDownload(previewItem.id)}>
									<Download className="h-4 w-4 mr-1" />
									Download
								</Button>
							</div>
						)}
					</DialogHeader>
					<div className="flex-1 min-h-0 overflow-auto">
						{previewLoading && <p className="text-muted-foreground py-8">Loading...</p>}
						{previewError && !previewLoading && <p className="text-destructive py-4">{previewError}</p>}
						{previewUrl && !previewLoading && (
							/\.(mp4|webm|mov|avi|mkv|m4v|ogg)$/i.test(previewItem?.name ?? "") ? (
								<video
									controls
									className="max-w-full rounded border"
									src={previewUrl}
								>
									Your browser does not support the video tag.
								</video>
							) : /\.(pdf|doc|docx)$/i.test(previewItem?.name ?? "") ? (
								<iframe
									src={previewUrl}
									title={previewItem?.name ?? "Document"}
									className="w-full min-h-[70vh] rounded border border-border"
								/>
							) : (
								// eslint-disable-next-line @next/next/no-img-element -- signed URL, dynamic
								<img src={previewUrl} alt={previewItem?.name ?? ""} className="max-w-full rounded border" />
							)
						)}
						{previewContent && !previewUrl && !previewLoading && (
							previewEditMode ? (
								<Textarea
									value={previewContent}
									onChange={(e) => setPreviewContent(e.target.value)}
									className="min-h-[400px] font-mono text-sm"
									spellCheck={false}
								/>
							) : (
								<div className="rounded overflow-auto max-h-[60vh] [&>pre]:!m-0 [&>pre]:!rounded [&>pre]:!p-4 [&>pre]:!text-sm">
									<SyntaxHighlighter
										language={getLanguageFromFileName(previewItem?.name ?? "")}
										style={oneDark}
										showLineNumbers
										wrapLongLines
										PreTag={({ children, ...props }: React.ComponentPropsWithoutRef<"pre"> & { preTag?: unknown }) => {
										const { preTag, ...preProps } = props as React.ComponentPropsWithoutRef<"pre"> & { preTag?: unknown };
										void preTag;
										return <pre {...preProps}>{children}</pre>;
									}}
										customStyle={{ margin: 0, borderRadius: "var(--radius)" }}
									>
										{previewContent}
									</SyntaxHighlighter>
								</div>
							)
						)}
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={(o) => { setDeleteDialogOpen(o); if (!o) setDeleteItem(null); }}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete {deleteItem?.is_folder ? "folder" : "file"}?</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete &quot;{deleteItem?.name}&quot;? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
							{deleteLoading ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Batch Delete Confirmation Dialog */}
			<Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""}?</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete the selected item{selectedIds.size !== 1 ? "s" : ""}? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setBatchDeleteDialogOpen(false)} disabled={batchDeleteLoading}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleBatchDelete} disabled={batchDeleteLoading}>
							{batchDeleteLoading ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Move to folder Dialog */}
			<Dialog open={moveDialogOpen} onOpenChange={(o) => { setMoveDialogOpen(o); if (!o) setMoveTargetFolderId(null); }}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Move to folder</DialogTitle>
						<DialogDescription>
							{selectedFiles.length ? `${selectedFiles.length} file(s)` : "Select target folder"}
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-64 overflow-auto space-y-1 py-2">
						<button
							type="button"
							className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${moveTargetFolderId === null ? "bg-muted" : ""}`}
							onClick={() => setMoveTargetFolderId(null)}
						>
							<FolderOpen className="h-5 w-5 text-amber-500" />
							Root
						</button>
						{allFolders.map((f) => (
								<button
									key={f.id}
									type="button"
									className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${moveTargetFolderId === f.id ? "bg-muted" : ""}`}
									onClick={() => setMoveTargetFolderId(f.id)}
								>
									<FolderOpen className="h-5 w-5 shrink-0 text-amber-500" />
									<span className="truncate">{f.name}</span>
								</button>
							))}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setMoveDialogOpen(false)} disabled={moveLoading}>
							Cancel
						</Button>
						<Button onClick={() => handleMoveToFolder(moveTargetFolderId ?? null)} disabled={moveLoading}>
							{moveLoading ? "Moving..." : "Move"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Unzip Dialog */}
			<Dialog open={unzipDialogOpen} onOpenChange={(o) => { setUnzipDialogOpen(o); if (!o) { setUnzipItem(null); setUnzipTargetFolderId(null); } }}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Unzip to folder</DialogTitle>
						<DialogDescription>
							Extract &quot;{unzipItem?.name}&quot; to:
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-64 overflow-auto space-y-1 py-2">
						<button
							type="button"
							className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${unzipTargetFolderId === null ? "bg-muted" : ""}`}
							onClick={() => setUnzipTargetFolderId(null)}
						>
							<FolderOpen className="h-5 w-5 text-amber-500" />
							Root
						</button>
						{allFolders.map((f) => (
							<button
								key={f.id}
								type="button"
								className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${unzipTargetFolderId === f.id ? "bg-muted" : ""}`}
								onClick={() => setUnzipTargetFolderId(f.id)}
							>
								<FolderOpen className="h-5 w-5 shrink-0 text-amber-500" />
								<span className="truncate">{f.name}</span>
							</button>
						))}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setUnzipDialogOpen(false)} disabled={unzipLoading}>
							Cancel
						</Button>
						<Button onClick={handleUnzip} disabled={unzipLoading}>
							{unzipLoading ? "Extracting..." : "Unzip"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}