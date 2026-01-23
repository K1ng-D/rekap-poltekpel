"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FiBarChart2,
  FiDatabase,
  FiShield,
  FiChevronRight,
  FiCalendar,
  FiUsers,
} from "react-icons/fi";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#070A14] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-28 -left-28 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute top-24 -right-24 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-lime-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs ring-1 ring-white/10">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(0,229,255,0.7)]" />
            Sistem Monitoring Akademik
          </div>

          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs ring-1 ring-white/10 hover:bg-white/10"
          >
            Masuk Dashboard <FiChevronRight />
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-center"
        >
          <div>
            <div className="text-sm text-white/60">
              POLTEKPEL • Sistem Rekap
            </div>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
              REKAP TARUNA <span className="text-white/60">POLTEKPEL</span>
            </h1>

            <p className="mt-4 text-base leading-relaxed text-white/70">
              Platform ringkas untuk memantau data taruna per tahun dan per
              program, lengkap dengan rekap status akademik, import data, dan
              notifikasi registrasi ulang.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400/10 px-5 py-3 text-sm font-semibold ring-1 ring-cyan-300/25 hover:bg-cyan-400/15"
                style={{ boxShadow: "0 0 22px rgba(0,229,255,0.12)" }}
              >
                Buka Dashboard <FiChevronRight />
              </Link>

              <Link
                href="/admin/dashboard/2019"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/5 px-5 py-3 text-sm ring-1 ring-white/10 hover:bg-white/10"
              >
                Lihat Contoh Rekap Tahun <FiCalendar />
              </Link>
            </div>

            {/* quick stats */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="text-xs text-white/60">Rekap</div>
                <div className="mt-1 text-lg font-semibold">Per Tahun</div>
              </div>
              <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="text-xs text-white/60">Kategori</div>
                <div className="mt-1 text-lg font-semibold">D3 / DP</div>
              </div>
              <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="text-xs text-white/60">Status</div>
                <div className="mt-1 text-lg font-semibold">Realtime</div>
              </div>
            </div>
          </div>

          {/* right card */}
          <div className="rounded-[2rem] bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-white/70">Ringkasan Fitur</div>
                <div className="mt-1 text-xl font-semibold">
                  Siap untuk Operasional
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                <FiBarChart2 className="text-xl" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
                <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                  <FiDatabase />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Data Terpusat</div>
                  <div className="text-xs text-white/60">
                    Import CSV + SK dokumen
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
                <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                  <FiUsers />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Rekap Taruna</div>
                  <div className="text-xs text-white/60">
                    Per tahun & per kategori (Diploma III / DP III / DP IV)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
                <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                  <FiShield />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Notifikasi</div>
                  <div className="text-xs text-white/60">
                    Peringatan registrasi ulang (Des–Feb)
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-black/30 p-4 text-xs text-white/70 ring-1 ring-white/10">
              Tips: Mulai dari dashboard untuk melihat rekap tahunan, lalu masuk
              ke kategori untuk import data dan unggah dokumen SK.
            </div>

            <div className="mt-5 flex gap-3">
              <Link
                href="/admin/dashboard"
                className="flex-1 rounded-2xl bg-white/5 px-4 py-3 text-center text-sm ring-1 ring-white/10 hover:bg-white/10"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/dashboard"
                className="flex-1 rounded-2xl bg-fuchsia-500/10 px-4 py-3 text-center text-sm ring-1 ring-fuchsia-300/25 hover:bg-fuchsia-500/15"
                style={{ boxShadow: "0 0 20px rgba(255,45,149,0.10)" }}
              >
                Mulai Sekarang
              </Link>
            </div>
          </div>
        </motion.div>

        {/* footer */}
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
          <div>© {new Date().getFullYear()} REKAP TARUNA POLTEKPEL</div>
        </div>
      </div>
    </div>
  );
}
