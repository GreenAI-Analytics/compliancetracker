"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";

type ResetMode = "request" | "update";

export function ResetPasswordForm() {
  const [mode, setMode] = useState<ResetMode>("request");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updated, setUpdated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const recoveryIntent = useMemo(() => {
    if (typeof window === "undefined") return false;

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    return hash.get("type") === "recovery" || query.get("type") === "recovery";
  }, []);

  useEffect(() => {
    if (recoveryIntent) {
      setMode("update");
    }
  }, [recoveryIntent]);

  async function onRequestReset(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase public env values are not configured in web/.env.local");
      }

      const normalizedEmail = email.trim();
      if (!normalizedEmail) {
        throw new Error("Please enter your email address");
      }

      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (error) throw error;

      setMessage("If an account exists for this email, a password reset link has been sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to send password reset email");
    } finally {
      setLoading(false);
    }
  }

  async function onUpdatePassword(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase public env values are not configured in web/.env.local");
      }

      if (newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      await supabase.auth.signOut();
      setUpdated(true);
      setMessage("Password updated successfully. Please sign in with your new password.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#d8d0bd] bg-[#fffdf8] p-6 shadow-lg">
      <Link href="/login" className="text-sm text-[#125f47] underline">
        Back to login
      </Link>

      <h1 className="mt-3 text-2xl font-bold">Reset password</h1>
      <p className="mt-1 text-sm text-[#5d685f]">
        {mode === "request"
          ? "Enter your account email and we will send a reset link."
          : "Enter your new password to finish recovery."}
      </p>

      {mode === "request" ? (
        <form className="mt-6 space-y-4" onSubmit={onRequestReset}>
          <div>
            <label className="text-sm">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-[#cfc6af] bg-white px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
          >
            {loading ? "Please wait..." : "Send reset link"}
          </button>
        </form>
      ) : (
        <>
          {!updated ? (
            <form className="mt-6 space-y-4" onSubmit={onUpdatePassword}>
              <div>
                <label className="text-sm">New password</label>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-lg border border-[#cfc6af] bg-white px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm">Confirm password</label>
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-lg border border-[#cfc6af] bg-white px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
              >
                {loading ? "Please wait..." : "Update password"}
              </button>
            </form>
          ) : (
            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-white hover:bg-[var(--accent-strong)]"
              >
                Continue to login
              </Link>
            </div>
          )}
        </>
      )}

      {message && <p className="mt-3 text-sm text-[#4a5b52]">{message}</p>}
    </div>
  );
}
