"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Admin login failed");
      }

      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Admin login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label className="text-sm text-[#355143]">Admin email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[#cfe0d3] bg-white px-3 py-2 text-sm text-[#173224] outline-none focus:border-[#2e7d32]"
        />
      </div>
      <div>
        <label className="text-sm text-[#355143]">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[#cfe0d3] bg-white px-3 py-2 text-sm text-[#173224] outline-none focus:border-[#2e7d32]"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1b5e20] disabled:opacity-60"
      >
        {loading ? "Signing in..." : "Sign in as admin"}
      </button>
      {error && (
        <div className="rounded-lg border border-[#f3d2c5] bg-[#fff2ec] px-3 py-2 text-xs text-[#9f4b2a]">
          {error}
        </div>
      )}
    </form>
  );
}
