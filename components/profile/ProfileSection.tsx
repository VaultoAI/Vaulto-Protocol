"use client";

import { ProfileEditor } from "./ProfileEditor";

export function ProfileSection() {
  return (
    <div className="rounded-xl border border-border bg-card-bg p-6">
      <h3 className="mb-4 text-sm font-medium text-muted">Profile</h3>
      <ProfileEditor />
    </div>
  );
}
