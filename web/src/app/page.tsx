import Image from "next/image";
import Link from "next/link";

const highlights = [
  "Country and NACE-specific compliance tasks out of the box",
  "One workspace for deadlines, calendar views, and evidence tracking",
  "Operational controls for hidden tasks, custom tasks, and reminders",
];

const trustSignals = [
  "Built for EU SMEs with role-based organization workflows",
  "Automated nightly sync of compliance rules and guidance",
  "Hosted on modern infrastructure with managed authentication",
];

const steps = [
  {
    title: "Onboard in minutes",
    detail:
      "Select your country, NACE code, and company profile to generate your baseline obligations.",
  },
  {
    title: "Run compliance in one place",
    detail:
      "Track status, owners, and due dates across dashboard, compliance, and historical views.",
  },
  {
    title: "Stay continuously updated",
    detail:
      "Rules and knowledge updates sync automatically so your team always works from current guidance.",
  },
];

export default function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen px-4 py-8 md:py-14">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.35fr_0.9fr]">
        <section className="rounded-3xl border border-[#d9d2bf] bg-[#fffdf8] p-7 shadow-[0_20px_50px_rgba(29,42,36,0.1)] md:p-12">
          <Image
            src="/compliance-tracker-logo.png"
            alt="Compliance Tracker"
            width={360}
            height={96}
            className="h-auto w-[220px] md:w-[320px]"
            style={{ width: "auto", height: "auto" }}
            priority
          />
          <div className="pill mt-4 inline-flex rounded-full px-3 py-1 text-xs">
            Built for EU SMEs
          </div>
          <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">
            Compliance operations, without spreadsheet chaos.
          </h1>
          <p className="mt-5 max-w-2xl text-[#516058]">
            Compliance Tracker turns country and NACE obligations into clear
            weekly execution, so your team can act early, stay audit-ready, and
            avoid missed deadlines.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login?mode=signup"
              className="rounded-xl bg-[var(--accent)] px-5 py-3 font-medium text-white hover:bg-[var(--accent-strong)]"
            >
              Sign Up
            </Link>
            <Link
              href="/login?fresh=1"
              className="rounded-xl border border-[#cfc7b3] px-5 py-3 text-[#25312b] hover:bg-[#f3efe3]"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-xs text-[#6b7a71]">
            No setup consultant required. Account activation takes a few
            minutes.
          </p>

          <div className="mt-10 grid gap-3">
            {highlights.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-xl bg-[#f7f3ea] px-4 py-3 text-sm text-[#415048]"
              >
                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#ddd4bf] bg-[#fff] px-4 py-3">
              <div className="text-xs font-semibold tracking-[0.08em] text-[#607067]">
                FOCUS
              </div>
              <div className="mt-1 text-sm font-semibold">EU SME workflow</div>
            </div>
            <div className="rounded-xl border border-[#ddd4bf] bg-[#fff] px-4 py-3">
              <div className="text-xs font-semibold tracking-[0.08em] text-[#607067]">
                COVERAGE
              </div>
              <div className="mt-1 text-sm font-semibold">
                Country + NACE mapping
              </div>
            </div>
            <div className="rounded-xl border border-[#ddd4bf] bg-[#fff] px-4 py-3">
              <div className="text-xs font-semibold tracking-[0.08em] text-[#607067]">
                OPERATIONS
              </div>
              <div className="mt-1 text-sm font-semibold">
                Tasks, reminders, calendar
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#d9d2bf] bg-[#fcfbf6] p-6 shadow-[0_14px_30px_rgba(29,42,36,0.08)] md:p-8">
          <div className="pill inline-flex rounded-full px-3 py-1 text-xs">
            How it works
          </div>
          <div className="mt-5 space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-[#e1d9c7] bg-white px-4 py-4"
              >
                <div className="text-xs font-semibold tracking-[0.16em] text-[#0c7d58]">
                  STEP 0{index + 1}
                </div>
                <h2 className="mt-2 text-lg font-bold">{step.title}</h2>
                <p className="mt-1 text-sm text-[#5a665f]">{step.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-[#d8cfbb] bg-white px-4 py-4">
            <h3 className="text-sm font-semibold">
              Why teams pick Compliance Tracker
            </h3>
            <ul className="mt-2 space-y-2 text-sm text-[#4c5f55]">
              {trustSignals.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#1f8a62]">●</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-2xl bg-[#15372d] p-5 text-[#eef8f3]">
            <div className="text-sm font-semibold">
              Ready to run your first compliance cycle?
            </div>
            <p className="mt-1 text-sm text-[#d5ece2]">
              Create your account, complete onboarding, and start with your
              first prioritized task list today.
            </p>
            <Link
              href="/login?mode=signup"
              className="mt-4 inline-flex rounded-lg bg-[#8de1b8] px-4 py-2 text-sm font-medium text-[#103126]"
            >
              Create account
            </Link>
          </div>

          <p className="mt-4 text-xs text-[#6b7a71]">
            © {year} Compliance Tracker
          </p>
        </section>
      </div>
    </div>
  );
}
