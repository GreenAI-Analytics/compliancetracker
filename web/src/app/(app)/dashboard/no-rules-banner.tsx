"use client";

export default function NoRulesBanner() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg" aria-hidden="true">
          ⏳
        </span>
        <div>
          <h3 className="text-base font-semibold text-amber-900">
            Compliance rules not yet available
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            The compliance rules for your country and NACE code are synced
            nightly and may not be available yet. Please check back later.
          </p>
          <p className="mt-2 text-sm text-amber-700">
            If this persists, contact your account administrator or support
            team for assistance.
          </p>
        </div>
      </div>
    </div>
  );
}
