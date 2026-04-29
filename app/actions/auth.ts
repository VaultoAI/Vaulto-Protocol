"use server";

import { signIn } from "@/lib/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/waitlist-success" });
}

export async function signInAsEmployee() {
  await signIn("google", { redirectTo: "/explore" });
}
