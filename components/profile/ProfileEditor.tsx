"use client";

import { useState, useCallback, useEffect } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { ProfileAvatar } from "./ProfileAvatar";
import { generateUsername } from "@/lib/utils/username";

const USERNAME_REGEX = /^[a-zA-Z0-9_\s]+$/;
const USERNAME_MAX_LENGTH = 50;

export function ProfileEditor() {
  const { profile, isLoading, updateProfile, isUpdating, updateError } =
    useProfile();
  const { tradingWallet } = useTradingWallet();

  const walletAddress = tradingWallet?.address ?? null;

  // Local state for editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize name input when profile loads
  useEffect(() => {
    if (profile?.name) {
      setNameInput(profile.name);
    }
  }, [profile?.name]);

  // Generate fallback username from wallet address
  const displayName =
    profile?.name ||
    (walletAddress ? generateUsername(walletAddress) : "User");

  const validateName = (name: string): string | null => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return "Username cannot be empty";
    }
    if (trimmed.length > USERNAME_MAX_LENGTH) {
      return `Username must be at most ${USERNAME_MAX_LENGTH} characters`;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
      return "Only letters, numbers, spaces, and underscores allowed";
    }
    return null;
  };

  const handleStartEditName = useCallback(() => {
    setNameInput(profile?.name || "");
    setNameError(null);
    setIsEditingName(true);
  }, [profile?.name]);

  const handleCancelEditName = useCallback(() => {
    setIsEditingName(false);
    setNameInput(profile?.name || "");
    setNameError(null);
  }, [profile?.name]);

  const handleSaveName = useCallback(async () => {
    const trimmedName = nameInput.trim();
    const error = validateName(trimmedName);
    if (error) {
      setNameError(error);
      return;
    }

    try {
      await updateProfile({ name: trimmedName });
      setIsEditingName(false);
      setNameError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setNameError(
        err instanceof Error ? err.message : "Failed to save username"
      );
    }
  }, [nameInput, updateProfile]);

  const handleNameInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNameInput(e.target.value);
      // Clear error when typing
      if (nameError) {
        setNameError(null);
      }
    },
    [nameError]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSaveName();
      } else if (e.key === "Escape") {
        handleCancelEditName();
      }
    },
    [handleSaveName, handleCancelEditName]
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 p-4">
        <div className="h-20 w-20 animate-pulse rounded-full bg-foreground/10" />
        <div className="space-y-2">
          <div className="h-6 w-32 animate-pulse rounded bg-foreground/10" />
          <div className="h-4 w-48 animate-pulse rounded bg-foreground/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4">
      {/* Avatar */}
      <ProfileAvatar
        walletAddress={walletAddress}
        size={80}
      />

      {/* User info */}
      <div className="flex-1 min-w-0">
        {/* Username row */}
        <div className="flex items-center gap-2">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={handleNameInputChange}
                onKeyDown={handleKeyDown}
                className="rounded-md border border-foreground/20 bg-background px-2 py-1 text-lg font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Enter username"
                maxLength={USERNAME_MAX_LENGTH}
                autoFocus
                disabled={isUpdating}
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={isUpdating}
                className="rounded-md p-1 text-green-600 transition hover:bg-green-100 disabled:opacity-50 dark:hover:bg-green-900/30"
                title="Save"
              >
                {isUpdating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelEditName}
                disabled={isUpdating}
                className="rounded-md p-1 text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:hover:bg-red-900/30"
                title="Cancel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-foreground">
                {displayName}
              </h2>
              <button
                type="button"
                onClick={handleStartEditName}
                className="rounded-md p-1 text-muted transition hover:bg-foreground/10 hover:text-foreground"
                title="Edit username"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {saveSuccess && (
                <span className="text-sm text-green-600">Saved!</span>
              )}
            </>
          )}
        </div>

        {/* Error message */}
        {(nameError || updateError) && (
          <p className="mt-1 text-sm text-red-500">
            {nameError || (updateError instanceof Error ? updateError.message : "An error occurred")}
          </p>
        )}

        {/* Email */}
        {profile?.email && (
          <p className="mt-1 text-sm text-muted">{profile.email}</p>
        )}
      </div>
    </div>
  );
}
