"use client";

import { FormEvent, useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────

type CountryOption = {
  code: string;
  name: string;
};

type NaceSectionOption = {
  code: string;
  name: string;
};

type NaceCodeOption = {
  code: string;
  section: string;
  description: string;
};

type OnboardingProfile = {
  id?: string;
  user_id?: string;
  organization_id?: string;
  company_name?: string;
  business_address?: string | null;
  incorporation_date?: string | null;
  employee_count?: number | null;
  country?: string;
  nace?: string;
  operating_countries?: string[];
  modules_selected?: string[];
  onboarding_completed?: boolean;
  task_reminders_enabled?: boolean;
  task_reminder_days_before?: number;
};

type FormData = {
  country: string;
  naceSection: string;
  naceCode: string;
  companyName: string;
  businessAddress: string;
  incorporationDate: string;
  employeeCount: string;
  modules: string[];
};

type FormAction =
  | { type: "SET_FIELD"; field: keyof FormData; value: string }
  | { type: "SET_COUNTRY"; value: string }
  | { type: "SET_NACE_SECTION"; value: string }
  | { type: "SET_NACE_CODE"; value: string }
  | { type: "SET_COMPANY_NAME"; value: string }
  | { type: "SET_BUSINESS_ADDRESS"; value: string }
  | { type: "SET_INCORPORATION_DATE"; value: string }
  | { type: "SET_EMPLOYEE_COUNT"; value: string }
  | { type: "TOGGLE_MODULE"; value: string }
  | { type: "LOAD_PROFILE"; profile: OnboardingProfile };

const STEPS = [
  "Country & NACE",
  "Company Profile",
  "Modules",
  "Review & Complete",
];

const AVAILABLE_MODULES = [
  { id: "gdpr", label: "GDPR (Data Protection)" },
  { id: "aml", label: "Anti-Money Laundering (AML)" },
  { id: "esg", label: "ESG & Sustainability" },
  { id: "health_safety", label: "Health & Safety" },
  { id: "employment_law", label: "Employment Law" },
  { id: "tax_compliance", label: "Tax Compliance" },
  { id: "corporate_governance", label: "Corporate Governance" },
  { id: "environmental", label: "Environmental Compliance" },
  { id: "data_security", label: "Data Security & Cybersecurity" },
  { id: "anti_bribery", label: "Anti-Bribery & Corruption" },
  { id: "consumer_protection", label: "Consumer Protection" },
  { id: "trade_compliance", label: "Trade & Export Compliance" },
];

function formReducer(state: FormData, action: FormAction): FormData {
  switch (action.type) {
    case "SET_COUNTRY":
      return { ...state, country: action.value };
    case "SET_NACE_SECTION":
      return { ...state, naceSection: action.value, naceCode: "" };
    case "SET_NACE_CODE":
      return { ...state, naceCode: action.value };
    case "SET_COMPANY_NAME":
      return { ...state, companyName: action.value };
    case "SET_BUSINESS_ADDRESS":
      return { ...state, businessAddress: action.value };
    case "SET_INCORPORATION_DATE":
      return { ...state, incorporationDate: action.value };
    case "SET_EMPLOYEE_COUNT":
      return { ...state, employeeCount: action.value };
    case "TOGGLE_MODULE": {
      const modules = state.modules.includes(action.value)
        ? state.modules.filter((m) => m !== action.value)
        : [...state.modules, action.value];
      return { ...state, modules };
    }
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "LOAD_PROFILE": {
      const p = action.profile;
      const naceSection = p.nace ? p.nace.slice(0, 2) : "";
      return {
        country: p.country ?? "",
        naceSection,
        naceCode: p.nace ?? "",
        companyName: p.company_name ?? "",
        businessAddress: p.business_address ?? "",
        incorporationDate: p.incorporation_date ?? "",
        employeeCount: p.employee_count != null ? String(p.employee_count) : "",
        modules: p.modules_selected ?? [],
      };
    }
    default:
      return state;
  }
}

const initialState: FormData = {
  country: "",
  naceSection: "",
  naceCode: "",
  companyName: "",
  businessAddress: "",
  incorporationDate: "",
  employeeCount: "",
  modules: [],
};

// ─── Step Validation ──────────────────────────────────────────────────────

function validateStep(step: number, data: FormData): string | null {
  switch (step) {
    case 0: {
      if (!data.country) return "Please select a country.";
      if (!data.naceSection) return "Please select a NACE section.";
      if (!/^[0-9]{2}$/.test(data.naceCode))
        return "Please select a valid 2-digit NACE code.";
      return null;
    }
    case 1: {
      if (!data.companyName.trim()) return "Please enter your company name.";
      if (!data.incorporationDate)
        return "Please select an incorporation date.";
      return null;
    }
    case 2: {
      if (data.modules.length === 0)
        return "Please select at least one compliance module.";
      return null;
    }
    default:
      return null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [formData, dispatch] = useReducer(formReducer, initialState);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Loading states
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetched options
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [sections, setSections] = useState<NaceSectionOption[]>([]);
  const [naceOptions, setNaceOptions] = useState<NaceCodeOption[]>([]);

  // ── Fetch data on mount ──────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      setPageLoading(true);
      setError(null);
      try {
        const [naceRes, countriesRes, profileRes] = await Promise.all([
          fetch("/api/nace-options"),
          fetch("/api/countries"),
          fetch("/api/onboarding/data", { credentials: "include" }),
        ]);

        if (!naceRes.ok || !countriesRes.ok) {
          throw new Error("Failed to load configuration options.");
        }

        const naceResult = (await naceRes.json()) as {
          sections?: NaceSectionOption[];
          naceOptions?: NaceCodeOption[];
        };
        const countriesResult = (await countriesRes.json()) as {
          countries?: CountryOption[];
        };
        const profileResult = (await profileRes.json()) as {
          profile?: OnboardingProfile | null;
          csrfToken?: string;
        };

        setSections(naceResult.sections ?? []);
        setNaceOptions(naceResult.naceOptions ?? []);
        setCountries(countriesResult.countries ?? []);

        // Restore CSRF token from the profile response
        if (profileResult.csrfToken) {
          setCsrfToken(profileResult.csrfToken);
        }

        // Pre-fill form with existing profile data if it exists
        if (profileResult.profile) {
          dispatch({ type: "LOAD_PROFILE", profile: profileResult.profile });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load setup data.",
        );
      } finally {
        setPageLoading(false);
      }
    }
    init();
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────

  const filteredNaceOptions = naceOptions.filter(
    (opt) => opt.section === formData.naceSection,
  );

  // ── Handlers ─────────────────────────────────────────────────────────

  function goNext() {
    const validationError = validateStep(step, formData);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    }
  }

  function goBack() {
    setError(null);
    if (step > 0) {
      setStep((s) => s - 1);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validateStep(step, formData);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase client is not configured.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // Fallback: redirect to login if no session
        router.replace("/login");
        return;
      }

      const payload = {
        company_name: formData.companyName.trim(),
        business_address: formData.businessAddress.trim() || null,
        incorporation_date: formData.incorporationDate || null,
        employee_count: formData.employeeCount
          ? Number.parseInt(formData.employeeCount, 10)
          : null,
        country: formData.country,
        nace: formData.naceCode,
        modules_selected: formData.modules,
        operating_countries: [formData.country],
        onboarding_completed: true,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Include CSRF token if we have one
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }

      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errData?.error ?? "Failed to save onboarding data.");
      }

      // Optionally extract the new CSRF token from response
      // (the PATCH endpoint rotates it via setCsrfCookie)
      // Since the cookie is HTTP-only we can't read it, but the next
      // page load will call GET /api/onboarding/data which sets a fresh one.

      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading State ────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#d7cfbb] border-t-[#1e3326]" />
          <p className="mt-4 text-[#5c695f]">Loading onboarding setup…</p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl">
      {/* Page heading */}
      <h1 className="text-2xl font-bold text-[#1e3326] md:text-3xl">
        Set Up Your Company
      </h1>
      <p className="mt-1 text-sm text-[#5c695f]">
        Complete your company profile to get started with compliance tracking.
      </p>

      {/* Step indicator */}
      <div className="mt-8 flex items-center gap-1">
        {STEPS.map((label, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={label} className="flex items-center gap-1">
              {i > 0 && (
                <div
                  className={`h-px w-4 sm:w-8 ${
                    isDone ? "bg-[#1e3326]" : "bg-[#d7cfbb]"
                  }`}
                />
              )}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm ${
                  isActive
                    ? "bg-[#1e3326] text-white"
                    : isDone
                      ? "bg-[#d7cfbb]/40 text-[#1e3326]"
                      : "bg-[#f2f1ec] text-[#5c695f]"
                }`}
              >
                {isDone && (
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                )}
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">
                  {isDone ? `Step ${i + 1}` : `Step ${i + 1}`}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step content */}
      <form onSubmit={handleSubmit} className="mt-6">
        <div className="rounded-xl border border-[#d7cfbb] bg-[#fffef9] p-6 shadow-sm">
          {step === 0 && (
            <StepCountryNace
              formData={formData}
              dispatch={dispatch}
              countries={countries}
              sections={sections}
              filteredNaceOptions={filteredNaceOptions}
            />
          )}
          {step === 1 && (
            <StepCompanyProfile formData={formData} dispatch={dispatch} />
          )}
          {step === 2 && (
            <StepModules formData={formData} dispatch={dispatch} />
          )}
          {step === 3 && (
            <StepReview
              formData={formData}
              countries={countries}
              naceOptions={naceOptions}
            />
          )}
        </div>

        {/* Navigation buttons */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                disabled={saving}
                className="rounded-lg border border-[#d7cfbb] bg-[#fffef9] px-5 py-2.5 text-sm font-medium text-[#1e3326] transition-colors hover:bg-[#f2f1ec] disabled:opacity-50"
              >
                Back
              </button>
            )}
          </div>
          <div>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg bg-[#1e3326] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2a4a38]"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#1e3326] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2a4a38] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Complete Setup"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Step 0: Country & NACE ───────────────────────────────────────────────

function StepCountryNace({
  formData,
  dispatch,
  countries,
  sections,
  filteredNaceOptions,
}: {
  formData: FormData;
  dispatch: React.Dispatch<FormAction>;
  countries: CountryOption[];
  sections: NaceSectionOption[];
  filteredNaceOptions: NaceCodeOption[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#1e3326]">
          Country &amp; NACE Code
        </h2>
        <p className="mt-1 text-sm text-[#5c695f]">
          Select the country and industry classification for your company.
        </p>
      </div>

      {/* Country */}
      <div>
        <label
          htmlFor="country"
          className="block text-sm font-medium text-[#1e3326]"
        >
          Country of operations
        </label>
        <select
          id="country"
          value={formData.country}
          onChange={(e) =>
            dispatch({ type: "SET_COUNTRY", value: e.target.value })
          }
          className="mt-1.5 block w-full rounded-lg border border-[#d7cfbb] bg-white px-3 py-2.5 text-sm text-[#1e3326] focus:border-[#1e3326] focus:outline-none focus:ring-1 focus:ring-[#1e3326]"
        >
          <option value="">— Select a country —</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* NACE Section */}
      <div>
        <label
          htmlFor="naceSection"
          className="block text-sm font-medium text-[#1e3326]"
        >
          NACE section
        </label>
        <select
          id="naceSection"
          value={formData.naceSection}
          onChange={(e) =>
            dispatch({ type: "SET_NACE_SECTION", value: e.target.value })
          }
          className="mt-1.5 block w-full rounded-lg border border-[#d7cfbb] bg-white px-3 py-2.5 text-sm text-[#1e3326] focus:border-[#1e3326] focus:outline-none focus:ring-1 focus:ring-[#1e3326]"
        >
          <option value="">— Select a NACE section —</option>
          {sections.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* NACE Code */}
      <div>
        <label
          htmlFor="naceCode"
          className="block text-sm font-medium text-[#1e3326]"
        >
          NACE division code
        </label>
        <select
          id="naceCode"
          value={formData.naceCode}
          onChange={(e) =>
            dispatch({ type: "SET_NACE_CODE", value: e.target.value })
          }
          className="mt-1.5 block w-full rounded-lg border border-[#d7cfbb] bg-white px-3 py-2.5 text-sm text-[#1e3326] focus:border-[#1e3326] focus:outline-none focus:ring-1 focus:ring-[#1e3326]"
          disabled={!formData.naceSection}
        >
          <option value="">— Select a NACE division code —</option>
          {filteredNaceOptions.map((o) => (
            <option key={o.code} value={o.code}>
              {o.code} — {o.description}
            </option>
          ))}
        </select>
        {!formData.naceSection && (
          <p className="mt-1 text-xs text-[#5c695f]">
            Select a NACE section first to see available division codes.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Company Profile ──────────────────────────────────────────────

function StepCompanyProfile({
  formData,
  dispatch,
}: {
  formData: FormData;
  dispatch: React.Dispatch<FormAction>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#1e3326]">
          Company Profile
        </h2>
        <p className="mt-1 text-sm text-[#5c695f]">
          Tell us about your company so we can tailor compliance tracking.
        </p>
      </div>

      {/* Company Name */}
      <div>
        <label
          htmlFor="companyName"
          className="block text-sm font-medium text-[#1e3326]"
        >
          Company name <span className="text-red-500">*</span>
        </label>
        <input
          id="companyName"
          type="text"
          value={formData.companyName}
          onChange={(e) =>
            dispatch({ type: "SET_COMPANY_NAME", value: e.target.value })
          }
          placeholder="e.g. Acme GmbH"
          className="mt-1.5 block w-full rounded-lg border border-[#d7cfbb] bg-white px-3 py-2.5 text-sm text-[#1e3326] placeholder-[#5c695f]/50 focus:border-[#1e3326] focus:outline-none focus:ring-1 focus:ring-[#1e3326]"
        />
      </div>

      {/* Business Address */}
      <div>
        <label
          htmlFor="businessAddress"
          className="block text-sm font-medium text-[#1e3326]"
        >
          Business address
        </label>
        <textarea
          id="businessAddress"
          rows={3}
          value={formData.businessAddress}
          onChange={(e) =>
            dispatch({ type: "SET_BUSINESS_ADDRESS", value: e.target.value })
          }
          placeholder="Street, city, postal code, country"
          className="mt-1.5 block w-full rounded-lg border border-[#d7cfbb] bg-white px-3 py-2.5 text-sm text-[#1e3326] placeholder-[#5c695f]/50 focus:border-[#1e3326] focus:outline-none focus:ring-1 focus:ring-[#1e3326]"
        />
      </div>

      {/* Incorporation Date */}
      <div>
        <label
          htmlFor="incorporationDate"
          className="block text-sm font-medium text-[#1e3326]"
        >
          Incorporation date <span className="text-red-500">*</span>
        </label>
        <input
          id="incorporationDate"
          type="date"
          value={formData.incorporationDate}
          onChange={(e) =>
            dispatch({
              type: "SET_INCORPORATION_DATE",
              value: e.target.value,
            })
          }
          className="mt-1.5 block w-full rounded-lg border border-[#d7cfbb] bg-white px-3 py-2.5 text-sm text-[#1e3326] focus:border-[#1e3326] focus:outline-none focus:ring-1 focus:ring-[#1e3326]"
        />
      </div>

      {/* Employee Count */}
      <div>
        <label
          htmlFor="employeeCount"
          className="block text-sm font-medium text-[#1e3326]"
        >
          Number of employees
        </label>
        <input
          id="employeeCount"
          type="number"
          min={0}
          value={formData.employeeCount}
          onChange={(e) =>
            dispatch({ type: "SET_EMPLOYEE_COUNT", value: e.target.value })
          }
          placeholder="e.g. 25"
          className="mt-1.5 block w-full rounded-lg border border-[#d7cfbb] bg-white px-3 py-2.5 text-sm text-[#1e3326] placeholder-[#5c695f]/50 focus:border-[#1e3326] focus:outline-none focus:ring-1 focus:ring-[#1e3326]"
        />
      </div>
    </div>
  );
}

// ─── Step 2: Modules ──────────────────────────────────────────────────────

function StepModules({
  formData,
  dispatch,
}: {
  formData: FormData;
  dispatch: React.Dispatch<FormAction>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#1e3326]">
          Compliance Modules
        </h2>
        <p className="mt-1 text-sm text-[#5c695f]">
          Select the compliance areas relevant to your business. You can always
          change these later.
        </p>
      </div>

      <div className="space-y-3">
        {AVAILABLE_MODULES.map((mod) => (
          <label
            key={mod.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              formData.modules.includes(mod.id)
                ? "border-[#1e3326] bg-[#1e3326]/5"
                : "border-[#d7cfbb] bg-white hover:bg-[#f2f1ec]/50"
            }`}
          >
            <input
              type="checkbox"
              checked={formData.modules.includes(mod.id)}
              onChange={() =>
                dispatch({ type: "TOGGLE_MODULE", value: mod.id })
              }
              className="mt-0.5 h-4 w-4 rounded border-[#d7cfbb] text-[#1e3326] focus:ring-[#1e3326]"
            />
            <span className="text-sm font-medium text-[#1e3326]">
              {mod.label}
            </span>
          </label>
        ))}
      </div>

      <p className="text-xs text-[#5c695f]">
        {formData.modules.length} module
        {formData.modules.length !== 1 ? "s" : ""} selected
      </p>
    </div>
  );
}

