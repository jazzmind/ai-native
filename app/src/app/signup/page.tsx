"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { signIn } from "next-auth/react";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Mail,
  Check,
  Key,
  Sparkles,
  Crown,
  Users,
  Lock,
  Globe,
  Building2,
  HelpCircle,
} from "lucide-react";

type Step = "email" | "verify" | "profile" | "plan";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [firstName, setFirstName] = useState("");
  const [businessMode, setBusinessMode] = useState<"website" | "description" | "unsure" | null>(null);
  const [website, setWebsite] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [verificationToken, setVerificationToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [validatingKey, setValidatingKey] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);

  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const sendCode = useCallback(async () => {
    if (!email.trim() || loading) return;
    setLoading(true);
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
      setCodeSent(true);
      setStep("verify");
      setResendCooldown(60);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [email, loading]);

  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];

    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6);
      for (let i = 0; i < 6; i++) {
        newCode[i] = digits[i] || "";
      }
      setCode(newCode);
      const nextEmpty = newCode.findIndex((d) => !d);
      codeInputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();

      if (digits.length === 6) {
        verifyCodeAction(newCode.join(""));
      }
      return;
    }

    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }

    const full = newCode.join("");
    if (full.length === 6) {
      verifyCodeAction(full);
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCodeAction = async (fullCode: string) => {
    setLoading(true);
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
        return;
      }
      setVerificationToken(data.token);
      setStep("profile");
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileNext = () => {
    if (!firstName.trim()) {
      setError("Please enter your first name");
      return;
    }
    setError(null);
    setStep("plan");
  };

  const validateApiKey = async (key: string) => {
    if (!key.startsWith("sk-ant-")) {
      setKeyValid(false);
      return;
    }
    setValidatingKey(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      setKeyValid(res.ok || res.status === 429);
    } catch {
      setKeyValid(false);
    } finally {
      setValidatingKey(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/signup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: verificationToken,
          firstName,
          website: businessMode === "website" ? website : undefined,
          businessDescription: businessMode === "description" ? businessDescription : undefined,
          businessStage: businessMode === "unsure" ? "exploring" : undefined,
          apiKey: apiKey || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create account");
        return;
      }

      // Sign in with the verified credentials + verification token
      await signIn("credentials", {
        email: data.email,
        name: firstName,
        verificationToken: data.verificationToken,
        callbackUrl: "/dashboard",
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const stepNumber = { email: 1, verify: 2, profile: 3, plan: 4 }[step];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  n < stepNumber
                    ? "bg-green-500 text-white"
                    : n === stepNumber
                    ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                }`}
              >
                {n < stepNumber ? <Check size={14} /> : n}
              </div>
              {n < 4 && (
                <div
                  className={`w-8 h-0.5 ${
                    n < stepNumber ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8">
          {/* Step 1: Email */}
          {step === "email" && (
            <div>
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail size={24} className="text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Get started with AIdvisory
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Your AI advisory board awaits. Enter your email to begin.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendCode()}
                    placeholder="you@company.com"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                <button
                  onClick={sendCode}
                  disabled={!email.trim() || loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Continue <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-gray-400">
                  Already have an account?{" "}
                  <a href="/login" className="text-blue-600 hover:underline">
                    Sign in
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Verify Code */}
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

                {loading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                    <Loader2 size={14} className="animate-spin" />
                    Verifying...
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

          {/* Step 3: Profile */}
          {step === "profile" && (
            <div>
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Check size={24} className="text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Email verified!
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tell us a bit about yourself so your advisors can be more helpful.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    First name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tell us about your business
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setBusinessMode("website")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left text-sm transition-all ${
                        businessMode === "website"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      <Globe size={18} className={businessMode === "website" ? "text-blue-600" : "text-gray-400"} />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">I have a website</div>
                        <div className="text-xs text-gray-500">We'll learn about your business from it</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setBusinessMode("description")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left text-sm transition-all ${
                        businessMode === "description"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      <Building2 size={18} className={businessMode === "description" ? "text-blue-600" : "text-gray-400"} />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">I'll describe it</div>
                        <div className="text-xs text-gray-500">A few sentences about what you're building</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setBusinessMode("unsure")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left text-sm transition-all ${
                        businessMode === "unsure"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      <HelpCircle size={18} className={businessMode === "unsure" ? "text-blue-600" : "text-gray-400"} />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">I'm still exploring</div>
                        <div className="text-xs text-gray-500">No problem — you can add details later</div>
                      </div>
                    </button>
                  </div>
                </div>

                {businessMode === "website" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourcompany.com"
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}

                {businessMode === "description" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      What are you building?
                    </label>
                    <textarea
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      placeholder="We're building a marketplace for..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                <button
                  onClick={handleProfileNext}
                  disabled={!firstName.trim() || !businessMode}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Plan / API Key */}
          {step === "plan" && (
            <div>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles size={24} className="text-purple-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Choose your plan
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Start free with your own API key, or upgrade later for managed access.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {/* Free / BYO tier — active */}
                <div className="border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Key size={16} className="text-blue-600" />
                      <span className="font-bold text-gray-900 dark:text-white">Free</span>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                      Available now
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Bring your own Anthropic API key. 100 messages/month, 3 projects.
                  </p>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Anthropic API Key
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          setKeyValid(null);
                        }}
                        placeholder="sk-ant-api03-..."
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs"
                      />
                      <button
                        onClick={() => validateApiKey(apiKey)}
                        disabled={!apiKey.trim() || validatingKey}
                        className="px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                      >
                        {validatingKey ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </button>
                    </div>
                    {keyValid === true && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <Check size={12} /> Key is valid
                      </p>
                    )}
                    {keyValid === false && (
                      <p className="text-xs text-red-600 mt-1">
                        Invalid key. Get one from{" "}
                        <a
                          href="https://console.anthropic.com/settings/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          console.anthropic.com
                        </a>
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">
                      Optional — you can add this later in settings.
                    </p>
                  </div>
                </div>

                {/* Pro — greyed out */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 opacity-50 cursor-not-allowed relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <Lock size={14} className="text-gray-400" />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <Crown size={16} className="text-amber-500" />
                    <span className="font-bold text-gray-900 dark:text-white">Pro</span>
                    <span className="text-sm text-gray-500 ml-auto">$49/mo</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Unlimited messages, managed API key, expert reviews. Coming soon.
                  </p>
                </div>

                {/* Team — greyed out */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 opacity-50 cursor-not-allowed relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <Lock size={14} className="text-gray-400" />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <Users size={16} className="text-purple-500" />
                    <span className="font-bold text-gray-900 dark:text-white">Team</span>
                    <span className="text-sm text-gray-500 ml-auto">$149/mo</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    5 seats, 50 projects, team collaboration, priority support. Coming soon.
                  </p>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("profile"); setError(null); }}
                  className="flex items-center gap-1 px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Create my account <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
