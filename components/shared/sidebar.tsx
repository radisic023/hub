"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
	LayoutDashboard,
	Users,
	FolderOpen,
	ListTodo,
	CreditCard,
	Server,
	Key,
	Settings,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfileContext } from "@/components/providers/profile-provider";
import { getInitials } from "@/lib/hooks/use-profile";

const sidebarItems = [
	{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
	{ title: "Files", href: "/files", icon: FolderOpen },
	{ title: "To-Do", href: "/todo", icon: ListTodo },
	{ title: "Accounts", href: "/accounts", icon: CreditCard },
	{ title: "Machines", href: "/machines", icon: Server },
	{ title: "APIs", href: "/apis", icon: Key },
	{ title: "Users", href: "/users", icon: Users },
	{ title: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
	siteTitle?: string;
	isCollapsed?: boolean;
	onCollapseToggle?: () => void;
	variant?: "inline" | "drawer";
	onMobileClose?: () => void;
}

export function Sidebar({
	siteTitle = "Radisic Storage",
	isCollapsed = false,
	onCollapseToggle,
	variant = "inline",
	onMobileClose,
}: SidebarProps) {
	const pathname = usePathname();
	const { profile } = useProfileContext();
	const isDrawer = variant === "drawer";
	const initials = profile
		? getInitials(profile.first_name, profile.last_name, profile.username || profile.email)
		: "?";

	const handleLinkClick = () => {
		onMobileClose?.();
	};

	return (
		<div
			className={cn(
				"flex h-full flex-col border-r border-border bg-card shadow-sm",
				!isDrawer && "transition-all duration-300",
				!isDrawer && (isCollapsed ? "w-16" : "w-72"),
				isDrawer && "w-full",
			)}
		>
			{/* Header */}
			<div
				className={cn(
					"flex h-16 shrink-0 items-center border-b border-border px-3",
					isDrawer ? "justify-between pr-12" : isCollapsed ? "justify-center gap-1" : "justify-between gap-2",
				)}
			>
				<Link
					href="/dashboard"
					onClick={handleLinkClick}
					className={cn(
						"flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90",
						!isDrawer && isCollapsed && "min-w-0 flex-none",
					)}
				>
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
						<LayoutDashboard className="h-4 w-4 text-primary-foreground" />
					</div>
					{(!isCollapsed || isDrawer) && (
						<span className="truncate text-base font-semibold">
							{siteTitle}
						</span>
					)}
				</Link>
				{!isDrawer && onCollapseToggle && (
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0 hover:bg-muted"
						onClick={onCollapseToggle}
						aria-label={isCollapsed ? "Proširi meni" : "Skupi meni"}
					>
						{isCollapsed ? (
							<ChevronRight className="h-4 w-4" />
						) : (
							<ChevronLeft className="h-4 w-4" />
						)}
					</Button>
				)}
			</div>

			{/* Navigation */}
			<nav className="flex-1 space-y-1 overflow-y-auto p-2 md:p-3">
				{sidebarItems.map((item) => {
					const isActive =
						pathname === item.href ||
						(item.href !== "/dashboard" && pathname.startsWith(item.href));
					const Icon = item.icon;

					return (
						<Link
							key={item.href}
							href={item.href}
							onClick={handleLinkClick}
							className={cn(
								"flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
								isActive
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
								(!isCollapsed || isDrawer) ? "gap-3" : "justify-center px-2",
							)}
							title={isCollapsed && !isDrawer ? item.title : undefined}
						>
							<Icon className="h-4 w-4 shrink-0" />
							{(!isCollapsed || isDrawer) && (
								<span className="truncate">{item.title}</span>
							)}
						</Link>
					);
				})}
			</nav>

			{/* User avatar at bottom */}
			<div className="shrink-0 border-t border-border p-3">
				{(!isCollapsed || isDrawer) ? (
					<div className="flex items-center gap-2 rounded-lg px-2 py-2">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
							{initials}
						</div>
						<span className="truncate text-xs text-muted-foreground">
							{profile ? `${profile.first_name} ${profile.last_name}` : "Korisnik"}
						</span>
					</div>
				) : (
					<div className="flex justify-center">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
							{initials}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
