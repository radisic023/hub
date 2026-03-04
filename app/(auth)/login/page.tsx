"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { LogIn, User, Lock } from "lucide-react";
import { signInWithUsername } from "@/lib/auth";

const formSchema = z.object({
	username: z.string().min(1, {
		message: "Please enter your username.",
	}),
	password: z.string().min(1, {
		message: "Please enter your password.",
	}),
});

export default function LoginPage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			username: "",
			password: "",
		},
	});

	async function onSubmit(values: z.infer<typeof formSchema>) {
		setIsLoading(true);
		const { error } = await signInWithUsername(
			values.username,
			values.password,
		);
		setIsLoading(false);

		if (error) {
			toast.error("Login failed", {
				description: error,
			});
			return;
		}

		toast.success("Welcome back!");
		router.push("/dashboard");
		router.refresh();
	}

	return (
		<Card className="w-full max-w-md">
			<CardHeader className="text-center">
				<LogIn className="mx-auto h-12 w-12 text-gray-400" />
				<CardTitle className="mt-4 text-2xl">Welcome back</CardTitle>
				<CardDescription>
					Enter your credentials to access your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="username"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Username</FormLabel>
									<FormControl>
										<div className="relative">
											<User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
											<Input
												placeholder="Enter your username"
												className="pl-10"
												autoComplete="username"
												{...field}
											/>
										</div>
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
										<div className="relative">
											<Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
											<Input
												type="password"
												placeholder="Enter your password"
												className="pl-10"
												autoComplete="current-password"
												{...field}
											/>
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? "Signing in..." : "Sign In"}
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}
