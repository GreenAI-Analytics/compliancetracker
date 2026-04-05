"use client";

import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#1f5f2c] transition hover:bg-[#e8f4ea]"
    >
      Log out
    </button>
  );
}
