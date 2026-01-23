"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  FiChevronLeft,
  FiChevronRight,
  FiCalendar,
  FiLayers,
  FiUsers,
  FiCheckCircle,
  FiPauseCircle,
  FiXCircle,
  FiAlertTriangle,
  FiLogOut,
} from "react-icons/fi";

import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.06 * i, duration: 0.5, ease: easeOut },
  }),
};

type StatusKey = "lulus" | "skorsing" | "cuti" | "dropout" | "mengundurkan";

type Row = {
  id: string;
  year: number;
  kategori: string;
  keterangan: string;
};

const KATEGORI = [
  { slug: "diploma-iii", label: "Diploma III" },
  { slug: "dp-iii", label: "DP III" },
  { slug: "dp-iv", label: "DP IV" },
] as const;

function normalizeStatus(keterangan: string): StatusKey {
  const s = (keterangan || "").toLowerCase().trim().replace(/\s+/g, " ");

  if (!s) return "mengundurkan";

  if (s.includes("lulus")) return "lulus";
  if (s.includes("skors")) return "skorsing";
  if (s.includes("cuti")) return "cuti";
  if (
    s.includes("dropout") ||
    s.includes("lewat masa studi") ||
    /\bdo\b/.test(s)
  )
    return "dropout";
  if (
    s.includes("mengundurkan diri") ||
    s.includes("pengunduran diri") ||
    s.includes("undur diri")
  )
    return "mengundurkan";

  return "mengundurkan";
}

function emptyCounts() {
  return {
    lulus: 0,
    skorsing: 0,
    cuti: 0,
    dropout: 0,
    mengundurkan: 0,
  } as Record<StatusKey, number>;
}

