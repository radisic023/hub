"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loadProfiles, createUser, deleteUser } from "./actions";
import { getInitials } from "@/lib/hooks/use-profile";
import { useProfileContext } from "@/components/providers/profile-provider";

type Profile = {
	id: string;
	username: string;
	email: string;
	first_name: string;
	last_name: string;
	role: string;
};

const formSchema = z.object({
	first_name: z.string().min(1, "First name is required"),
	last_name: z.string().min(1, "Last name is required"),
	email: z.string().email("Invalid email"),
	password: z.string().min(6, "Password must be at least 6 characters"),
	role: z.enum(["admin", "editor", "viewer"]),
});

export default function UsersPage() {
	const router = useRouter();
	const { userId } = useProfileContext();
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
	const [loading, setLoading] = useState(true);
	const [open, setOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
	const [deleteUserLoading, setDeleteUserLoading] = useState(false);
	const [search, setSearch] = useState("");

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			first_name: "",
			last_name: "",
			email: "",
			password: "",
			role: "viewer",
		},
	});

	const loadData = useCallback(async () => {
		try {
			const { data, profile } = await loadProfiles();
			setProfiles(data ?? []);
			setCurrentProfile(profile ?? null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	async function onSubmit(values: z.infer<typeof formSchema>) {
		const { error } = await createUser(values);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success("User created");
		setOpen(false);
		form.reset({
			first_name: "",
			last_name: "",
			email: "",
			password: "",
			role: "viewer",
		});
		router.refresh();
		await loadData();
	}

	function openDeleteDialog(id: string) {
		setDeleteUserId(id);
		setDeleteDialogOpen(true);
	}

	async function handleDeleteConfirm() {
		if (!deleteUserId) return;
		setDeleteUserLoading(true);
		const { error } = await deleteUser(deleteUserId);
		setDeleteUserLoading(false);
		setDeleteDialogOpen(false);
		setDeleteUserId(null);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success("User deleted");
		router.refresh();
		await loadData();
	}

	const filtered =
		search.trim() === ""
			? profiles
			: profiles.filter(
					(p) =>
						p.first_name.toLowerCase().includes(search.toLowerCase()) ||
						p.last_name.toLowerCase().includes(search.toLowerCase()) ||
						p.email.toLowerCase().includes(search.toLowerCase()) ||
						p.username.toLowerCase().includes(search.toLowerCase()),
				);

	const isAdmin = currentProfile?.role === "admin";

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-4xl font-bold tracking-tight">Users</h1>
				<p className="text-lg text-muted-foreground">
					Manage user accounts and permissions
				</p>
			</div>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle>All Users</CardTitle>
					{isAdmin && (
						<Dialog open={open} onOpenChange={setOpen}>
							<DialogTrigger asChild>
								<Button
									size="sm"
									onClick={() =>
										form.reset({
											first_name: "",
											last_name: "",
											email: "",
											password: "",
											role: "viewer",
										})
									}
								>
									<Plus className="mr-2 h-4 w-4" />
									Add User
								</Button>
							</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Add User</DialogTitle>
								<DialogDescription>
									Create a new user account with role-based access
								</DialogDescription>
							</DialogHeader>
							<Form {...form}>
								<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<FormField
											control={form.control}
											name="first_name"
											render={({ field }) => (
												<FormItem>
													<FormLabel>First Name</FormLabel>
													<FormControl>
														<Input placeholder="John" {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="last_name"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Last Name</FormLabel>
													<FormControl>
														<Input placeholder="Doe" {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>
									<FormField
										control={form.control}
										name="email"
										render={({ field }) => (
											<FormItem>
												<FormLabel>E-mail</FormLabel>
												<FormControl>
													<Input
														type="email"
														placeholder="john@example.com"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="password"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Password</FormLabel>
												<FormControl>
													<Input type="password" placeholder="••••••••" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="role"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Role</FormLabel>
												<Select onValueChange={field.onChange} defaultValue={field.value}>
													<FormControl>
														<SelectTrigger>
															<SelectValue />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="admin">Admin</SelectItem>
														<SelectItem value="editor">Editor</SelectItem>
														<SelectItem value="viewer">Viewer</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
									<DialogFooter>
										<Button type="button" variant="outline" onClick={() => setOpen(false)}>
											Cancel
										</Button>
										<Button type="submit">Create</Button>
									</DialogFooter>
								</form>
							</Form>
						</DialogContent>
					</Dialog>
				)}
				</CardHeader>
				<CardContent className="p-4">
					<div className="relative mb-4">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search users..."
							className="pl-8"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					{loading ? (
						<p className="text-muted-foreground">Loading...</p>
					) : filtered.length === 0 ? (
						<p className="text-muted-foreground">No users found</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>User</TableHead>
									<TableHead>Username</TableHead>
									<TableHead>Role</TableHead>
									{isAdmin && <TableHead className="text-right">Actions</TableHead>}
								</TableRow>
							</TableHeader>
							<TableBody>
								{filtered.map((p) => (
									<TableRow key={p.id}>
										<TableCell>
											<div className="flex items-center gap-3">
												<Avatar className="h-8 w-8">
													<AvatarImage src="/avatar.png" alt={p.first_name} />
													<AvatarFallback className="bg-primary text-primary-foreground">
														{getInitials(p.first_name, p.last_name)}
													</AvatarFallback>
												</Avatar>
												<div>
													<div className="font-medium">
														{p.first_name} {p.last_name}
													</div>
													<div className="text-sm text-muted-foreground">
														{p.email}
													</div>
												</div>
											</div>
										</TableCell>
										<TableCell>{p.username}</TableCell>
										<TableCell>
											<Badge
												variant={p.role === "admin" ? "default" : "secondary"}
											>
												{p.role}
											</Badge>
										</TableCell>
										{isAdmin && (
											<TableCell className="text-right">
												<Button
													variant="ghost"
													size="icon"
													className="text-destructive"
													onClick={() => openDeleteDialog(p.id)}
													disabled={p.id === (currentProfile?.id ?? userId)}
													title={p.id === (currentProfile?.id ?? userId) ? "Cannot delete yourself" : "Delete user"}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</TableCell>
										)}
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Dialog open={deleteDialogOpen} onOpenChange={(o) => { setDeleteDialogOpen(o); if (!o) setDeleteUserId(null); }}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete user?</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this user? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteUserLoading}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteUserLoading}>
							{deleteUserLoading ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
