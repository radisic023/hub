"use client";

import { useState } from "react";
import { Sidebar } from "@/components/shared/sidebar";
import { Topbar } from "@/components/shared/topbar";
import {
	Sheet,
	SheetContent,
} from "@/components/ui/sheet";

export function DashboardClientLayout({
	children,
	siteTitle,
}: {
	children: React.ReactNode;
	siteTitle?: string;
}) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<div className="relative flex h-screen overflow-hidden bg-background">
			{/* Desktop sidebar - hidden on mobile */}
			<aside className="hidden md:block shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out">
				<Sidebar
					siteTitle={siteTitle ?? "Radisic Storage"}
					isCollapsed={isCollapsed}
					onCollapseToggle={() => setIsCollapsed((c) => !c)}
				/>
			</aside>

			{/* Mobile menu - hamburger passed to Topbar */}

			{/* Mobile drawer */}
			<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
				<SheetContent side="left" className="w-72 p-0">
					<Sidebar
						siteTitle={siteTitle ?? "Radisic Storage"}
						variant="drawer"
						onMobileClose={() => setMobileOpen(false)}
					/>
				</SheetContent>
			</Sheet>

			{/* Main content - flex-1 so it fills remaining space, min-w-0 for proper overflow */}
			<div className="flex flex-1 min-w-0 flex-col overflow-hidden">
				<Topbar
					onMobileMenuClick={() => setMobileOpen(true)}
				/>
				<main className="flex-1 overflow-auto p-4 md:p-8">
					<div className="mx-auto min-h-[calc(100vh-8rem)] w-full max-w-6xl">
						{children}
					</div>
				</main>
			</div>
		</div>
	);
}