// ─── Step 3: Review & Complete ────────────────────────────────────────────

function StepReview({
  formData,
  countries,
  naceOptions,
}: {
  formData: FormData;
  countries: CountryOption[];
  naceOptions: NaceCodeOption[];
}) {
  const countryName =
    countries.find((c) => c.code === formData.country)?.name ??
    formData.country;

  const naceDescription =
    naceOptions.find((o) => o.code === formData.naceCode)?.description ??
    formData.naceCode;

  const selectedModules = AVAILABLE_MODULES.filter((m) =>
    formData.modules.includes(m.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#1e3326]">
          Review Your Setup
        </h2>
        <p className="mt-1 text-sm text-[#5c695f]">
          Please review the information below before completing your setup.
        </p>
      </div>

      {/* Summary cards */}
      <div className="space-y-4">
        {/* Country & NACE */}
        <SectionCard title="Country &amp; NACE">
          <SummaryRow label="Country" value={countryName} />
          <SummaryRow
            label="NACE section"
            value={formData.naceSection || "—"}
          />
          <SummaryRow
            label="NACE division"
            value={`${formData.naceCode} — ${naceDescription}`}
          />
        </SectionCard>

        {/* Company Profile */}
        <SectionCard title="Company Profile">
          <SummaryRow label="Company name" value={formData.companyName} />
          <SummaryRow
            label="Business address"
            value={formData.businessAddress || "—"}
          />
          <SummaryRow
            label="Incorporation date"
            value={
              formData.incorporationDate
                ? new Date(formData.incorporationDate).toLocaleDateString(
                    "en-GB",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                  )
                : "—"
            }
          />
          <SummaryRow
            label="Employees"
            value={
              formData.employeeCount
                ? Number(formData.employeeCount).toLocaleString()
                : "—"
            }
          />
        </SectionCard>

        {/* Modules */}
        <SectionCard title="Compliance Modules">
          {selectedModules.length > 0 ? (
            <ul className="space-y-1">
              {selectedModules.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 text-sm text-[#1e3326]"
                >
                  <svg
                    className="h-4 w-4 shrink-0 text-[#1e3326]"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  {m.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#5c695f]">No modules selected.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Mini helper components ───────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#d7cfbb] bg-[#f2f1ec]/40 p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#1e3326] uppercase tracking-wide">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-[#5c695f] whitespace-nowrap">{label}</span>
      <span className="text-right text-[#1e3326] font-medium">{value}</span>
    </div>
  );
}
