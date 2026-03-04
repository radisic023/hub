import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { ProfileProvider } from "@/components/providers/profile-provider";
import { DashboardClientLayout } from "@/components/shared/dashboard-client-layout";

export async function generateMetadata(): Promise<Metadata> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return {};
	const admin = createAdminClient();
	const { data } = await admin
		.from("site_settings")
		.select("title, favicon_path, seo_banner_path")
		.eq("user_id", user.id)
		.single();
	if (!data) return {};
	const metadata: Metadata = {};
	if (data.title) metadata.title = data.title;
	if (data.favicon_path) metadata.icons = { icon: "/api/site-assets/favicon" };
	if (data.seo_banner_path) {
		metadata.openGraph = {
			images: [{ url: "/api/site-assets/banner" }],
		};
		metadata.twitter = {
			card: "summary_large_image",
			images: ["/api/site-assets/banner"],
		};
	}
	return metadata;
}

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const admin = createAdminClient();
	const [profileRes, siteRes] = await Promise.all([
		supabase
			.from("profiles")
			.select("id, username, email, first_name, last_name, role")
			.eq("id", user.id)
			.single(),
		admin.from("site_settings").select("title").eq("user_id", user.id).single(),
	]);
	let profile = profileRes.data;
	if (!profile) {
		const p = await admin
			.from("profiles")
			.select("id, username, email, first_name, last_name, role")
			.eq("id", user.id)
			.single();
		profile = p.data;
	}
	const siteTitle = siteRes.data?.title ?? "Radisic Storage";

	return (
		<ProfileProvider profile={profile} userId={user.id}>
			<DashboardClientLayout siteTitle={siteTitle}>{children}</DashboardClientLayout>
		</ProfileProvider>
	);
}
