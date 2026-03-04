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
import { toast } from "sonner";
import { Server, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	loadMachines,
	createMachine,
	updateMachine,
	deleteMachine,
	getDecryptedPassword,
	type MachineInput,
} from "./actions";

const formSchema = z.object({
	title: z.string().optional(),
	hostname: z.string().min(1, "Hostname is required"),
	username: z.string().min(1, "Username is required"),
	password: z.string().min(1, "Password is required"),
	port: z.coerce.number().min(1, "Port is required").max(65535),
});

type Machine = {
	id: string;
	title: string | null;
	hostname: string;
	username: string;
	password_encrypted: string;
	port: number;
	created_at: string;
};

export default function MachinesPage() {
	const router = useRouter();
	const [machines, setMachines] = useState<Machine[]>([]);
	const [loading, setLoading] = useState(true);
	const [open, setOpen] = useState(false);
	const [editId, setEditId] = useState<string | null>(null);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteMachineId, setDeleteMachineId] = useState<string | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			title: "",
			hostname: "",
			username: "",
			password: "",
			port: 22,
		},
	});

	const loadData = useCallback(async () => {
		try {
			const { data } = await loadMachines();
			setMachines(data ?? []);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	async function onSubmit(values: z.infer<typeof formSchema>) {
		const input: MachineInput = {
			title: values.title?.trim() || null,
			hostname: values.hostname,
			username: values.username,
			password: values.password,
			port: values.port,
		};

		if (editId) {
			const { error } = await updateMachine(editId, input);
			if (error) {
				toast.error(error);
				return;
			}
			toast.success("Server updated");
		} else {
			const { error } = await createMachine(input);
			if (error) {
				toast.error(error);
				return;
			}
			toast.success("Server added");
		}

		setOpen(false);
		setEditId(null);
		form.reset({ title: "", hostname: "", username: "", password: "", port: 22 });
		router.refresh();
		await loadData();
	}

	function openEdit(m: Machine) {
		setEditId(m.id);
		form.reset({
			title: m.title ?? "",
			hostname: m.hostname,
			username: m.username,
			password: "",
			port: m.port,
		});
		setOpen(true);
	}

	function openDelete(id: string) {
		setDeleteMachineId(id);
		setDeleteDialogOpen(true);
	}

	async function handleDeleteConfirm() {
		if (!deleteMachineId) return;
		setDeleteLoading(true);
		const { error } = await deleteMachine(deleteMachineId);
		setDeleteLoading(false);
		setDeleteDialogOpen(false);
		setDeleteMachineId(null);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success("Server deleted");
		router.refresh();
		await loadData();
	}

	async function handleCopyPassword(id: string) {
		const pwd = await getDecryptedPassword(id);
		if (pwd) {
			await navigator.clipboard.writeText(pwd);
			toast.success("Password copied to clipboard");
		} else {
			toast.error("Could not get password");
		}
	}

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl font-bold tracking-tight">Machines</h1>
					<p className="text-muted-foreground text-lg">
						Manage your servers (SSH, hosting, etc.)
					</p>
				</div>
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button
							onClick={() => {
								setEditId(null);
								form.reset({ title: "", hostname: "", username: "", password: "", port: 22 });
							}}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Server
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{editId ? "Edit Server" : "Add Server"}
							</DialogTitle>
							<DialogDescription>
								Title is optional; hostname, credentials and port (default 22 for SSH)
							</DialogDescription>
						</DialogHeader>
						<Form {...form}>
							<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
								<FormField
									control={form.control}
									name="title"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Title (optional)</FormLabel>
											<FormControl>
												<Input placeholder="e.g. Production server" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="hostname"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Hostname</FormLabel>
											<FormControl>
												<Input placeholder="example.com or 192.168.1.1" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="username"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Username</FormLabel>
											<FormControl>
												<Input placeholder="root" {...field} />
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
									name="port"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Port</FormLabel>
											<FormControl>
												<Input type="number" min={1} max={65535} {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<DialogFooter>
									<Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
			) : machines.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<Server className="mb-4 h-12 w-12 text-muted-foreground" />
						<p className="text-muted-foreground">
							No servers yet. Add your first server.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{machines.map((m) => (
						<Card key={m.id}>
							<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
								<CardTitle className="text-base">{m.title?.trim() || m.hostname}</CardTitle>
								<div className="flex gap-1">
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onClick={() => handleCopyPassword(m.id)}
										title="Copy password"
									>
										<Eye className="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onClick={() => openEdit(m)}
									>
										<Pencil className="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-destructive"
										onClick={() => openDelete(m.id)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</CardHeader>
							<CardContent>
								<div className="space-y-2 text-sm">
									{m.title?.trim() && (
										<p>
											<span className="text-muted-foreground">Hostname:</span> {m.hostname}
										</p>
									)}
									<p>
										<span className="text-muted-foreground">Username:</span> {m.username}
									</p>
									<p>
										<span className="text-muted-foreground">Port:</span> {m.port}
									</p>
									<p className="text-muted-foreground">Password: ••••••••</p>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<Dialog open={deleteDialogOpen} onOpenChange={(o) => { setDeleteDialogOpen(o); if (!o) setDeleteMachineId(null); }}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete server?</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this server? This action cannot be undone.
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
