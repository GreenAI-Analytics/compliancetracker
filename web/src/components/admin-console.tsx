"use client";

import { useState } from "react";

type Stat = {
  totalOrgs: number;
  activeTrials: number;
  expiredTrials: number;
  signupsLast30Days: number;
  byCountry: { country: string; count: number }[];
  activeArticles: number;
};

type Org = {
  profileId: string;
  orgId: string;
  companyName: string;
  country: string;
  nace: string;
  employeeCount: number | null;
  signupDate: string;
  trialEndsAt: string | null;
  trialActive: boolean;
  daysLeft: number;
  onboardingCompleted: boolean;
  isSponsored: boolean;
  sponsoredReason: string | null;
  userEmail: string;
  userName: string | null;
};

type Article = {
  id: string;
  article_id: string;
  title: string;
  country: string;
  category: string;
  is_active: boolean;
  last_updated: string | null;
};

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#d7e5da] bg-white p-4">
      <div className="text-2xl font-bold text-[#1a2e22]">{value}</div>
      <div className="mt-0.5 text-sm font-medium text-[#2e7d32]">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-[#5f7668]">{sub}</div>}
    </div>
  );
}

function StatsPanel() {
  const [stats, setStats] = useState<Stat | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stats");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load stats");
      setStats(json as Stat);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1a2e22]">Stats Overview</h2>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-[#2e7d32] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#245f26] disabled:opacity-50"
        >
          {loading ? "Loading…" : stats ? "Refresh" : "Load Stats"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {stats && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Orgs" value={stats.totalOrgs} />
            <StatCard label="Active Trials" value={stats.activeTrials} />
            <StatCard label="Expired Trials" value={stats.expiredTrials} />
            <StatCard label="Signups (30d)" value={stats.signupsLast30Days} />
          </div>
          <StatCard label="Active Articles" value={stats.activeArticles} sub="Knowledge hub" />
          {stats.byCountry.length > 0 && (
            <div className="rounded-xl border border-[#d7e5da] bg-white p-4">
              <div className="mb-2 text-sm font-semibold text-[#1a2e22]">Orgs by Country</div>
              <div className="flex flex-wrap gap-2">
                {stats.byCountry.map((c) => (
                  <span
                    key={c.country}
                    className="rounded-full bg-[#e8f5e9] px-3 py-0.5 text-sm text-[#2e7d32]"
                  >
                    {c.country} — {c.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrgsPanel() {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState<Record<string, string>>({});
  const [sponsorReason, setSponsorReason] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/orgs");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load orgs");
      setOrgs((json as { orgs: Org[] }).orgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function extendTrial(orgId: string) {
    const days = parseInt(extendDays[orgId] ?? "30");
    if (!days || days < 1) return;
    setWorking(orgId + "-extend");
    try {
      const res = await fetch("/api/admin/extend-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, days }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setOrgs((prev) =>
        prev
          ? prev.map((o) =>
              o.orgId === orgId
                ? {
                    ...o,
                    trialEndsAt: (json as { newTrialEnd: string }).newTrialEnd,
                    trialActive: true,
                    daysLeft: days,
                  }
                : o
            )
          : prev
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setWorking(null);
    }
  }

  async function toggleSponsor(org: Org) {
    const isSponsored = !org.isSponsored;
    setWorking(org.orgId + "-sponsor");
    try {
      const res = await fetch("/api/admin/sponsor-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.orgId,
          isSponsored,
          reason: isSponsored ? (sponsorReason[org.orgId] ?? "") : "",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setOrgs((prev) =>
        prev
          ? prev.map((o) =>
              o.orgId === org.orgId
                ? {
                    ...o,
                    isSponsored,
                    sponsoredReason: isSponsored ? (sponsorReason[org.orgId] ?? null) : null,
                  }
                : o
            )
          : prev
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1a2e22]">Organisations</h2>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-[#2e7d32] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#245f26] disabled:opacity-50"
        >
          {loading ? "Loading…" : orgs ? "Refresh" : "Load Orgs"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {orgs && (
        <div className="mt-4 space-y-3">
          {orgs.length === 0 && (
            <p className="text-sm text-[#5f7668]">No organisations found.</p>
          )}
          {orgs.map((org) => (
            <div
              key={org.orgId}
              className="rounded-xl border border-[#d7e5da] bg-white p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-[#1a2e22]">{org.companyName}</span>
                  {org.isSponsored && (
                    <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                      Sponsored
                    </span>
                  )}
                  <div className="mt-0.5 text-xs text-[#5f7668]">
                    {org.userEmail} {org.userName ? `· ${org.userName}` : ""}
                  </div>
                  <div className="mt-0.5 text-xs text-[#5f7668]">
                    {org.country} · NACE {org.nace}
                    {org.employeeCount ? ` · ${org.employeeCount} employees` : ""}
                  </div>
                  <div className="mt-0.5 text-xs text-[#5f7668]">
                    Signed up: {new Date(org.signupDate).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  {org.isSponsored ? (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                      Sponsored
                    </span>
                  ) : (
                    <>
                      {org.trialActive ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          {org.daysLeft}d left
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
                          Trial expired
                        </span>
                      )}
                      {org.trialEndsAt && (
                        <div className="mt-0.5 text-xs text-[#5f7668]">
                          ends {new Date(org.trialEndsAt).toLocaleDateString()}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Extend trial */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-[#5f7668]">Extend trial:</span>
                <select
                  className="rounded border border-[#d7e5da] px-2 py-0.5 text-xs"
                  value={extendDays[org.orgId] ?? "30"}
                  onChange={(e) =>
                    setExtendDays((prev) => ({ ...prev, [org.orgId]: e.target.value }))
                  }
                >
                  {[7, 14, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => extendTrial(org.orgId)}
                  disabled={working === org.orgId + "-extend"}
                  className="rounded-lg border border-[#2e7d32] px-2 py-0.5 text-xs text-[#2e7d32] hover:bg-[#e8f5e9] disabled:opacity-50"
                >
                  {working === org.orgId + "-extend" ? "Saving…" : "Extend"}
                </button>
              </div>

              {/* Sponsor toggle */}
              <div className="mt-2 flex items-center gap-2">
                {!org.isSponsored && (
                  <input
                    type="text"
                    placeholder="Sponsor reason (optional)"
                    className="flex-1 rounded border border-[#d7e5da] px-2 py-0.5 text-xs"
                    value={sponsorReason[org.orgId] ?? ""}
                    onChange={(e) =>
                      setSponsorReason((prev) => ({ ...prev, [org.orgId]: e.target.value }))
                    }
                  />
                )}
                <button
                  onClick={() => toggleSponsor(org)}
                  disabled={working === org.orgId + "-sponsor"}
                  className={`rounded-lg px-2 py-0.5 text-xs disabled:opacity-50 ${
                    org.isSponsored
                      ? "border border-purple-300 text-purple-700 hover:bg-purple-50"
                      : "border border-[#d7e5da] text-[#5f7668] hover:bg-[#f8fbf9]"
                  }`}
                >
                  {working === org.orgId + "-sponsor"
                    ? "Saving…"
                    : org.isSponsored
                      ? "Remove Sponsor"
                      : "Mark Sponsored"}
                </button>
                {org.isSponsored && org.sponsoredReason && (
                  <span className="text-xs text-[#5f7668]">Reason: {org.sponsoredReason}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BillingPanel() {
  const [price, setPrice] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/billing-price");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setPrice((json as { price: string }).price);
      setSaved((json as { price: string }).price);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/billing-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setSaved((json as { price: string }).price);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1a2e22]">Billing Settings</h2>
      <p className="mt-1 text-sm text-[#5f7668]">
        Set the global monthly price shown to users. This does not affect payment processors
        directly — update Stripe separately.
      </p>
      <div className="mt-4 rounded-xl border border-[#d7e5da] bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#5f7668]">Monthly price (EUR)</span>
          {saved && !loading ? (
            <div className="flex items-center gap-2">
              <span className="rounded border border-[#d7e5da] px-3 py-1 text-sm font-medium text-[#1a2e22]">
                EUR {saved}
              </span>
              <button
                onClick={load}
                className="text-xs text-[#2e7d32] underline"
              >
                Edit
              </button>
            </div>
          ) : (
            <button
              onClick={load}
              disabled={loading}
              className="rounded-lg bg-[#2e7d32] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#245f26] disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load Current Price"}
            </button>
          )}
        </div>
        {saved && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-[#5f7668]">EUR</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-32 rounded border border-[#d7e5da] px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2e7d32]"
            />
            <button
              onClick={save}
              disabled={saving || price === saved}
              className="rounded-lg bg-[#2e7d32] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#245f26] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function SyncPanel() {
  const [results, setResults] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);

  async function runSync(target: "knowledge" | "rules") {
    setWorking(target);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResults((prev) => ({
          ...prev,
          [target]: `Error: ${(json as { error: string }).error}`,
        }));
      } else {
        setResults((prev) => ({
          ...prev,
          [target]: JSON.stringify((json as { result: unknown }).result, null, 2),
        }));
      }
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [target]: `Error: ${e instanceof Error ? e.message : "Unknown"}`,
      }));
    } finally {
      setWorking(null);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1a2e22]">Data Sync</h2>
      <p className="mt-1 text-sm text-[#5f7668]">
        Trigger Edge Functions to pull latest data from the compliance-knowledge and
        compliance-rules repositories.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {(["knowledge", "rules"] as const).map((target) => (
          <div key={target} className="rounded-xl border border-[#d7e5da] bg-white p-4">
            <div className="font-medium capitalize text-[#1a2e22]">
              {target === "knowledge" ? "Knowledge Hub" : "Compliance Rules"}
            </div>
            <p className="mt-1 text-xs text-[#5f7668]">
              {target === "knowledge"
                ? "Syncs articles from the compliance-knowledge repo."
                : "Syncs task rules from the compliance-rules repo."}
            </p>
            <button
              onClick={() => runSync(target)}
              disabled={working === target}
              className="mt-3 rounded-lg bg-[#2e7d32] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#245f26] disabled:opacity-50"
            >
              {working === target ? "Running…" : "Run Sync"}
            </button>
            {results[target] && (
              <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-[#f0f4f1] p-2 text-xs text-[#2e4b3c]">
                {results[target]}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ArticlesPanel() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/articles");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setArticles((json as { articles: Article[] }).articles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(article: Article) {
    setToggling(article.article_id);
    try {
      const res = await fetch("/api/admin/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.article_id, isActive: !article.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setArticles((prev) =>
        prev
          ? prev.map((a) =>
              a.article_id === article.article_id ? { ...a, is_active: !a.is_active } : a
            )
          : prev
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setToggling(null);
    }
  }

  const filtered = articles
    ? articles.filter(
        (a) =>
          !filter ||
          a.title.toLowerCase().includes(filter.toLowerCase()) ||
          a.country.toLowerCase().includes(filter.toLowerCase()) ||
          a.category.toLowerCase().includes(filter.toLowerCase())
      )
    : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1a2e22]">Knowledge Articles</h2>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-[#2e7d32] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#245f26] disabled:opacity-50"
        >
          {loading ? "Loading…" : articles ? "Refresh" : "Load Articles"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {articles && (
        <>
          <input
            type="text"
            placeholder="Filter by title, country, or category…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mt-3 w-full rounded-lg border border-[#d7e5da] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2e7d32]"
          />
          <div className="mt-3 space-y-1.5">
            {filtered?.length === 0 && (
              <p className="text-sm text-[#5f7668]">No articles match.</p>
            )}
            {filtered?.map((article) => (
              <div
                key={article.article_id}
                className="flex items-center justify-between rounded-lg border border-[#d7e5da] bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[#1a2e22]">
                    {article.title}
                  </div>
                  <div className="text-xs text-[#5f7668]">
                    {article.country} · {article.category}
                    {article.last_updated ? ` · ${article.last_updated}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(article)}
                  disabled={toggling === article.article_id}
                  className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs disabled:opacity-50 ${
                    article.is_active
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {toggling === article.article_id
                    ? "…"
                    : article.is_active
                      ? "Active"
                      : "Inactive"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const TABS = [
  { id: "stats", label: "Stats" },
  { id: "orgs", label: "Organisations" },
  { id: "billing", label: "Billing" },
  { id: "sync", label: "Data Sync" },
  { id: "articles", label: "Articles" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminConsole({ email }: { email: string }) {
  const [tab, setTab] = useState<TabId>("stats");

  return (
    <div className="mt-6">
      <div className="rounded-lg border border-[#d7e5da] bg-[#f8fbf9] px-4 py-3 text-sm text-[#2e4b3c]">
        Signed in as <span className="font-semibold">{email}</span>
      </div>

      {/* Tab bar */}
      <div className="mt-4 flex flex-wrap gap-1 border-b border-[#d7e5da] pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border border-b-white border-[#d7e5da] bg-white text-[#2e7d32]"
                : "text-[#5f7668] hover:text-[#1a2e22]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-5">
        {tab === "stats" && <StatsPanel />}
        {tab === "orgs" && <OrgsPanel />}
        {tab === "billing" && <BillingPanel />}
        {tab === "sync" && <SyncPanel />}
        {tab === "articles" && <ArticlesPanel />}
      </div>
    </div>
  );
}
