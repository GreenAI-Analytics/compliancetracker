import { cookies } from "next/headers";
import { AdminLoginForm } from "@/components/admin-login-form";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { AdminConsole } from "@/components/admin-console";
import { ADMIN_SESSION_COOKIE, getAdminCredentials, readAdminSession } from "@/lib/admin-auth";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = readAdminSession(token);
  const credentialsConfigured = Boolean(getAdminCredentials());

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[#d7e5da] bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#1a2e22]">App Admin</h1>
            <p className="mt-2 text-sm text-[#5f7668]">
              Restricted admin access for operational tasks.
            </p>
          </div>
          {session && <AdminLogoutButton />}
        </div>

        {!credentialsConfigured && (
          <div className="mt-5 rounded-lg border border-[#f3d2c5] bg-[#fff2ec] px-4 py-3 text-sm text-[#9f4b2a]">
            Admin login is not configured. Set APP_ADMIN_EMAIL, APP_ADMIN_PASSWORD, and
            APP_ADMIN_SESSION_SECRET in your environment.
          </div>
        )}

        {credentialsConfigured && !session && <AdminLoginForm />}

        {credentialsConfigured && session && <AdminConsole email={session.email} />}
      </div>
    </div>
  );
}