function StatusBadge({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: any;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
      <span className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
        <Icon />
      </span>
      <div className="flex-1">
        <div className="text-sm text-white/70">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

export default function DashboardYearSummaryPage() {
  const params = useParams<{ year: string }>();
  const year = Number(params.year);

  const allowedYear = Number.isFinite(year) && year >= 2000 && year <= 2100;
  if (!allowedYear) return notFound();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // realtime fetch: semua students untuk year tertentu
  useEffect(() => {
    setLoading(true);
    setErr(null);

    const qRef = query(collection(db, "students"), where("year", "==", year));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const data = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            year: x.year,
            kategori: x.kategori ?? "",
            keterangan: x.keterangan ?? "",
          } as Row;
        });

        setRows(data);
        setLoading(false);
      },
      (e) => {
        setErr(e?.message ?? String(e));
        setLoading(false);
      },
    );

    return () => unsub();
  }, [year]);

  // ambil hanya 3 kategori yang kita butuhkan
  const filtered = useMemo(() => {
    const allowed = new Set(KATEGORI.map((k) => k.slug));
    return rows.filter((r) => {
      const slug = String(
        r.kategori || "",
      ).toLowerCase() as (typeof KATEGORI)[number]["slug"];
      return allowed.has(slug);
    });
  }, [rows]);

  // totals overall
  const overallCounts = useMemo(() => {
    const c = emptyCounts();
    for (const r of filtered) c[normalizeStatus(r.keterangan)] += 1;
    return c;
  }, [filtered]);

  const overallTotal = useMemo(
    () => Object.values(overallCounts).reduce((a, b) => a + b, 0),
    [overallCounts],
  );

  // per kategori counts
  const perKategori = useMemo(() => {
    const map: Record<string, Record<StatusKey, number>> = {};
    for (const k of KATEGORI) map[k.slug] = emptyCounts();

    for (const r of filtered) {
      const slug = String(r.kategori || "").toLowerCase();
      if (!map[slug]) continue;
      map[slug][normalizeStatus(r.keterangan)] += 1;
    }
    return map;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-[#070A14] text-white">
      {/* glow bg */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute top-32 -right-20 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-lime-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <div className="text-sm text-white/60">Admin • Dashboard</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              Rekap Tahun {year}{" "}
              <span className="text-white/50">
                — Diploma III + DP III + DP IV
              </span>
            </h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
                <FiCalendar /> {year}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
                <FiLayers /> 3 kategori
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
                <FiUsers /> Total: {overallTotal}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/10"
            >
              <FiChevronLeft /> Dashboard Utama
            </Link>

            {/* quick links kategori */}
            {KATEGORI.map((k) => (
              <Link
                key={k.slug}
                href={`/admin/dashboard/${year}/${k.slug}`}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/10"
              >
                {k.label} <FiChevronRight />
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Loading/Error */}
        {loading ? (
          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            Memuat rekap dari Firestore...
          </div>
        ) : err ? (
          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-red-400/30 text-red-200">
            Error Firestore: {err}
          </div>
        ) : (
          <>
            {/* Overall Status Summary */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={0}
              className="mt-6 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
            >
              <div className="text-sm text-white/70">
                Ringkasan Status (Gabungan)
              </div>
              <div className="text-lg font-semibold">
                Kondisi Aktual Tahun {year}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <StatusBadge
                  label="Lulus"
                  value={overallCounts.lulus}
                  icon={FiCheckCircle}
                />
                <StatusBadge
                  label="Skorsing"
                  value={overallCounts.skorsing}
                  icon={FiAlertTriangle}
                />
                <StatusBadge
                  label="Cuti Akademik"
                  value={overallCounts.cuti}
                  icon={FiPauseCircle}
                />
                <StatusBadge
                  label="Dropout"
                  value={overallCounts.dropout}
                  icon={FiXCircle}
                />
                <StatusBadge
                  label="Mengundurkan Diri"
                  value={overallCounts.mengundurkan}
                  icon={FiLogOut}
                />
              </div>
            </motion.div>

            {/* Per kategori Summary */}
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {KATEGORI.map((k, i) => {
                const c = perKategori[k.slug] || emptyCounts();
                const totalK = Object.values(c).reduce((a, b) => a + b, 0);

                return (
                  <motion.div
                    key={k.slug}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    custom={i + 1}
                    className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white/70">Kategori</div>
                        <div className="text-lg font-semibold">{k.label}</div>
                      </div>
                      <div className="text-xs text-white/60">
                        Total:{" "}
                        <span className="text-white/90 font-semibold">
                          {totalK}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between rounded-2xl bg-black/25 px-3 py-2 ring-1 ring-white/10">
                        <span className="text-white/70">Lulus</span>
                        <span className="font-semibold">{c.lulus}</span>
                      </div>
                      <div className="flex justify-between rounded-2xl bg-black/25 px-3 py-2 ring-1 ring-white/10">
                        <span className="text-white/70">Skorsing</span>
                        <span className="font-semibold">{c.skorsing}</span>
                      </div>
                      <div className="flex justify-between rounded-2xl bg-black/25 px-3 py-2 ring-1 ring-white/10">
                        <span className="text-white/70">Cuti Akademik</span>
                        <span className="font-semibold">{c.cuti}</span>
                      </div>
                      <div className="flex justify-between rounded-2xl bg-black/25 px-3 py-2 ring-1 ring-white/10">
                        <span className="text-white/70">Dropout</span>
                        <span className="font-semibold">{c.dropout}</span>
                      </div>
                      <div className="flex justify-between rounded-2xl bg-black/25 px-3 py-2 ring-1 ring-white/10">
                        <span className="text-white/70">Mengundurkan Diri</span>
                        <span className="font-semibold">{c.mengundurkan}</span>
                      </div>
                    </div>

                    <Link
                      href={`/admin/dashboard/${year}/${k.slug}`}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/10"
                    >
                      Buka detail {k.label} <FiChevronRight />
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* Empty info if no data */}
            {overallTotal === 0 && (
              <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                <div className="text-lg font-semibold">
                  Belum ada data untuk tahun {year}
                </div>
                <div className="mt-1 text-sm text-white/70">
                  Silakan import CSV pada masing-masing kategori:
                  <span className="ml-2 text-white/90 font-semibold">
                    Diploma III / DP III / DP IV
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-6 text-xs text-white/45">
          © {new Date().getFullYear()} Admin Dashboard — Rekap Tahun {year}
        </div>
      </div>
    </div>
  );
}
