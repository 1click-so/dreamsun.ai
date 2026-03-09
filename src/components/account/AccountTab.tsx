"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Image from "next/image";

export function AccountTab() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState("");
  const [loading, setLoading] = useState(true);

  // Avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Display name
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Username
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Delete account
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const { theme, toggle } = useTheme();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/account/profile")
      .then((r) => r.json())
      .then((data) => {
        setEmail(data.email || "");
        setDisplayName(data.display_name || "");
        setUsername(data.username || "");
        setAvatarUrl(data.avatar_url || null);
        setCreatedAt(data.created_at || "");
      })
      .finally(() => setLoading(false));
  }, []);

  const saveName = async () => {
    setNameSaving(true);
    setNameError(null);
    setNameSuccess(false);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      if (!res.ok) {
        const data = await res.json();
        setNameError(data.error || "Failed to save");
      } else {
        setNameSuccess(true);
        setTimeout(() => setNameSuccess(false), 2000);
      }
    } catch {
      setNameError("Network error");
    } finally {
      setNameSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/account/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    } catch {
      // silent — avatar upload is non-critical
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveUsername = async () => {
    setUsernameSaving(true);
    setUsernameError(null);
    setUsernameSuccess(false);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const data = await res.json();
        setUsernameError(data.error || "Failed to save");
      } else {
        const data = await res.json();
        setUsername(data.username);
        setUsernameSuccess(true);
        setTimeout(() => setUsernameSuccess(false), 2000);
      }
    } catch {
      setUsernameError("Network error");
    } finally {
      setUsernameSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwError("Passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("Password must be at least 6 characters");
      return;
    }
    setPwSaving(true);
    setPwError(null);
    setPwSuccess(false);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setPwError(error.message);
      } else {
        setPwSuccess(true);
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPwSuccess(false), 2000);
      }
    } catch {
      setPwError("Something went wrong");
    } finally {
      setPwSaving(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (res.ok) {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
      }
    } finally {
      setDeleting(false);
    }
  };

  const initial = email ? email[0].toUpperCase() : "?";
  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "";

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted">Loading...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile header with avatar */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 transition hover:ring-2 hover:ring-accent/40"
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Avatar"
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xl font-bold text-accent">{initial}</span>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
              {avatarUploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 11l3.5-3.5a1 1 0 011.4 0L10 10.5" />
                  <path d="M9.5 10l1-1a1 1 0 011.4 0L14 11" />
                  <rect x="1" y="2" width="14" height="12" rx="2" />
                </svg>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
                e.target.value = "";
              }}
            />
          </button>
          <div>
            <p className="font-semibold">{displayName || email}</p>
            {username && <p className="text-xs text-accent">@{username}</p>}
            <p className="text-xs text-muted">{email}</p>
            {memberSince && (
              <p className="mt-0.5 text-xs text-muted">
                Member since {memberSince}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Display name */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold">Display name</h3>
        <p className="mt-0.5 text-xs text-muted">
          This is how your name appears on your account.
        </p>
        <div className="mt-3 flex gap-3">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            maxLength={100}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-accent"
          />
          <button
            onClick={saveName}
            disabled={nameSaving}
            className="rounded-lg bg-accent px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-accent-hover disabled:opacity-50"
          >
            {nameSaving ? "Saving..." : nameSuccess ? "Saved" : "Save"}
          </button>
        </div>
        {nameError && (
          <p className="mt-2 text-xs text-destructive">{nameError}</p>
        )}
      </div>

      {/* Username */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold">Username</h3>
        <p className="mt-0.5 text-xs text-muted">
          Your unique handle for the community. Lowercase letters, numbers, and underscores only.
        </p>
        <div className="mt-3 flex gap-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 30))}
              placeholder="your_username"
              maxLength={30}
              className="w-full rounded-lg border border-border bg-background py-2.5 pl-8 pr-4 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-accent"
            />
          </div>
          <button
            onClick={saveUsername}
            disabled={usernameSaving || username.length < 3}
            className="rounded-lg bg-accent px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {usernameSaving ? "Saving..." : usernameSuccess ? "Saved" : "Save"}
          </button>
        </div>
        {usernameError && (
          <p className="mt-2 text-xs text-destructive">{usernameError}</p>
        )}
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold">Change password</h3>
        <p className="mt-0.5 text-xs text-muted">
          Update your password to keep your account secure.
        </p>
        <form onSubmit={changePassword} className="mt-3 space-y-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-accent"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-accent"
          />
          {pwError && <p className="text-xs text-destructive">{pwError}</p>}
          {pwSuccess && (
            <p className="text-xs text-accent">
              Password updated successfully.
            </p>
          )}
          <button
            type="submit"
            disabled={pwSaving || !newPassword}
            className="rounded-lg bg-accent px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pwSaving ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>

      {/* Appearance */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Appearance</h3>
            <p className="mt-0.5 text-xs text-muted">
              Currently using {theme === "dark" ? "dark" : "light"} mode.
            </p>
          </div>
          <button
            onClick={toggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
              theme === "dark" ? "bg-accent" : "bg-border"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                theme === "dark" ? "translate-x-[21px]" : "translate-x-[3px]"
              }`}
              style={{ marginTop: "2px" }}
            />
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/30 bg-surface p-5">
        <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
        <p className="mt-0.5 text-xs text-muted">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="mt-3 rounded-lg border border-destructive/40 px-4 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
          >
            Delete account
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted">
              Type{" "}
              <span className="font-mono font-semibold text-destructive">
                DELETE
              </span>{" "}
              to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE"
              className="w-full rounded-lg border border-destructive/40 bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-destructive"
            />
            <div className="flex gap-3">
              <button
                onClick={deleteAccount}
                disabled={deleteConfirm !== "DELETE" || deleting}
                className="rounded-lg bg-destructive px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting..." : "Permanently delete account"}
              </button>
              <button
                onClick={() => {
                  setShowDelete(false);
                  setDeleteConfirm("");
                }}
                className="rounded-lg border border-border px-4 py-2.5 text-xs text-muted transition hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
