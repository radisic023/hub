import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const admin = createAdminClient();
	const { data } = await admin
		.from("site_settings")
		.select("favicon_path")
		.eq("user_id", user.id)
		.single();

	if (!data?.favicon_path) {
		return new NextResponse(null, { status: 404 });
	}

	const path = `${user.id}/${data.favicon_path}`;
	const { data: fileData, error } = await admin.storage
		.from("files")
		.download(path);

	if (error || !fileData) {
		return new NextResponse(null, { status: 404 });
	}

	const ext = data.favicon_path.split(".").pop()?.toLowerCase();
	const mime = ext === "ico" ? "image/x-icon" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;

	return new NextResponse(fileData, {
		headers: {
			"Content-Type": mime,
			"Cache-Control": "public, max-age=3600",
		},
	});
}
