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
};

type CountryOption = {
  code: string;
  name: string;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
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

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "signup" || requestedMode === "login") {
      setMode(requestedMode);
    }
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

        if (!naceRes.ok) throw new Error(naceResult.error ?? "Failed to load NACE options");
        if (!countriesRes.ok) throw new Error(countriesResult.error ?? "Failed to load countries");

        setSections(naceResult.sections ?? []);
        setNaceOptions(naceResult.naceOptions ?? []);
        setCountries(countriesResult.countries ?? []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load options");
      } finally {
        setOptionsLoading(false);
      }
    }

    if (mode === "signup") {
      loadSignupOptions();
    }
  }, [mode]);

  const filteredNaceOptions = naceOptions.filter((item) => item.section === selectedSection);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase public env values are not configured in web/.env.local");
      }

      if (mode === "login") {
        const normalizedEmail = email.trim();
        if (!normalizedEmail || !password) {
          throw new Error("Please enter your email and password");
        }

        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw new Error("Invalid email or password");

        // Verify identity with Supabase Auth before redirecting.
        const {
          data: { user: verifiedUser },
          error: verifyError,
        } = await supabase.auth.getUser();
        if (verifyError || !signInData.user || !signInData.session || !verifiedUser) {
          throw new Error("Authentication failed. Please try again.");
        }

        router.replace("/dashboard");
        router.refresh();
      } else {
        const normalizedCompanyName = companyName.trim();
        const normalizedCompanyAddress = companyAddress.trim();

        if (!normalizedCompanyName) throw new Error("Please enter a company name");
        if (!country) throw new Error("Please select a country");
        if (!selectedSection) throw new Error("Please select a NACE section");
        if (!incorporationDate) throw new Error("Please select an incorporation date");

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

        setMessage(
          "Account created! Check your email to confirm your address, then log in."
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#d8d0bd] bg-[#fffdf8] p-6 shadow-lg">
      <Link href="/" className="text-sm text-[#125f47] underline">
        Back to landing page
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{mode === "login" ? "Login" : "Create account"}</h1>
      <p className="mt-1 text-sm text-[#5d685f]">Email/password only in V1.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
        </div>

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
              <label className="text-sm">Business address <span className="text-[#7b8880]">(optional)</span></label>
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
                    {item.code}
                  </option>
                ))}
              </select>
              {!optionsLoading && selectedSection && filteredNaceOptions.length === 0 && (
                <p className="mt-1 text-xs text-[#8a4a32]">No NACE codes found for this section in current rules data.</p>
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
        {mode === "login" ? "Need an account? Sign up" : "Already have an account? Login"}
      </button>
    </div>
  );
}
