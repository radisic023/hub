import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, ListTodo, CheckCircle2, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

async function getDashboardStats(userId: string) {
	const supabase = await createClient();

	const [filesRes, todosRes, accountsRes] = await Promise.all([
		supabase.from("files_metadata").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_folder", false),
		supabase.from("todo_items").select("id, done", { count: "exact" }).eq("user_id", userId),
		supabase.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", userId),
	]);

	const activeTodos = (todosRes.data ?? []).filter((t) => !t.done).length;
	const completedTodos = (todosRes.data ?? []).filter((t) => t.done).length;

	return {
		files: filesRes.count ?? 0,
		active: activeTodos,
		completed: completedTodos,
		accounts: accountsRes.count ?? 0,
	};
}

export default async function DashboardPage() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) {
		return null;
	}

	const stats = await getDashboardStats(user.id);

	const cards = [
		{
			title: "Files",
			value: stats.files.toString(),
			description: "Total files in storage",
			icon: FolderOpen,
			href: "/files",
		},
		{
			title: "Active",
			value: stats.active.toString(),
			description: "Items to complete",
			icon: ListTodo,
			href: "/todo",
		},
		{
			title: "Completed",
			value: stats.completed.toString(),
			description: "Tasks done",
			icon: CheckCircle2,
			href: "/todo",
		},
		{
			title: "Accounts",
			value: stats.accounts.toString(),
			description: "Hosting accounts",
			icon: CreditCard,
			href: "/accounts",
		},
	];

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-2">
				<h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
				<p className="text-lg text-muted-foreground">
					Welcome back! Here&apos;s an overview of your data.
				</p>
			</div>

			<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
				{cards.map((stat) => {
					const Icon = stat.icon;
					return (
						<Link key={stat.title} href={stat.href}>
							<Card className="group transition-all duration-200 hover:shadow-lg">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
									<CardTitle className="text-sm font-medium text-muted-foreground">
										{stat.title}
									</CardTitle>
									<div className="rounded-lg bg-muted p-2 transition-colors group-hover:bg-primary/10">
										<Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
									</div>
								</CardHeader>
								<CardContent className="pt-0">
									<div className="mb-2 text-3xl font-bold">{stat.value}</div>
									<p className="text-sm leading-relaxed text-muted-foreground">
										{stat.description}
									</p>
								</CardContent>
							</Card>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
