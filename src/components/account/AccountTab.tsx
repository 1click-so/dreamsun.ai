"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export function AccountTab() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [loading, setLoading] = useState(true);

  // Display name
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

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
      {/* Profile header */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-xl font-bold text-accent">
            {initial}
          </div>
          <div>
            <p className="font-semibold">{displayName || email}</p>
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
