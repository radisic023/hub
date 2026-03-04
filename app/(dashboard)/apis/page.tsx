"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	useSortable,
	arrayMove,
	rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Key, Plus, Pencil, Trash2, Eye, GripVertical } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	loadApis,
	createApi,
	updateApi,
	deleteApi,
	updateApiOrder,
	getDecryptedCode,
	type ApiInput,
} from "./actions";

const formSchema = z.object({
	type: z.enum(["simple", "header_body"]),
	name: z.string().min(1, "Name is required"),
	code: z.string(),
	headerCode: z.string(),
	bodyCode: z.string(),
});

type ApiFormValues = z.infer<typeof formSchema>;

type Api = {
	id: string;
	name: string;
	type: "simple" | "header_body";
	code_encrypted: string | null;
	header_code_encrypted: string | null;
	body_code_encrypted: string | null;
	header_display?: string | null;
	body_display?: string | null;
	code_display?: string | null;
	created_at: string;
};

function SortableApiCard({
	a,
	onCopy,
	onEdit,
	onDelete,
}: {
	a: Api;
	onCopy: (a: Api) => void;
	onEdit: (a: Api) => void;
	onDelete: (id: string) => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
		useSortable({ id: a.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<Card
			ref={setNodeRef}
			style={style}
			className={isDragging ? "opacity-50 shadow-lg" : ""}
		>
			<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
				<div className="flex items-center gap-2 min-w-0">
					<button
						type="button"
						className="cursor-grab active:cursor-grabbing touch-none p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0"
						{...listeners}
						{...attributes}
					>
						<GripVertical className="h-4 w-4" />
					</button>
					<CardTitle className="text-base truncate">{a.name}</CardTitle>
				</div>
				<div className="flex gap-1 shrink-0">
					<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCopy(a)} title="Copy code(s)">
						<Eye className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(a)}>
						<Pencil className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(a.id)}>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-3 text-sm">
					<p>
						<span className="text-muted-foreground">Type:</span>{" "}
						{a.type === "simple" ? "Simple" : "Header & Body"}
					</p>
					{a.type === "simple" ? (
						<div>
							<p className="text-muted-foreground mb-1.5 text-xs font-medium">Code</p>
							<pre className="rounded-lg border border-border/50 bg-muted/80 p-3 overflow-x-auto text-[13px] font-mono leading-relaxed">
								<code className="text-foreground">{a.code_display ?? "••••••••"}</code>
							</pre>
						</div>
					) : (
						<div className="space-y-3">
							{a.header_code_encrypted && (
								<div>
									<p className="text-muted-foreground mb-1.5 text-xs font-medium">Header</p>
									<pre className="rounded-lg border border-border/50 bg-muted/80 p-3 overflow-x-auto text-[13px] font-mono leading-relaxed whitespace-pre-wrap break-words">
										<code className="text-foreground">{a.header_display ?? "••••••••"}</code>
									</pre>
								</div>
							)}
							{a.body_code_encrypted && (
								<div>
									<p className="text-muted-foreground mb-1.5 text-xs font-medium">Body</p>
									<pre className="rounded-lg border border-border/50 bg-muted/80 p-3 overflow-x-auto text-[13px] font-mono leading-relaxed whitespace-pre-wrap break-words">
										<code className="text-foreground">{a.body_display ?? "••••••••"}</code>
									</pre>
								</div>
							)}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export default function ApisPage() {
	const router = useRouter();
	const [apis, setApis] = useState<Api[]>([]);
	const [loading, setLoading] = useState(true);
	const [open, setOpen] = useState(false);
	const [editId, setEditId] = useState<string | null>(null);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteApiId, setDeleteApiId] = useState<string | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);

	const form = useForm<ApiFormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			type: "simple",
			name: "",
			code: "",
			headerCode: "",
			bodyCode: "",
		},
	});

	const apiType = form.watch("type");

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	const loadData = useCallback(async () => {
		try {
			const { data } = await loadApis();
			setApis(data ?? []);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	async function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = apis.findIndex((a) => a.id === active.id);
		const newIndex = apis.findIndex((a) => a.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;
		const reordered = arrayMove(apis, oldIndex, newIndex);
		setApis(reordered);
		const { error } = await updateApiOrder(reordered.map((a) => a.id));
		if (error) {
			toast.error(error);
			setApis(apis);
		} else {
			toast.success("Order updated");
		}
	}

	async function onSubmit(values: ApiFormValues) {
		if (!editId) {
			// Create: require code fields
			if (values.type === "simple" && !values.code?.trim()) {
				toast.error("API code is required");
				return;
			}
			if (values.type === "header_body") {
				if (!values.headerCode?.trim() && !values.bodyCode?.trim()) {
					toast.error("At least one of Header code or Body code is required");
					return;
				}
			}
		}

		const input: ApiInput =
			values.type === "simple"
				? { type: "simple", name: values.name, code: values.code ?? "" }
				: {
						type: "header_body",
						name: values.name,
						headerCode: values.headerCode ?? "",
						bodyCode: values.bodyCode ?? "",
					};

		if (editId) {
			const updatePayload =
				values.type === "simple"
					? { name: values.name, ...(values.code?.trim() && { code: values.code }) }
					: {
							name: values.name,
							...(values.headerCode?.trim() && { headerCode: values.headerCode }),
							...(values.bodyCode?.trim() && { bodyCode: values.bodyCode }),
						};
			const { error } = await updateApi(editId, updatePayload);
			if (error) {
				toast.error(error);
				return;
			}
			toast.success("API updated");
		} else {
			const { error } = await createApi(input);
			if (error) {
				toast.error(error);
				return;
			}
			toast.success("API added");
		}

		setOpen(false);
		setEditId(null);
		form.reset({ type: "simple", name: "", code: "", headerCode: "", bodyCode: "" });
		router.refresh();
		await loadData();
	}

	function openEdit(a: Api) {
		setEditId(a.id);
		form.reset({
			type: a.type,
			name: a.name,
			code: "",
			headerCode: "",
			bodyCode: "",
		});
		setOpen(true);
	}

	function openDelete(id: string) {
		setDeleteApiId(id);
		setDeleteDialogOpen(true);
	}

	async function handleDeleteConfirm() {
		if (!deleteApiId) return;
		setDeleteLoading(true);
		const { error } = await deleteApi(deleteApiId);
		setDeleteLoading(false);
		setDeleteDialogOpen(false);
		setDeleteApiId(null);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success("API deleted");
		router.refresh();
		await loadData();
	}

	async function handleCopyCode(a: Api) {
		const decrypted = await getDecryptedCode(a.id);
		if (!decrypted) {
			toast.error("Could not get API code");
			return;
		}
		if (a.type === "simple" && decrypted.code) {
			await navigator.clipboard.writeText(decrypted.code);
			toast.success("Code copied");
		} else if (a.type === "header_body" && (decrypted.headerCode || decrypted.bodyCode)) {
			const parts: string[] = [];
			if (decrypted.headerCode) parts.push(`Header:\n${decrypted.headerCode}`);
			if (decrypted.bodyCode) parts.push(`Body:\n${decrypted.bodyCode}`);
			await navigator.clipboard.writeText(parts.join("\n\n"));
			toast.success("Code(s) copied");
		}
	}

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl font-bold tracking-tight">APIs</h1>
					<p className="text-muted-foreground text-lg">
						API keys – simple (name + code) or header + body
					</p>
				</div>
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button
							onClick={() => {
								setEditId(null);
								form.reset({ type: "simple", name: "", code: "", headerCode: "", bodyCode: "" });
							}}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add API
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-lg">
						<DialogHeader>
							<DialogTitle>{editId ? "Edit API" : "Add API"}</DialogTitle>
							<DialogDescription>
								{editId
									? "Leave code fields blank to keep current. Name can be updated."
									: "Simple: name + one code. Header & Body: name + at least one of header or body code."}
							</DialogDescription>
						</DialogHeader>
						<Form {...form}>
							<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
								<FormField
									control={form.control}
									name="type"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Type</FormLabel>
											<Select
												onValueChange={(v) => field.onChange(v as "simple" | "header_body")}
												value={field.value}
												disabled={!!editId}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="simple">Simple (name + code)</SelectItem>
													<SelectItem value="header_body">Header & Body</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input placeholder="My API" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								{apiType === "simple" && (
									<FormField
										control={form.control}
										name="code"
										render={({ field }) => (
											<FormItem>
												<FormLabel>API Code</FormLabel>
												<FormControl>
													<Textarea
														placeholder="Paste your API key or code..."
														className="min-h-[100px] font-mono text-sm"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								)}
								{apiType === "header_body" && (
									<>
										<FormField
											control={form.control}
											name="headerCode"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Header code</FormLabel>
													<FormControl>
														<Textarea
															placeholder="Code that goes in header (e.g. Authorization)"
															className="min-h-[80px] font-mono text-sm"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="bodyCode"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Body code</FormLabel>
													<FormControl>
														<Textarea
															placeholder="Code that goes in body"
															className="min-h-[80px] font-mono text-sm"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</>
								)}
								<DialogFooter>
									<Button type="button" variant="outline" onClick={() => setOpen(false)}>
										Cancel
									</Button>
									<Button type="submit">{editId ? "Update" : "Create"}</Button>
								</DialogFooter>
							</form>
						</Form>
					</DialogContent>
				</Dialog>
			</div>

			{loading ? (
				<p className="text-muted-foreground">Loading...</p>
			) : apis.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<Key className="mb-4 h-12 w-12 text-muted-foreground" />
						<p className="text-muted-foreground">
							No APIs yet. Add your first API key.
						</p>
					</CardContent>
				</Card>
			) : (
				<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
					<SortableContext items={apis.map((a) => a.id)} strategy={rectSortingStrategy}>
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{apis.map((a) => (
								<SortableApiCard
									key={a.id}
									a={a}
									onCopy={handleCopyCode}
									onEdit={openEdit}
									onDelete={openDelete}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}

			<Dialog open={deleteDialogOpen} onOpenChange={(o) => { setDeleteDialogOpen(o); if (!o) setDeleteApiId(null); }}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete API?</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this API? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteLoading}>
							{deleteLoading ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
