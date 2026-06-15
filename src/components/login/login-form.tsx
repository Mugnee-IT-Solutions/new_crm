"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import gsap from "gsap";
import { ShieldCheck, Sparkles, Target, Timer, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminPasswordLoginAction, sendOtpAction, verifyOtpAction } from "@/lib/crm-actions";

const loginSchema = z.object({
  login: z.string().min(3, "Enter your email or mobile number"),
  password: z.string().optional(),
});

function normalizeLogin(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  const digits = trimmed.replace(/\D/g, "");
  return digits.startsWith("88") ? digits.slice(2) : digits;
}

export function LoginForm() {
  const router = useRouter();
  const brandRef = React.useRef<HTMLDivElement>(null);
  const [otpSent, setOtpSent] = React.useState(false);
  const [otp, setOtp] = React.useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = React.useState(90);
  const [message, setMessage] = React.useState("Enter your mobile number to receive OTP.");
  const [submitting, setSubmitting] = React.useState(false);
  const inputsRef = React.useRef<Array<HTMLInputElement | null>>([]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: "admin@crm.com",
      password: "",
    },
  });
  const loginValue = form.watch("login");
  const isAdminLogin = normalizeLogin(loginValue) === "admin@crm.com";

  React.useEffect(() => {
    if (!brandRef.current) return;
    gsap.fromTo(
      brandRef.current.querySelectorAll("[data-float]"),
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: "power3.out" },
    );
  }, []);

  React.useEffect(() => {
    if (!otpSent || timer <= 0) return;
    const interval = window.setInterval(() => setTimer((value) => value - 1), 1000);
    return () => window.clearInterval(interval);
  }, [otpSent, timer]);

  React.useEffect(() => {
    setOtpSent(false);
    setOtp(["", "", "", "", "", ""]);
    setMessage(isAdminLogin ? "Admin login uses email and password." : "Enter your email to receive OTP.");
  }, [isAdminLogin, loginValue]);

  function handleSendOtp() {
    void form.handleSubmit(async ({ login }) => {
      const formData = new FormData();
      formData.set("login", normalizeLogin(login));
      const result = await sendOtpAction(formData);

      setOtpSent(Boolean(result.ok));
      setTimer(90);
      setOtp(["", "", "", "", "", ""]);
      setMessage(result.message);
      if (result.ok) window.setTimeout(() => inputsRef.current[0]?.focus(), 50);
    })();
  }

  function handleAdminLogin() {
    void form.handleSubmit(async ({ login, password }) => {
      setSubmitting(true);
      const formData = new FormData();
      formData.set("login", normalizeLogin(login));
      formData.set("password", password ?? "");
      const result = await adminPasswordLoginAction(formData);

      if (!result.ok || !result.redirectTo) {
        setSubmitting(false);
        setMessage(result.message ?? "Admin login failed.");
        return;
      }

      router.push(result.redirectTo);
    })();
  }

  function updateOtp(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    if (digit && index < 5) inputsRef.current[index + 1]?.focus();
  }

  async function verifyOtp() {
    const login = normalizeLogin(form.getValues("login"));
    const entered = otp.join("");

    if (!otpSent) {
      setMessage("Send OTP first.");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("login", login);
    formData.set("otp", entered);
    const result = await verifyOtpAction(formData);

    if (!result.ok || !result.redirectTo) {
      setSubmitting(false);
      setMessage(result.message ?? "OTP verification failed.");
      return;
    }

    router.push(result.redirectTo);
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[0.95fr_1.25fr]">
      <section
        ref={brandRef}
        className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(59,130,246,0.48),transparent_28rem),linear-gradient(150deg,#08163a,#0b1d4d_54%,#10113a)] p-10 text-white lg:flex lg:flex-col lg:justify-between"
      >
        <div className="absolute inset-0 soft-grid opacity-30" />
        <div className="relative z-10" data-float>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-blue-50">
            <ShieldCheck className="h-4 w-4" />
            OTP secured CRM
          </div>
          <h1 className="mt-20 text-4xl font-black tracking-normal">Mugnee CRM</h1>
          <p className="mt-3 max-w-sm text-lg font-semibold text-blue-100">Smart CRM for smarter business.</p>
        </div>

        <div className="relative z-10" data-float>
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/15 p-4">
                <Target className="h-6 w-6 text-cyan-200" />
                <p className="mt-4 text-2xl font-black">520</p>
                <p className="text-xs text-blue-100">Customers</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4">
                <TrendingUp className="h-6 w-6 text-emerald-200" />
                <p className="mt-4 text-2xl font-black">28%</p>
                <p className="text-xs text-blue-100">Conversion</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4">
                <Sparkles className="h-6 w-6 text-amber-200" />
                <p className="mt-4 text-2xl font-black">15k</p>
                <p className="text-xs text-blue-100">Rewards</p>
              </div>
            </div>
            <div className="mt-5 h-36 rounded-2xl bg-gradient-to-br from-blue-500/70 to-indigo-500/50 p-4">
              <div className="flex h-full items-end gap-3">
                {[42, 72, 52, 90, 64].map((height) => (
                  <div key={height} className="flex flex-1 items-end rounded-xl bg-white/14 p-1">
                    <div className="w-full rounded-lg bg-white shadow-lg" style={{ height: `${height}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 grid max-w-md gap-3">
            {["Track Leads & Customers", "Follow Ups & Tasks", "Achieve Sales Goals"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm font-semibold text-blue-50">
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-xl p-6 md:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <span className="text-base font-black">M</span>
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">Mugnee CRM</h2>
            <p className="mt-2 text-sm font-semibold text-blue-700">Welcome Back</p>
            <p className="mt-1 text-sm text-slate-500">Admin uses password. Team users receive OTP by email.</p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={(event) => event.preventDefault()}>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="login">
                Email or Mobile Number
              </label>
              <div className="mt-2 flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm focus-within:ring-4 focus-within:ring-blue-100">
                <input
                  id="login"
                  className="h-11 flex-1 px-3 text-sm outline-none"
                  placeholder="admin@crm.com"
                  {...form.register("login")}
                />
                {!isAdminLogin ? (
                  <Button type="button" className="m-1 h-9" onClick={handleSendOtp}>
                    Send OTP
                  </Button>
                ) : null}
              </div>
              {form.formState.errors.login ? (
                <p className="mt-1 text-xs font-semibold text-red-600">{form.formState.errors.login.message}</p>
              ) : null}
            </div>

            {isAdminLogin ? (
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="password">
                  Admin Password
                </label>
                <Input
                  id="password"
                  type="password"
                  className="mt-2 h-11"
                  placeholder="Crm@admin1234"
                  {...form.register("password")}
                />
              </div>
            ) : null}

            {!isAdminLogin ? <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Enter OTP</label>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <Timer className="h-3.5 w-3.5" />
                  {otpSent ? `${timer}s` : "Send first"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-6 gap-2">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(node) => {
                      inputsRef.current[index] = node;
                    }}
                    className="h-12 text-center text-lg font-black"
                    value={digit}
                    inputMode="numeric"
                    maxLength={1}
                    onChange={(event) => updateOtp(index, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Backspace" && !otp[index] && index > 0) {
                        inputsRef.current[index - 1]?.focus();
                      }
                    }}
                  />
                ))}
              </div>
            </div> : null}

            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center text-sm font-semibold text-blue-700">
              {message}
            </div>

            <Button type="button" className="w-full" size="lg" disabled={submitting} onClick={isAdminLogin ? handleAdminLogin : verifyOtp}>
              {submitting ? "Opening Dashboard..." : isAdminLogin ? "Login as Admin" : "Login to Dashboard"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs font-semibold text-slate-400">Secure | Fast | Reliable</p>
        </Card>
      </section>
    </main>
  );
}
