"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PaymentInformation = {
  billingContactName: string;
  billingEmail: string;
  billingAddress: string;
  vatNumber: string;
  purchaseOrderRef: string;
  paymentMethod: "card" | "bank_transfer" | "invoice" | "other";
};

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentInformation["paymentMethod"]; label: string }> = [
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "invoice", label: "Invoice" },
  { value: "other", label: "Other" },
];

export function PaymentInformationForm({
  initialValue,
  disabled,
}: {
  initialValue: PaymentInformation;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [billingContactName, setBillingContactName] = useState(initialValue.billingContactName);
  const [billingEmail, setBillingEmail] = useState(initialValue.billingEmail);
  const [billingAddress, setBillingAddress] = useState(initialValue.billingAddress);
  const [vatNumber, setVatNumber] = useState(initialValue.vatNumber);
  const [purchaseOrderRef, setPurchaseOrderRef] = useState(initialValue.purchaseOrderRef);
  const [paymentMethod, setPaymentMethod] = useState<PaymentInformation["paymentMethod"]>(
    initialValue.paymentMethod
  );
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSavedMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/settings/payment-information", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingContactName,
          billingEmail,
          billingAddress,
          vatNumber,
          purchaseOrderRef,
          paymentMethod,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save payment information.");
      }

      setSavedMessage("Payment information saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save payment information.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      {error && (
        <div className="rounded-lg border border-[#f3d2c5] bg-[#fff2ec] px-3 py-2 text-xs text-[#9f4b2a]">
          {error}
        </div>
      )}
      {savedMessage && (
        <div className="rounded-lg border border-[#cde6d3] bg-[#edf7ef] px-3 py-2 text-xs text-[#256338]">
          {savedMessage}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#5f7668]">Billing contact name</span>
          <input
            value={billingContactName}
            onChange={(e) => setBillingContactName(e.target.value)}
            disabled={disabled || saving}
            placeholder="e.g. Jane Doe"
            className="rounded-lg border border-[#cfe0d3] bg-white px-3 py-2 text-sm text-[#173224] outline-none focus:border-[#2e7d32]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#5f7668]">Billing email</span>
          <input
            type="email"
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
            disabled={disabled || saving}
            placeholder="billing@yourcompany.com"
            className="rounded-lg border border-[#cfe0d3] bg-white px-3 py-2 text-sm text-[#173224] outline-none focus:border-[#2e7d32]"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[#5f7668]">Billing address</span>
        <textarea
          rows={3}
          value={billingAddress}
          onChange={(e) => setBillingAddress(e.target.value)}
          disabled={disabled || saving}
          placeholder="Street, City, Postal code, Country"
          className="rounded-lg border border-[#cfe0d3] bg-white px-3 py-2 text-sm text-[#173224] outline-none focus:border-[#2e7d32]"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#5f7668]">VAT / Tax ID</span>
          <input
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            disabled={disabled || saving}
            placeholder="e.g. IE1234567A"
            className="rounded-lg border border-[#cfe0d3] bg-white px-3 py-2 text-sm text-[#173224] outline-none focus:border-[#2e7d32]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#5f7668]">PO reference</span>
          <input
            value={purchaseOrderRef}
            onChange={(e) => setPurchaseOrderRef(e.target.value)}
            disabled={disabled || saving}
            placeholder="Optional purchase order number"
            className="rounded-lg border border-[#cfe0d3] bg-white px-3 py-2 text-sm text-[#173224] outline-none focus:border-[#2e7d32]"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 sm:max-w-xs">
        <span className="text-xs font-medium text-[#5f7668]">Preferred payment method</span>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentInformation["paymentMethod"])}
          disabled={disabled || saving}
          className="rounded-lg border border-[#cfe0d3] bg-white px-3 py-2 text-sm text-[#173224] outline-none focus:border-[#2e7d32]"
        >
          {PAYMENT_METHOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <button
          type="submit"
          disabled={disabled || saving}
          className="rounded-lg bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#25672a] disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Payment Information"}
        </button>
      </div>
    </form>
  );
}
