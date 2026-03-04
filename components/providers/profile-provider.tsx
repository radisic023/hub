"use client";

import { createContext, useContext, type ReactNode } from "react";

export type Profile = {
	id: string;
	username: string;
	email: string;
	first_name: string;
	last_name: string;
	role: string;
};

type ProfileContextValue = { profile: Profile | null; userId: string | null };

const ProfileContext = createContext<ProfileContextValue>({
	profile: null,
	userId: null,
});

export function ProfileProvider({
	profile,
	userId,
	children,
}: {
	profile: Profile | null;
	userId: string | null;
	children: ReactNode;
}) {
	return (
		<ProfileContext.Provider value={{ profile, userId }}>
			{children}
		</ProfileContext.Provider>
	);
}

export function useProfileContext() {
	return useContext(ProfileContext);
}
