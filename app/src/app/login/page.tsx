"use client";

import { signIn } from "next-auth/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { LogIn, GitBranch, Globe, KeyRound, Loader2, ArrowLeft, Key, Mail } from "lucide-react";

const OAUTH_PROVIDERS = [
  { id: "github", name: "GitHub", Icon: GitBranch },
  { id: "google", name: "Google", Icon: Globe },
  { id: "busibox-sso", name: "Busibox SSO", Icon: KeyRound },
] as const;

type Step = "email" | "verify";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleOAuth = async (providerId: string) => {
    setLoading(providerId);
    await signIn(providerId, { callbackUrl: "/dashboard" });
  };

  const sendCode = useCallback(async () => {
    if (!email.trim() || loading) return;
    setLoading("email");
    setError(null);

    try {
      const res = await fetch("/api/auth/signup/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send code");
        return;
      }
      setStep("verify");
      setResendCooldown(60);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }, [email, loading]);

  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];

    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6);
      for (let i = 0; i < 6; i++) {
        newCode[i] = digits[i] || "";
      }
      setCode(newCode);
      const nextEmpty = newCode.findIndex((d) => !d);
      codeInputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
      if (digits.length === 6) verifyAndSignIn(newCode.join(""));
      return;
    }

    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }

    if (newCode.join("").length === 6) {
      verifyAndSignIn(newCode.join(""));
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const verifyAndSignIn = async (fullCode: string) => {
    setLoading("verify");
    setError(null);

    try {
      const res = await fetch("/api/auth/signup/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid code");
        setCode(["", "", "", "", "", ""]);
        setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
        setLoading(null);
        return;
      }

      // Token is verified — sign in with credentials using the verification token
      await signIn("credentials", {
        email,
        verificationToken: data.token,
        callbackUrl: "/dashboard",
      });
    } catch {
      setError("Verification failed. Please try again.");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8">
          {step === "email" && (
            <div>
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail size={24} className="text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Welcome back
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sign in to your AIdvisory account
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {OAUTH_PROVIDERS.map(({ id, name: label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleOAuth(id)}
                    disabled={loading !== null}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors text-gray-900 dark:text-white"
                  >
                    {loading === id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Icon size={16} />
                    )}
                    Continue with {label}
                  </button>
                ))}
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white dark:bg-gray-900 text-gray-400">or sign in with email</span>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendCode()}
                  placeholder="you@company.com"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                <button
                  onClick={sendCode}
                  disabled={!email.trim() || loading !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  {loading === "email" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Send verification code"
                  )}
                </button>
              </div>

              <p className="text-center text-xs text-gray-400 mt-6">
                Don't have an account?{" "}
                <a href="/signup" className="text-blue-600 hover:underline font-medium">
                  Sign up free
                </a>
              </p>
            </div>
          )}

          {step === "verify" && (
            <div>
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Key size={24} className="text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Check your email
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex justify-center gap-2">
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { codeInputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleCodeInput(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                        error
                          ? "border-red-300 dark:border-red-600"
                          : "border-gray-200 dark:border-gray-600"
                      }`}
                    />
                  ))}
                </div>

                {loading === "verify" && (
                  <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                    <Loader2 size={14} className="animate-spin" />
                    Signing in...
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
                )}

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setStep("email"); setError(null); setCode(["", "", "", "", "", ""]); }}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <ArrowLeft size={14} /> Change email
                  </button>
                  <button
                    onClick={() => { setCode(["", "", "", "", "", ""]); setError(null); sendCode(); }}
                    disabled={resendCooldown > 0}
                    className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
