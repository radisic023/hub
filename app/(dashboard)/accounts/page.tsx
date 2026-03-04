"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CreditCard, Plus, Pencil, Trash2, Eye, GripVertical } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	loadAccounts,
	createAccount,
	updateAccount,
	deleteAccount,
	updateAccountOrder,
	getDecryptedPassword,
} from "./actions";

const formSchema = z
	.object({
		link: z.string().min(1, "Link is required"),
		type: z.enum(["username", "email"]),
		username: z.string().optional(),
		email: z.string().email().optional().or(z.literal("")),
		password: z.string().optional(),
	})
	.refine(
		(data) =>
			data.type === "username"
				? !!data.username?.trim()
				: !!data.email?.trim(),
		{
			message: "Username or E-mail is required",
			path: ["username"],
		},
	);

type Account = {
	id: string;
	link: string;
	username: string | null;
	email: string | null;
	password_encrypted: string;
	icon_url: string | null;
	sort_order?: number;
	created_at: string;
};

function SortableAccountCard({
	a,
	onCopy,
	onEdit,
	onDelete,
}: {
	a: Account;
	onCopy: (id: string) => void;
	onEdit: (a: Account) => void;
	onDelete: (id: string) => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
		useSortable({ id: a.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<Card ref={setNodeRef} style={style} className={isDragging ? "opacity-50 shadow-lg" : ""}>
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
					<div className="flex items-center gap-2 min-w-0 flex-1">
						<div className="relative h-8 w-8 shrink-0 flex items-center justify-center bg-muted rounded">
							{a.icon_url ? (
								// eslint-disable-next-line @next/next/no-img-element -- account icon from storage
								<img
									src={a.icon_url}
									alt=""
									className="h-5.5 w-5.5"
									onError={(e) => {
										e.currentTarget.style.display = "none";
										const fallback = e.currentTarget.nextElementSibling;
										if (fallback) (fallback as HTMLElement).style.display = "flex";
									}}
								/>
							) : null}
							<span
								className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary"
								style={a.icon_url ? { display: "none" } : undefined}
								aria-hidden
							>
								{a.link.charAt(0).toUpperCase()}
							</span>
						</div>
						<CardTitle className="text-base truncate">{a.link}</CardTitle>
					</div>
				</div>
				<div className="flex gap-1 shrink-0">
					<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCopy(a.id)} title="Copy password">
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
				<div className="space-y-2 text-sm">
					<p>
						<span className="text-muted-foreground">
							{a.username ? "Username" : "E-mail"}:
						</span>{" "}
						{a.username ?? a.email}
					</p>
					<p className="text-muted-foreground">Password: ••••••••</p>
				</div>
			</CardContent>
		</Card>
	);
}

export default function AccountsPage() {
	const router = useRouter();
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [loading, setLoading] = useState(true);
	const [open, setOpen] = useState(false);
	const [editId, setEditId] = useState<string | null>(null);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
	const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
	const iconInputRef = useRef<HTMLInputElement>(null);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			link: "",
			type: "username",
			username: "",
			email: "",
			password: "",
		},
	});

	const loadData = useCallback(async () => {
		try {
			const { data } = await loadAccounts();
			setAccounts(data ?? []);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	async function onSubmit(values: z.infer<typeof formSchema>) {
		if (!editId && !values.password?.trim()) {
			toast.error("Password is required");
			return;
		}
		const formData = new FormData();
		formData.set("link", values.link);
		formData.set("username", values.type === "username" ? (values.username ?? "") : "");
		formData.set("email", values.type === "email" ? (values.email ?? "") : "");
		formData.set("password", values.password?.trim() ?? "");
		const iconFile = iconInputRef.current?.files?.[0];
		if (iconFile) formData.set("icon", iconFile);

		if (editId) {
			const { error } = await updateAccount(editId, formData);
			if (error) {
				toast.error(error);
				return;
			}
			toast.success("Account updated");
		} else {
			const { error } = await createAccount(formData);
			if (error) {
				toast.error(error);
				return;
			}
			toast.success("Account created");
		}

		setOpen(false);
		setEditId(null);
		if (iconInputRef.current) iconInputRef.current.value = "";
		form.reset({ link: "", type: "username", username: "", email: "", password: "" });
		router.refresh();
		await loadData();
	}

	function openDeleteDialog(id: string) {
		setDeleteAccountId(id);
		setDeleteDialogOpen(true);
	}

	async function handleDeleteConfirm() {
		if (!deleteAccountId) return;
		setDeleteAccountLoading(true);
		const { error } = await deleteAccount(deleteAccountId);
		setDeleteAccountLoading(false);
		setDeleteDialogOpen(false);
		setDeleteAccountId(null);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success("Account deleted");
		router.refresh();
		await loadData();
	}

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	async function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = accounts.findIndex((a) => a.id === active.id);
		const newIndex = accounts.findIndex((a) => a.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;
		const reordered = arrayMove(accounts, oldIndex, newIndex);
		setAccounts(reordered);
		const { error } = await updateAccountOrder(reordered.map((a) => a.id));
		if (error) {
			toast.error(error);
			setAccounts(accounts);
		}
	}

	async function handleShowPassword(id: string) {
		const pwd = await getDecryptedPassword(id);
		if (pwd) {
			await navigator.clipboard.writeText(pwd);
			toast.success("Password copied to clipboard");
		} else {
			toast.error("Could not get password");
		}
	}

	function openEdit(a: Account) {
		setEditId(a.id);
		form.reset({
			link: a.link,
			type: a.username ? "username" : "email",
			username: a.username ?? "",
			email: a.email ?? "",
			password: "",
		});
		if (iconInputRef.current) iconInputRef.current.value = "";
		setOpen(true);
	}

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl font-bold tracking-tight">Accounts</h1>
					<p className="text-muted-foreground text-lg">
						Manage your hosting and service accounts
					</p>
				</div>
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button
							onClick={() => {
								setEditId(null);
								if (iconInputRef.current) iconInputRef.current.value = "";
								form.reset({
									link: "",
									type: "username",
									username: "",
									email: "",
									password: "",
								});
							}}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Account
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{editId ? "Edit Account" : "Add Account"}
							</DialogTitle>
							<DialogDescription>
								Enter the link (e.g. youtube.com, forum.com) and credentials
							</DialogDescription>
						</DialogHeader>
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								className="space-y-4"
							>
								<FormField
									control={form.control}
									name="link"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Link</FormLabel>
											<FormControl>
												<Input placeholder="youtube.com" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormItem>
									<FormLabel>Icon / logo (optional)</FormLabel>
									<Input
										ref={iconInputRef}
										type="file"
										accept="image/*"
										className="cursor-pointer"
									/>
									<p className="text-xs text-muted-foreground">PNG, JPG, GIF, WebP, SVG</p>
								</FormItem>
								<FormField
									control={form.control}
									name="type"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Credential Type</FormLabel>
											<Select
												onValueChange={field.onChange}
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="username">Username</SelectItem>
													<SelectItem value="email">E-mail</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
								{form.watch("type") === "username" ? (
									<FormField
										control={form.control}
										name="username"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Username</FormLabel>
												<FormControl>
													<Input placeholder="rade023" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								) : (
									<FormField
										control={form.control}
										name="email"
										render={({ field }) => (
											<FormItem>
												<FormLabel>E-mail</FormLabel>
												<FormControl>
													<Input
														placeholder="test@example.com"
														type="email"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								)}
								<FormField
									control={form.control}
									name="password"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Password</FormLabel>
											<FormControl>
												<Input
													type="password"
													placeholder="••••••••"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<DialogFooter>
									<Button
										type="button"
										variant="outline"
										onClick={() => setOpen(false)}
									>
										Cancel
									</Button>
									<Button type="submit">
										{editId ? "Update" : "Create"}
									</Button>
								</DialogFooter>
							</form>
						</Form>
					</DialogContent>
				</Dialog>
			</div>

			{loading ? (
				<p className="text-muted-foreground">Loading...</p>
			) : accounts.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<CreditCard className="mb-4 h-12 w-12 text-muted-foreground" />
						<p className="text-muted-foreground">
							No accounts yet. Add your first account.
						</p>
					</CardContent>
				</Card>
			) : (
				<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
					<SortableContext
						items={accounts.map((a) => a.id)}
						strategy={rectSortingStrategy}
					>
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{accounts.map((a) => (
								<SortableAccountCard
									key={a.id}
									a={a}
									onCopy={handleShowPassword}
									onEdit={openEdit}
									onDelete={openDeleteDialog}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}

			<Dialog open={deleteDialogOpen} onOpenChange={(o) => { setDeleteDialogOpen(o); if (!o) setDeleteAccountId(null); }}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete account?</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this account? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteAccountLoading}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteAccountLoading}>
							{deleteAccountLoading ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
