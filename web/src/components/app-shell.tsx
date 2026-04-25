import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/historical", label: "Historical Data" },
  { href: "/knowledge", label: "Knowledge Hub" },
  { href: "/settings", label: "Settings" },
  { href: "/billing", label: "Billing" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[220px_1fr]">
        <aside className="surface flex flex-col rounded-2xl p-4 md:h-[calc(100vh-2rem)] md:sticky md:top-4">
          <div className="flex items-center gap-3">
            <Image
              src="/compliance-tracker-logo.png"
              alt="Compliance Tracker"
              width={150}
              height={40}
              className="h-auto w-[150px]"
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </div>
          <p className="mt-2 text-sm text-[#5a665f]">EU SME Compliance</p>
          <nav className="mt-6 flex flex-col gap-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-[#1e3326] transition hover:bg-[#e8f4ea]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto border-t border-[#d7e5da] pt-6">
            <LogoutButton />
          </div>
        </aside>
        <main className="surface rounded-2xl p-6">{children}</main>
      </div>
    </div>
  );
}
