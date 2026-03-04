"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import { loadSiteSettings, upsertSiteSettings } from "./actions";

export default function SettingsPage() {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [keywords, setKeywords] = useState("");
	const [bannerUrl, setBannerUrl] = useState<string | null>(null);
	const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
	const bannerInputRef = useRef<HTMLInputElement>(null);
	const faviconInputRef = useRef<HTMLInputElement>(null);

	const loadData = useCallback(async () => {
		setLoading(true);
		try {
			const { data } = await loadSiteSettings();
			if (data) {
				setTitle(data.title ?? "");
				setDescription(data.description ?? "");
				setKeywords(data.keywords ?? "");
				setBannerUrl(data.seo_banner_url ?? null);
				setFaviconUrl(data.favicon_url ?? null);
			}
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setSaving(true);
		const formData = new FormData();
		formData.set("title", title);
		formData.set("description", description);
		formData.set("keywords", keywords);
		const bannerFile = bannerInputRef.current?.files?.[0];
		const faviconFile = faviconInputRef.current?.files?.[0];
		if (bannerFile) formData.set("banner", bannerFile);
		if (faviconFile) formData.set("favicon", faviconFile);
		const { error } = await upsertSiteSettings(formData);
		setSaving(false);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success("Settings saved");
		router.refresh();
		await loadData();
		if (bannerInputRef.current) bannerInputRef.current.value = "";
		if (faviconInputRef.current) faviconInputRef.current.value = "";
	}

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-4xl font-bold tracking-tight">Settings</h1>
				<p className="text-muted-foreground text-lg">
					Site title, SEO, description, keywords, banner and favicon
				</p>
			</div>

			{loading ? (
				<p className="text-muted-foreground">Loading...</p>
			) : (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Settings className="h-5 w-5" />
							Site Settings
						</CardTitle>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-6">
							<div>
								<label className="text-sm font-medium mb-2 block">Title</label>
								<Input
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder="Site title"
									className="max-w-md"
								/>
							</div>
							<div>
								<label className="text-sm font-medium mb-2 block">Description</label>
								<Textarea
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="Site description (meta description)"
									rows={3}
									className="max-w-md"
								/>
							</div>
							<div>
								<label className="text-sm font-medium mb-2 block">Keywords</label>
								<Input
									value={keywords}
									onChange={(e) => setKeywords(e.target.value)}
									placeholder="keyword1, keyword2, keyword3"
									className="max-w-md"
								/>
							</div>
							<div>
								<label className="text-sm font-medium mb-2 block">SEO Banner</label>
								{bannerUrl && (
									<div className="mb-2">
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img src={bannerUrl} alt="Banner preview" className="max-h-24 rounded border object-contain" />
									</div>
								)}
								<Input
									ref={bannerInputRef}
									type="file"
									accept="image/*"
									className="max-w-md cursor-pointer"
								/>
								<p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF, WebP, SVG</p>
							</div>
							<div>
								<label className="text-sm font-medium mb-2 block">Favicon</label>
								{faviconUrl && (
									<div className="mb-2 flex items-center gap-2">
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img src={faviconUrl} alt="Favicon" className="h-8 w-8 rounded object-contain" />
									</div>
								)}
								<Input
									ref={faviconInputRef}
									type="file"
									accept="image/*,.ico"
									className="max-w-md cursor-pointer"
								/>
								<p className="text-xs text-muted-foreground mt-1">PNG, JPG, ICO, SVG</p>
							</div>
							<Button type="submit" disabled={saving}>
								{saving ? "Saving..." : "Save"}
							</Button>
						</form>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
