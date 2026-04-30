"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

type NaceSectionOption = {
  code: string;
  name: string;
};

type NaceCodeOption = {
  code: string;
  section: string;
  description: string;
};

type CountryOption = {
  code: string;
  name: string;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [oauthSignupMode, setOauthSignupMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [incorporationDate, setIncorporationDate] = useState("");
  const [country, setCountry] = useState("");
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [naceCode, setNaceCode] = useState("");
  const [sections, setSections] = useState<NaceSectionOption[]>([]);
  const [naceOptions, setNaceOptions] = useState<NaceCodeOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "signup" || requestedMode === "login") {
      setMode(requestedMode);
    }
  }, [searchParams]);

  useEffect(() => {
    async function detectOAuthSignupContext() {
      if (searchParams.get("oauth") !== "1") {
        setOauthSignupMode(false);
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        setMessage(
          "Supabase public env values are not configured in web/.env.local",
        );
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        setEmail(user.email);
        setOauthSignupMode(true);
        setMode("signup");
      }
    }

    detectOAuthSignupContext();
  }, [searchParams]);

  useEffect(() => {
    async function loadSignupOptions() {
      setOptionsLoading(true);
      try {
        const [naceRes, countriesRes] = await Promise.all([
          fetch("/api/nace-options"),
          fetch("/api/countries"),
        ]);

        const naceResult = (await naceRes.json()) as {
          sections?: NaceSectionOption[];
          naceOptions?: NaceCodeOption[];
          error?: string;
        };
        const countriesResult = (await countriesRes.json()) as {
          countries?: CountryOption[];
          error?: string;
        };

        if (!naceRes.ok)
          throw new Error(naceResult.error ?? "Failed to load NACE options");
        if (!countriesRes.ok)
          throw new Error(countriesResult.error ?? "Failed to load countries");

        setSections(naceResult.sections ?? []);
        setNaceOptions(naceResult.naceOptions ?? []);
        setCountries(countriesResult.countries ?? []);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to load options",
        );
      } finally {
        setOptionsLoading(false);
      }
    }

    if (mode === "signup") {
      loadSignupOptions();
    }
  }, [mode]);

  const filteredNaceOptions = naceOptions.filter(
    (item) => item.section === selectedSection,
  );

  async function onSocialLogin(provider: "google" | "azure") {
    setLoading(true);
    setMessage(null);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error(
          "Supabase public env values are not configured in web/.env.local",
        );
      }

      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/login?mode=signup&fresh=1&oauth=1`,
        },
      });

      if (error) throw error;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Social login failed",
      );
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error(
          "Supabase public env values are not configured in web/.env.local",
        );
      }

      if (mode === "login") {
        const normalizedEmail = email.trim();
        if (!normalizedEmail || !password) {
          throw new Error("Please enter your email and password");
        }

        const { data: signInData, error } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
        if (error) throw new Error("Invalid email or password");

        // Verify identity with Supabase Auth before redirecting.
        const {
          data: { user: verifiedUser },
          error: verifyError,
        } = await supabase.auth.getUser();
        if (
          verifyError ||
          !signInData.user ||
          !signInData.session ||
          !verifiedUser
        ) {
          throw new Error("Authentication failed. Please try again.");
        }

        router.replace("/dashboard");
        router.refresh();
      } else {
        if (oauthSignupMode) {
          const {
            data: { user: oauthUser },
            error: oauthUserError,
          } = await supabase.auth.getUser();

          if (oauthUserError || !oauthUser?.id || !oauthUser.email) {
            throw new Error("Social session not found. Please sign in again.");
          }

          const normalizedCompanyName = companyName.trim();
          const normalizedCompanyAddress = companyAddress.trim();

          if (!normalizedCompanyName)
            throw new Error("Please enter a company name");
          if (!country) throw new Error("Please select a country");
          if (!selectedSection) throw new Error("Please select a NACE section");
          if (!incorporationDate)
            throw new Error("Please select an incorporation date");

          const normalizedNaceCode = naceCode.trim();
          if (!/^[0-9]{2}$/.test(normalizedNaceCode)) {
            throw new Error("Please select a valid 2-digit NACE code");
          }

          const persistRes = await fetch("/api/auth/complete-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              authUserId: oauthUser.id,
              email: oauthUser.email,
              companyName: normalizedCompanyName,
              companyAddress: normalizedCompanyAddress,
              incorporationDate,
              country,
              naceCode: normalizedNaceCode,
            }),
          });

          if (!persistRes.ok) {
            const persistErr = (await persistRes.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(persistErr?.error ?? "Failed to complete signup.");
          }

          router.replace("/dashboard");
          router.refresh();
          return;
        }

        const normalizedCompanyName = companyName.trim();
        const normalizedCompanyAddress = companyAddress.trim();

        if (!normalizedCompanyName)
          throw new Error("Please enter a company name");
        if (!country) throw new Error("Please select a country");
        if (!selectedSection) throw new Error("Please select a NACE section");
        if (!incorporationDate)
          throw new Error("Please select an incorporation date");

        const normalizedNaceCode = naceCode.trim();
        if (!/^[0-9]{2}$/.test(normalizedNaceCode)) {
          throw new Error("Please select a valid 2-digit NACE code");
        }

        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              company_name: normalizedCompanyName,
              company_address: normalizedCompanyAddress || null,
              incorporation_date: incorporationDate,
              country,
              nace_section: selectedSection,
              nace_code: normalizedNaceCode,
            },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) throw error;

        const authUserId = signUpData.user?.id;
        if (authUserId) {
          const persistRes = await fetch("/api/auth/complete-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              authUserId,
              email,
              companyName: normalizedCompanyName,
              companyAddress: normalizedCompanyAddress,
              incorporationDate,
              country,
              naceCode: normalizedNaceCode,
            }),
          });
          if (!persistRes.ok) {
            const persistErr = (await persistRes.json()) as { error?: string };
            // Non-fatal: auth account exists, DB record may already be there
            console.warn("Persist signup error:", persistErr.error);
          }
        }

        setSignupEmail(email);
        setShowConfirmation(true);
        setEmail("");
        setPassword("");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Authentication failed",
      );
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    setResending(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: signupEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Verification email resent! Check your inbox.");
      }
    } catch {
      setMessage("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  }

  // ── Confirmation screen after email signup ──────────────────────────

  if (showConfirmation) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[#d8d0bd] bg-[#fffdf8] p-8 shadow-lg">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1e3326]/10">
            <svg
              className="h-8 w-8 text-[#1e3326]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-bold text-[#1e3326]">
            Verify your email
          </h2>
          <p className="mt-2 text-sm text-[#5c695f]">
            We sent a confirmation link to{" "}
            <span className="font-medium text-[#1e3326]">{signupEmail}</span>.
            Click the link to activate your account, then log in.
          </p>
          <div className="mt-2 text-xs text-[#7b8880]">
            Didn&apos;t receive it? Check your spam folder.
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={resendVerification}
            disabled={resending}
            className="w-full rounded-lg bg-[#1e3326] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2a4a38] disabled:opacity-60"
          >
            {resending ? "Sending…" : "Resend verification email"}
          </button>
          <Link
            href="/login"
            className="w-full rounded-lg border border-[#d7cfbb] bg-[#fffef9] px-4 py-2.5 text-center text-sm font-medium text-[#1e3326] transition-colors hover:bg-[#f2f1ec]"
          >
            Back to login
          </Link>
        </div>

        {message && (
          <p className="mt-4 text-center text-sm text-[#4a5b52]">{message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#d8d0bd] bg-[#fffdf8] p-6 shadow-lg">
      <Link href="/" className="text-sm text-[#125f47] underline">
        Back to landing page
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        {mode === "login" ? "Login" : "Create account"}
      </h1>
      <p className="mt-1 text-sm text-[#5d685f]">
        {mode === "login"
          ? "Sign in with email/password or social login."
          : oauthSignupMode
            ? "Finish your signup by entering your business details."
            : "Create your account with business details."}
      </p>

      {mode === "login" && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSocialLogin("google")}
            disabled={loading}
            className="rounded-lg border border-[#cfc6af] bg-white px-4 py-2 text-sm font-medium text-[#1f3428] hover:bg-[#f6f3ea] disabled:opacity-60"
          >
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => onSocialLogin("azure")}
            disabled={loading}
            className="rounded-lg border border-[#cfc6af] bg-white px-4 py-2 text-sm font-medium text-[#1f3428] hover:bg-[#f6f3ea] disabled:opacity-60"
          >
            Continue with Microsoft
          </button>
        </div>
      )}

      {mode === "login" && (
        <div className="mt-4 flex items-center gap-3 text-xs text-[#7b8880]">
          <span className="h-px flex-1 bg-[#dfd8c7]" />
          OR
          <span className="h-px flex-1 bg-[#dfd8c7]" />
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        {mode === "login" ? (
          <>
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
            <div>
              <label className="text-sm">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="mt-1 w-full rounded-lg border border-[#cfc6af] bg-white px-3 py-2"
              />
              <div className="mt-2 text-right">
                <Link
                  href="/reset-password"
                  className="text-sm text-[#125f47] underline"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
          </>
        ) : oauthSignupMode ? (
          <div>
            <label className="text-sm">Email</label>
            <input
              value={email}
              type="email"
              readOnly
              className="mt-1 w-full rounded-lg border border-[#cfc6af] bg-[#f6f7f4] px-3 py-2 text-[#607067]"
            />
          </div>
        ) : (
          <>
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
            <div>
              <label className="text-sm">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={6}
                className="mt-1 w-full rounded-lg border border-[#cfc6af] bg-white px-3 py-2"
              />
            </div>
          </>
        )}

        {mode === "signup" && (
          <>
            <div>
              <label className="text-sm">Company name</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                type="text"
                required
                className="mt-1 w-full rounded-lg border border-[#cfc6af] bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm">
                Business address{" "}
                <span className="text-[#7b8880]">(optional)</span>
              </label>
              <textarea
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-[#cfc6af] bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm">Incorporation date</label>
              <input
                value={incorporationDate}
                onChange={(e) => setIncorporationDate(e.target.value)}
                type="date"
                required
                className="mt-1 w-full rounded-lg border border-[#cfc6af] bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm">Country of incorporation</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                disabled={optionsLoading}
                className="mt-1 w-full rounded-lg border border-[#cfc6af] bg-white px-3 py-2"
              >
                <option value="">Select country</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm">NACE section</label>
              <select
                value={selectedSection}
                onChange={(e) => {
                  setSelectedSection(e.target.value);
                  setNaceCode("");
                }}
                required
                disabled={optionsLoading}
                className="mt-1 w-full rounded-lg border border-[#cfc6af] bg-white px-3 py-2"
              >
                <option value="">Select section</option>
                {sections.map((section) => (
                  <option key={section.code} value={section.code}>
                    {section.code} - {section.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm">NACE code (2-digit)</label>
              <select
                value={naceCode}
                onChange={(e) => setNaceCode(e.target.value)}
                required
                disabled={!selectedSection || optionsLoading}
                className="mt-1 w-full rounded-lg border border-[#cfc6af] bg-white px-3 py-2"
              >
                <option value="">Select NACE code</option>
                {filteredNaceOptions.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code}.XX - {item.description}
                  </option>
                ))}
              </select>
              {!optionsLoading &&
                selectedSection &&
                filteredNaceOptions.length === 0 && (
                  <p className="mt-1 text-xs text-[#8a4a32]">
                    No NACE codes found for this section in current rules data.
                  </p>
                )}
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
        >
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Sign up"}
        </button>
      </form>
      {message && <p className="mt-3 text-sm text-[#4a5b52]">{message}</p>}
      <button
        className="mt-4 text-sm text-[#125f47] underline"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login"
          ? "Need an account? Sign up"
          : "Already have an account? Login"}
      </button>
    </div>
  );
}
