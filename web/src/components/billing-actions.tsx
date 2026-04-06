"use client";

import { useState } from "react";

type Props = {
  isSponsored: boolean;
  hasStripeCustomer: boolean;
  subscriptionStatus: string | null;
};

export function BillingActions({ isSponsored, hasStripeCustomer, subscriptionStatus }: Props) {
  const [loadingAction, setLoadingAction] = useState<"checkout" | "portal" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function trigger(action: "checkout" | "portal") {
    setLoadingAction(action);
    setMessage(null);
    setError(null);

    try {
      const endpoint = action === "checkout" ? "/api/billing/checkout" : "/api/billing/portal";
      const res = await fetch(endpoint, {
        method: "POST",
      });

      const body = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            url?: string;
          }
        | null;

      if (!res.ok) {
        throw new Error(body?.error ?? "Request failed.");
      }

      if (!body?.url) {
        throw new Error("Stripe did not return a redirect URL.");
      }

      setMessage(action === "checkout" ? "Redirecting to Stripe checkout..." : "Opening billing portal...");
      window.location.href = body.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoadingAction(null);
    }
  }

  const normalizedStatus = subscriptionStatus?.toLowerCase() ?? null;

  return (
    <section className="mt-6 rounded-xl border border-[#d7e5da] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#1a2e22]">Stripe Billing</h2>
      {isSponsored ? (
        <p className="mt-1 text-sm text-[#5f7668]">Sponsored organizations do not require Stripe billing.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[#5f7668]">
            Manage your subscription and payment method securely via Stripe.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {normalizedStatus ? (
              <span className="rounded-full border border-[#cfe0d3] bg-[#f3f8f4] px-2.5 py-1 text-xs font-medium capitalize text-[#355143]">
                Status: {normalizedStatus.replace(/_/g, " ")}
              </span>
            ) : (
              <span className="rounded-full border border-[#e8d8cc] bg-[#fff4ee] px-2.5 py-1 text-xs font-medium text-[#9f4b2a]">
                No active Stripe subscription
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => trigger("checkout")}
              disabled={loadingAction !== null}
              className="rounded-lg bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#25672a] disabled:opacity-60"
            >
              {loadingAction === "checkout" ? "Starting..." : hasStripeCustomer ? "Update Subscription" : "Start Subscription"}
            </button>
            <button
              onClick={() => trigger("portal")}
              disabled={loadingAction !== null || !hasStripeCustomer}
              className="rounded-lg border border-[#cfe0d3] bg-white px-4 py-2 text-sm font-medium text-[#1f3428] hover:bg-[#f4faf5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAction === "portal" ? "Opening..." : "Manage Billing Portal"}
            </button>
          </div>
        </>
      )}

      {message && <p className="mt-3 text-xs text-[#256338]">{message}</p>}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </section>
  );
}
