"use client";

import React, { useEffect, useState } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiMail, FiLock, FiLogIn, FiChevronRight } from "react-icons/fi";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // kalau sudah login, langsung masuk /admin/dashboard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setChecking(false);
      if (user) router.replace("/admin/dashboard");
    });
    return () => unsub();
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/admin/dashboard");
    } catch (err: any) {
      const msg =
        err?.code === "auth/invalid-credential"
          ? "Email atau password salah."
          : err?.code === "auth/too-many-requests"
            ? "Terlalu banyak percobaan. Coba lagi nanti."
            : err?.message || "Gagal login.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#070A14] text-white flex items-center justify-center">
        <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          Mengecek sesi login...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A14] text-white">
      {/* glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute top-32 -right-20 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-lime-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-md px-4 py-14">
        <div className="rounded-[2rem] bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
          <div className="text-sm text-white/60">REKAP TARUNA POLTEKPEL</div>
          <h1 className="mt-2 text-2xl font-semibold">Login Admin</h1>
          <p className="mt-2 text-sm text-white/70">
            Silakan login untuk mengakses halaman <b>/admin</b>.
          </p>

          {error && (
            <div className="mt-4 rounded-2xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-5 space-y-3">
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/55" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="Email"
                className="w-full rounded-2xl bg-white/5 px-10 py-3 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none focus:ring-white/20"
              />
            </div>

            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/55" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                placeholder="Password"
                className="w-full rounded-2xl bg-white/5 px-10 py-3 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none focus:ring-white/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400/10 px-5 py-3 text-sm font-semibold ring-1 ring-cyan-300/25 hover:bg-cyan-400/15 disabled:opacity-60"
              style={{ boxShadow: "0 0 22px rgba(0,229,255,0.12)" }}
            >
              <FiLogIn />
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="mt-5 text-xs text-white/55">
            Kembali ke{" "}
            <Link
              href="/"
              className="text-cyan-300 hover:underline inline-flex items-center gap-1"
            >
              halaman utama <FiChevronRight />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
