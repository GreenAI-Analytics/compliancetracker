import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen px-4 py-10">
      <Suspense fallback={<div className="mx-auto max-w-md rounded-2xl border border-[#d8d0bd] bg-[#fffdf8] p-6 shadow-lg">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
