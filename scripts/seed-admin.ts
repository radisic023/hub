/**
 * Seed admin user. Run: npx tsx scripts/seed-admin.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const ADMIN = {
	email: "radisic00@gmail.com",
	password: "nikola99",
	username: "rade023",
	first_name: "Nikola",
	last_name: "Radisic",
	role: "admin",
};

async function seedAdmin() {
	const { data: existing } = await supabase
		.from("profiles")
		.select("id")
		.eq("username", ADMIN.username)
		.single();

	if (existing) {
		console.log("Admin user already exists:", ADMIN.username);
		return;
	}

	const { data: user, error: authError } = await supabase.auth.admin.createUser({
		email: ADMIN.email,
		password: ADMIN.password,
		email_confirm: true,
	});

	if (authError) {
		console.error("Error creating auth user:", authError.message);
		process.exit(1);
	}

	const { error: profileError } = await supabase.from("profiles").insert({
		id: user.user.id,
		username: ADMIN.username,
		email: ADMIN.email,
		first_name: ADMIN.first_name,
		last_name: ADMIN.last_name,
		role: ADMIN.role,
	});

	if (profileError) {
		console.error("Error creating profile:", profileError.message);
		process.exit(1);
	}

	console.log("Admin user created:", ADMIN.username, "/", ADMIN.email);
}

seedAdmin();
