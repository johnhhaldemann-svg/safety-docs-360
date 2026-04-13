"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const capabilityTiles = [
  "Inspections",
  "Field Teams",
  "Compliance",
];

const securityPills = ["ISO 45001", "SOC 2 Type II", "AES-256", "OSHA Ready"];

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitedEmail = searchParams.get("email") ?? "";
  const inviteMode = searchParams.get("mode") === "signup";
  const inviteType = searchParams.get("invite");
  const inviteSignupEnabled = inviteMode && !!invitedEmail;
  const inviteNotice =
    inviteType === "company" && invitedEmail
      ? "Your company access is ready. Create your account with this approved email to join the company workspace."
      : "";

  const [mode, setMode] = useState<"login" | "signup">(inviteSignupEnabled ? "signup" : "login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formMessage, setFormMessage] = useState(inviteNotice);
  const [formTone, setFormTone] = useState<"error" | "success">("success");

  async function handleLogin() {
    setFormMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setFormTone("error");
      setFormMessage(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleCreateAccount() {
    setFormMessage("");

    if (!agreed) {
      setFormTone("error");
      setFormMessage("You must accept the agreement before creating an account.");
      return;
    }

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setFormTone("error");
      setFormMessage("Full name, email, and password are required.");
      return;
    }

    if (password !== confirmPassword) {
      setFormTone("error");
      setFormMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName,
        email,
        password,
        agreed,
      }),
    });

    const data = (await res.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;

    setLoading(false);

    if (!res.ok) {
      setFormTone("error");
      setFormMessage(data?.error || "Failed to create your account.");
      return;
    }

    setMode("login");
    setFullName("");
    setPassword("");
    setConfirmPassword("");
    setAgreed(false);
    setFormTone("success");
    setFormMessage(
      data?.message ||
        "Account created. Sign in to build your construction profile, then create your company workspace or join an invited company."
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,125,243,0.14),_transparent_24%),linear-gradient(180deg,_#f7fbff_0%,_#eef5ff_48%,_#e7f0fb_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-[rgba(111,138,177,0.28)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.94)_0%,_rgba(241,247,255,0.96)_100%)] shadow-[0_28px_72px_rgba(38,64,106,0.16)] lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative overflow-hidden border-b border-[rgba(111,138,177,0.2)] bg-[radial-gradient(circle_at_top_left,_rgba(79,125,243,0.12),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.94)_0%,_rgba(235,243,255,0.92)_100%)] px-6 py-7 sm:px-8 sm:py-8 lg:min-h-[760px] lg:border-b-0 lg:border-r lg:border-r-[rgba(111,138,177,0.2)] lg:px-10 lg:py-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.36)_0%,_transparent_38%),radial-gradient(circle_at_bottom,_rgba(46,158,91,0.12),_transparent_26%)]" />
            <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(111,138,177,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(111,138,177,0.08)_1px,transparent_1px)] [background-size:38px_38px]" />

            <div className="relative z-10 flex h-full flex-col">
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-[rgba(46,158,91,0.2)] bg-[rgba(46,158,91,0.1)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#2e9e5b]">
                  Systems live
                </div>
              </div>

              <div className="mt-10 max-w-xl">
                <h1 className="text-4xl font-black leading-[0.95] tracking-tight text-[#143252] sm:text-5xl lg:text-[4.1rem]">
                  <span className="block">Secure.</span>
                  <span className="block text-[#2e9e5b]">Document.</span>
                  <span className="block">Stay Safe.</span>
                </h1>

                <p className="mt-6 max-w-lg text-base leading-8 text-[#496581]">
                  The complete safety documentation platform trusted by industrial
                  leaders. Manage incidents, inspections, and compliance from one
                  secure command center.
                </p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {capabilityTiles.map((tile, index) => (
                  <div
                    key={tile}
                    className="group relative overflow-hidden rounded-2xl border border-[rgba(111,138,177,0.2)] bg-white/82 p-3 shadow-[0_10px_22px_rgba(38,64,106,0.08)]"
                  >
                    <div
                      className={[
                        "h-20 rounded-xl",
                        index === 0
                          ? "bg-[linear-gradient(135deg,_rgba(251,191,36,0.30),_rgba(15,23,42,0.30)),radial-gradient(circle_at_top_left,_rgba(255,255,255,0.25),_transparent_45%)]"
                          : index === 1
                            ? "bg-[linear-gradient(135deg,_rgba(56,189,248,0.26),_rgba(15,23,42,0.24)),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.22),_transparent_45%)]"
                            : "bg-[linear-gradient(135deg,_rgba(148,163,184,0.24),_rgba(245,158,11,0.20)),radial-gradient(circle_at_center,_rgba(255,255,255,0.22),_transparent_50%)]",
                      ].join(" ")}
                    />
                    <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-[rgba(20,50,82,0.08)] px-3 py-2 backdrop-blur">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-[#143252]">
                        {tile}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-8">
                <div className="flex flex-wrap gap-3">
                  {securityPills.map((pill) => (
                    <div
                      key={pill}
                      className="rounded-xl border border-[rgba(111,138,177,0.18)] bg-white/78 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#496581]"
                    >
                      {pill}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center bg-[linear-gradient(180deg,_rgba(247,251,255,0.92)_0%,_rgba(234,241,255,0.94)_100%)] px-5 py-7 sm:px-8 lg:px-10">
            <div className="w-full max-w-md">
              <div className="rounded-[1.8rem] border border-[rgba(111,138,177,0.24)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(241,247,255,0.96)_100%)] p-6 shadow-[0_22px_54px_rgba(38,64,106,0.14)] backdrop-blur sm:p-8">
                <div>
                  <p className="text-3xl font-black leading-tight tracking-tight text-[#143252] sm:text-4xl">
                    Secure Access
                    <br />
                    Portal
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#5f7a98]">
                    Sign in to your Safety360Docs workspace.
                  </p>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl border border-[rgba(111,138,177,0.2)] bg-[rgba(234,241,255,0.8)] p-1.5">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className={[
                      "rounded-xl px-4 py-3 text-sm font-semibold transition",
                      mode === "login"
                        ? "bg-white text-[#143252] ring-1 ring-[rgba(111,138,177,0.16)] shadow-sm"
                        : "text-[#6b84a0] hover:text-[#143252]",
                    ].join(" ")}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      if (!formMessage) {
                        setFormTone("success");
                        setFormMessage(
                          inviteSignupEnabled
                            ? inviteNotice
                            : "Create your account first. After sign-in, you will build your construction profile before company setup or employee access."
                        );
                      }
                    }}
                    className={[
                      "rounded-xl px-4 py-3 text-sm font-semibold transition",
                      mode === "signup"
                        ? "bg-white text-[#143252] ring-1 ring-[rgba(111,138,177,0.16)] shadow-sm"
                        : "text-[#6b84a0] hover:text-[#143252]",
                    ].join(" ")}
                  >
                    Create Account
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-[rgba(111,138,177,0.2)] bg-[rgba(234,241,255,0.76)] px-4 py-3 text-sm text-[#496581]">
                  <div className="font-semibold text-[#143252]">
                    Create your own account first, then build your construction profile before company setup or employee access.
                  </div>
                  <div className="mt-1 text-[#5f7a98]">
                    Internal employees, company owners, and invited employees all start from the same account-first entry point.
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  {formMessage ? (
                    <div
                      data-testid={formTone === "error" ? "login-error" : "login-success"}
                      className={[
                        "rounded-2xl border px-4 py-3 text-sm",
                        formTone === "error"
                          ? "border-[rgba(217,83,79,0.24)] bg-[rgba(253,236,236,0.96)] text-[#a33f3c]"
                          : "border-[rgba(46,158,91,0.22)] bg-[rgba(231,246,236,0.96)] text-[#2e9e5b]",
                      ].join(" ")}
                    >
                      {formMessage}
                    </div>
                  ) : null}

                  <div>
                    {mode === "signup" ? (
                      <>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#6b84a0]">
                          Full Name
                        </label>
                        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[rgba(111,138,177,0.22)] bg-white px-4 py-3.5 text-[#6b84a0] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition focus-within:border-[rgba(79,125,243,0.35)] focus-within:bg-white">
                          <IconUser />
                          <input
                            type="text"
                            placeholder="Your full name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="auth-input w-full bg-transparent text-sm text-[#143252] outline-none placeholder:text-[#8aa0b8]"
                          />
                        </div>
                      </>
                    ) : null}

                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#6b84a0]">
                      Employee ID / Email
                    </label>
                    <div className="flex items-center gap-3 rounded-2xl border border-[rgba(111,138,177,0.22)] bg-white px-4 py-3.5 text-[#6b84a0] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition focus-within:border-[rgba(79,125,243,0.35)] focus-within:bg-white">
                      <IconMail />
                      <input
                        type="text"
                        inputMode="email"
                        autoComplete="username"
                        placeholder="name@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="auth-input w-full bg-transparent text-sm text-[#143252] outline-none placeholder:text-[#8aa0b8]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#6b84a0]">
                      Password
                    </label>
                    <div className="flex items-center gap-3 rounded-2xl border border-[rgba(111,138,177,0.22)] bg-white px-4 py-3.5 text-[#6b84a0] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition focus-within:border-[rgba(79,125,243,0.35)] focus-within:bg-white">
                      <IconLock />
                      <input
                        type="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="auth-input w-full bg-transparent text-sm text-[#143252] outline-none placeholder:text-[#8aa0b8]"
                      />
                      <IconEye />
                    </div>
                  </div>

                  {mode === "signup" ? (
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#6b84a0]">
                        Confirm Password
                      </label>
                      <div className="flex items-center gap-3 rounded-2xl border border-[rgba(111,138,177,0.22)] bg-white px-4 py-3.5 text-[#6b84a0] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition focus-within:border-[rgba(79,125,243,0.35)] focus-within:bg-white">
                        <IconLock />
                        <input
                          type="password"
                          placeholder="Confirm password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="auth-input w-full bg-transparent text-sm text-[#143252] outline-none placeholder:text-[#8aa0b8]"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-4">
                    <label className="inline-flex items-center gap-3 text-sm text-[#5f7a98]">
                      <input
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        className="h-4 w-4 rounded border-[rgba(111,138,177,0.28)] bg-white"
                      />
                      <span>Remember this device</span>
                    </label>
                  </div>

                  <div className="rounded-2xl border border-[rgba(111,138,177,0.2)] bg-[rgba(234,241,255,0.76)] px-4 py-3 text-sm text-[#5f7a98]">
                    Need help accessing your workspace? Create your account first, complete your construction profile, and the app will guide you through company setup or your invite flow.
                  </div>

                  {mode === "signup" ? (
                    <div className="rounded-2xl border border-[rgba(111,138,177,0.2)] bg-[rgba(234,241,255,0.76)] p-4">
                      <LegalAcceptanceBlock checked={agreed} onChange={setAgreed} compact />
                    </div>
                  ) : null}

                  <button
                    onClick={mode === "login" ? handleLogin : handleCreateAccount}
                    disabled={loading || (mode === "signup" && !agreed)}
                    className="w-full rounded-2xl bg-[var(--app-accent-primary)] px-4 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_16px_36px_rgba(79,125,243,0.24)] transition hover:bg-[var(--app-accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading
                      ? mode === "login"
                        ? "Accessing workspace..."
                        : "Creating account..."
                      : mode === "login"
                        ? "Access Workspace"
                        : "Create Account"}
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-[rgba(46,158,91,0.2)] bg-[rgba(231,246,236,0.96)] px-4 py-4 text-sm text-[#2e9e5b]">
                  TLS 1.3 encrypted. Zero-knowledge architecture ready. 2FA supported.
                </div>

                <div className="mt-5 rounded-2xl border border-[rgba(79,125,243,0.2)] bg-[rgba(234,241,255,0.92)] px-4 py-4 text-sm text-[#496581]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-[#143252]">New here?</p>
                      <p className="mt-1 text-[#496581]">
                        Create your account first. After you sign in, the app will walk you through your construction profile, company setup, and employee invites.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setFormTone("success");
                        setFormMessage(
                          "Create your account first. After sign-in, you will build your construction profile, launch your company workspace, and then invite employees."
                        );
                      }}
                      className="inline-flex items-center justify-center rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)]"
                    >
                      Create Account
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[rgba(217,164,65,0.2)] bg-[rgba(255,244,219,0.96)] px-4 py-4 text-sm text-[#805d17]">
                  If you are joining an existing company, create your account with the exact invited email. Your construction profile comes first, and the app keeps access scoped to that company workspace.
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-[#6b84a0] sm:px-6 lg:px-8">
        <Link href="/terms" className="font-semibold text-[#5f7a98] hover:text-[#143252]">
          Terms
        </Link>
        <span className="mx-2 text-[#8aa0b8]" aria-hidden>
          ·
        </span>
        <Link href="/privacy" className="font-semibold text-[#5f7a98] hover:text-[#143252]">
          Privacy
        </Link>
        <span className="mx-2 text-[#8aa0b8]" aria-hidden>
          ·
        </span>
        <Link href="/liability-waiver" className="font-semibold text-[#5f7a98] hover:text-[#143252]">
          Liability waiver
        </Link>
      </footer>
    </main>
  );
}

function LoginPageFallback() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,125,243,0.14),_transparent_24%),linear-gradient(180deg,_#f7fbff_0%,_#eef5ff_48%,_#e7f0fb_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-center justify-center">
        <div className="w-full max-w-md rounded-[1.8rem] border border-[rgba(111,138,177,0.24)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(241,247,255,0.96)_100%)] p-8 text-center text-[#496581] shadow-[0_22px_54px_rgba(38,64,106,0.14)]">
          Loading secure access portal...
        </div>
      </div>
    </main>
  );
}

function IconUser() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm0 2v.2l8 5.2 8-5.2V8H4Z" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V7Z" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 text-[#8aa0b8]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
