"use client";

import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useProfileContext } from "@/components/providers/profile-provider";
import { getInitials, useProfile } from "@/lib/hooks/use-profile";
import { signOut } from "@/lib/auth";

export function Topbar({ onMobileMenuClick }: { onMobileMenuClick?: () => void } = {}) {
	const router = useRouter();
	const { profile: ctxProfile } = useProfileContext();
	const { profile: clientProfile } = useProfile();
	// Use context profile first, fallback to client fetch (when server layout misses session)
	const profile = ctxProfile ?? clientProfile;

	async function handleLogout() {
		await signOut();
		router.push("/login");
		router.refresh();
	}

	const initials = profile
		? getInitials(
				profile.first_name,
				profile.last_name,
				profile.username || profile.email
		  )
		: "?";

	return (
		<div className="flex h-16 items-center justify-between border-b px-4 md:px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			{onMobileMenuClick && (
				<Button
					variant="ghost"
					size="icon"
					className="md:hidden h-9 w-9 shrink-0"
					onClick={onMobileMenuClick}
					aria-label="Otvori meni"
				>
					<Menu className="h-5 w-5" />
				</Button>
			)}
			<div className="flex flex-1 justify-end items-center gap-3">
				<ThemeToggle />

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							className="relative h-9 w-9 rounded-full transition-colors hover:bg-muted"
						>
							<Avatar className="h-8 w-8 ring-2 ring-background">
								<AvatarImage src="/avatar.png" alt="User" />
								<AvatarFallback className="bg-primary font-semibold text-primary-foreground">
									{initials}
								</AvatarFallback>
							</Avatar>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-64 p-2" align="end" forceMount>
						<DropdownMenuLabel className="p-3 font-normal">
							<div className="flex items-center gap-3">
								<Avatar className="h-10 w-10">
									<AvatarImage src="/avatar.png" alt="User" />
									<AvatarFallback className="bg-primary text-primary-foreground">
										{initials}
									</AvatarFallback>
								</Avatar>
								<div className="flex flex-col space-y-1">
									<p className="text-sm font-medium leading-none">
										{profile
											? `${profile.first_name} ${profile.last_name}`
											: "User"}
									</p>
									<p className="text-xs leading-none text-muted-foreground">
										{profile?.email ?? "-"}
									</p>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator className="my-2" />
						<DropdownMenuItem
							className="cursor-pointer rounded-md p-3 transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
							onClick={handleLogout}
						>
							<span className="flex items-center gap-2">
								<LogOut className="h-4 w-4" />
								Log out
							</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
