import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";

type Body = {
  email?: string;
};

type ReminderItem = {
  title: string;
  dueDate: string;
  categoryName?: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatDisplayDate(date: string): string {
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pluralizeDays(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

function isoDateDaysFromToday(days: number): string {
  const now = new Date();
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() + days);
  return utcMidnight.toISOString().slice(0, 10);
}

function buildEmailText(
  recipientName: string | null,
  daysBefore: number,
  items: ReminderItem[],
  appBaseUrl: string,
): string {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,";
  const intro = `You have ${items.length} compliance task${items.length === 1 ? "" : "s"} due in ${pluralizeDays(daysBefore)}.`;
  const lines = items.map((item) => {
    const category = item.categoryName ? ` [${item.categoryName}]` : "";
    return `- ${item.title}${category} - due ${formatDisplayDate(item.dueDate)}`;
  });

  const footer = appBaseUrl ? `\nOpen your dashboard: ${appBaseUrl}/dashboard` : "";
  return [greeting, "", intro, "", ...lines, footer].join("\n").trim();
}

function buildEmailHtml(
  recipientName: string | null,
  daysBefore: number,
  items: ReminderItem[],
  appBaseUrl: string,
): string {
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : "Hi,";
  const list = items
    .map((item) => {
      const category = item.categoryName
        ? `<div style="color:#5f7668;font-size:12px;">${escapeHtml(item.categoryName)}</div>`
        : "";

      return `
        <li style="margin:0 0 12px;">
          <div style="font-weight:600;color:#173224;">${escapeHtml(item.title)}</div>
          ${category}
          <div style="color:#355143;font-size:13px;">Due ${escapeHtml(formatDisplayDate(item.dueDate))}</div>
        </li>`;
    })
    .join("");

  const dashboardLink = appBaseUrl
    ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(`${appBaseUrl}/dashboard`)}" style="display:inline-block;background:#2e7d32;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open Dashboard</a></p>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#173224;">
      <h1 style="margin:0 0 16px;font-size:24px;">Upcoming compliance reminders</h1>
      <p style="margin:0 0 12px;">${greeting}</p>
      <p style="margin:0 0 16px;">You have ${items.length} compliance task${items.length === 1 ? "" : "s"} due in ${pluralizeDays(daysBefore)}.</p>
      <ul style="padding-left:20px;margin:0;">${list}</ul>
      ${dashboardLink}
    </div>`;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const email = body?.email?.trim().toLowerCase() ?? "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.REMINDER_FROM_EMAIL?.trim();

  if (!resendApiKey || !fromEmail) {
    return NextResponse.json(
      { error: "Missing RESEND_API_KEY or REMINDER_FROM_EMAIL in app environment." },
      { status: 500 }
    );
  }

  const appBaseUrl =
    process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ??
    request.nextUrl.origin.replace(/\/$/, "");

  const daysBefore = 7;
  const dueDate = isoDateDaysFromToday(daysBefore);
  const items: ReminderItem[] = [
    { title: "VAT return filing", dueDate, categoryName: "Tax" },
    { title: "Payroll tax remittance", dueDate, categoryName: "Payroll" },
    { title: "Health & safety incident register review", dueDate, categoryName: "HSE" },
  ];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: `[Test] Compliance reminder: ${items.length} tasks due in ${pluralizeDays(daysBefore)}`,
      text: buildEmailText(null, daysBefore, items, appBaseUrl),
      html: buildEmailHtml(null, daysBefore, items, appBaseUrl),
    }),
  });

  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.message ?? `Resend request failed with status ${response.status}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, id: payload?.id ?? null });
}