"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  FiBell,
  FiSearch,
  FiChevronRight,
  FiUsers,
  FiCheckCircle,
  FiPauseCircle,
  FiXCircle,
  FiAlertTriangle,
  FiTrendingUp,
  FiLogOut,
  FiCalendar,
  FiLayers,
} from "react-icons/fi";

import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

type PieSlice = {
  label: string;
  value: number;
  color: string;
};

type StatusItem = {
  label: string;
  value: number;
  color: string;
  icon: React.ComponentType<any>;
};

type StatusKey = "lulus" | "skorsing" | "cuti" | "dropout" | "mengundurkan";

type Row = {
  id: string;
  year: number;
  kategori: string; // diploma-iii / dp-iii / dp-iv
  keterangan: string;
};

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.06 * i, duration: 0.5, ease: easeOut },
  }),
};

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
  ) {
    return "dropout";
  }

  if (
    s.includes("mengundurkan diri") ||
    s.includes("pengunduran diri") ||
    s.includes("undur diri")
  ) {
    return "mengundurkan";
  }

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

/** ==== Chart helpers (Pie) ==== */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180.0;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function PieChart({
  slices,
  size = 220,
  inner = 70,
}: {
  slices: PieSlice[];
  size?: number;
  inner?: number;
}) {
  const total = slices.reduce((a, b) => a + b.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const arcs = useMemo(() => {
    let a0 = 0;
    return slices.map((s) => {
      const portion = (s.value / total) * 360;
      const a1 = a0 + portion;
      const path = arcPath(cx, cy, r, a0, a1);
      a0 = a1;
      return { ...s, path };
    });
  }, [slices, total, cx, cy, r]);

  return (
    <div className="relative w-full">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto drop-shadow-[0_0_18px_rgba(255,255,255,0.06)]"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {arcs.map((a) => (
          <g key={a.label}>
            <path
              d={a.path}
              fill={a.color}
              filter="url(#glow)"
              opacity={0.95}
              stroke="rgba(0,0,0,0.5)"
              strokeWidth={1}
            />
          </g>
        ))}

        <circle
          cx={cx}
          cy={cy}
          r={inner}
          fill="rgba(7, 10, 20, 0.92)"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={2}
        />

        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize="14"
          fill="rgba(255,255,255,0.78)"
          fontFamily="ui-sans-serif, system-ui"
        >
          Total
        </text>
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          fontSize="20"
          fill="white"
          fontWeight="700"
          fontFamily="ui-sans-serif, system-ui"
        >
          {total.toFixed(0)}
        </text>
      </svg>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {slices.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor: s.color,
                boxShadow: `0 0 12px ${s.color}`,
              }}
            />
            <span className="text-white/80">{s.label}</span>
            <span className="ml-auto text-white font-semibold">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ items }: { items: StatusItem[] }) {
  const maxVal = Math.max(1, ...items.map((x) => x.value));
  const total = items.reduce((a, b) => a + b.value, 0) || 1;

  return (
    <div className="space-y-2">
      {items.map((it, idx) => {
        const pctWidth = (it.value / maxVal) * 100;
        const pctTotal = Math.round((it.value / total) * 100);
        const Icon = it.icon;

        return (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * idx, duration: 0.35, ease: easeOut }}
            className="rounded-2xl bg-black/25 p-3 ring-1 ring-white/10"
          >
            <div className="flex items-center gap-3">
              <span
                className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10"
                style={{ boxShadow: `0 0 14px ${it.color}20` }}
              >
                <Icon />
              </span>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{it.label}</div>
                  <div className="text-sm font-bold">
                    {it.value}{" "}
                    <span className="text-xs text-white/55">({pctTotal}%)</span>
                  </div>
                </div>

                <div className="mt-2 h-2.5 w-full rounded-full bg-white/5 ring-1 ring-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pctWidth}%` }}
                    transition={{ duration: 0.45, ease: easeOut }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: it.color,
                      boxShadow: `0 0 18px ${it.color}`,
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [query, setQuery] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Ambil semua data students (gabungan semua tahun & kategori)
  useEffect(() => {
    setLoading(true);
    setErr(null);

    const unsub = onSnapshot(
      collection(db, "students"),
      (snap) => {
        const data: Row[] = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            year: Number(x.year ?? 0),
            kategori: String(x.kategori ?? ""),
            keterangan: String(x.keterangan ?? ""),
          };
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
  }, []);

  // optional search: year/kategori/keterangan (simple)
  const searched = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      return (
        String(r.year).includes(s) ||
        r.kategori.toLowerCase().includes(s) ||
        r.keterangan.toLowerCase().includes(s)
      );
    });
  }, [rows, query]);

  // ringkasan overall
  const overallCounts = useMemo(() => {
    const c = emptyCounts();
    for (const r of searched) {
      const y = Number(r.year);
      if (!Number.isFinite(y) || y <= 0) continue;
      c[normalizeStatus(r.keterangan)] += 1;
    }
    return c;
  }, [searched]);

  const totalAll = useMemo(
    () => Object.values(overallCounts).reduce((a, b) => a + b, 0),
    [overallCounts],
  );

  // ringkasan per tahun
  const perYear = useMemo(() => {
    const map = new Map<
      number,
      { total: number; counts: Record<StatusKey, number> }
    >();

    for (const r of rows) {
      const y = Number(r.year);
      if (!Number.isFinite(y) || y <= 0) continue;

      if (!map.has(y)) map.set(y, { total: 0, counts: emptyCounts() });

      const obj = map.get(y)!;
      obj.total += 1;
      obj.counts[normalizeStatus(r.keterangan)] += 1;
    }

    // urutkan tahun descending
    return Array.from(map.entries())
      .map(([year, v]) => ({ year, ...v }))
      .sort((a, b) => b.year - a.year);
  }, [rows]);

  // pie + bar items (overall)
  const statusItems: StatusItem[] = useMemo(
    () => [
      {
        label: "Lulus",
        value: overallCounts.lulus,
        color: "#00E5FF",
        icon: FiCheckCircle,
      },
      {
        label: "Skorsing",
        value: overallCounts.skorsing,
        color: "#FF2D95",
        icon: FiAlertTriangle,
      },
      {
        label: "Cuti Akademik",
        value: overallCounts.cuti,
        color: "#B6FF00",
        icon: FiPauseCircle,
      },
      {
        label: "Dropout",
        value: overallCounts.dropout,
        color: "#FFB000",
        icon: FiXCircle,
      },
      {
        label: "Mengundurkan Diri",
        value: overallCounts.mengundurkan,
        color: "#8B5CFF",
        icon: FiLogOut,
      },
    ],
    [overallCounts],
  );

  const slices: PieSlice[] = useMemo(
    () =>
      statusItems.map((x) => ({
        label: x.label,
        value: x.value,
        color: x.color,
      })),
    [statusItems],
  );

  // cards ringkasan atas
  const stats = useMemo(() => {
    const risiko = overallCounts.dropout + overallCounts.skorsing;
    return [
      {
        title: "Total Data",
        value: totalAll.toLocaleString("id-ID"),
        icon: FiUsers,
        hint: "gabungan semua tahun",
      },
      {
        title: "Lulus",
        value: overallCounts.lulus.toLocaleString("id-ID"),
        icon: FiTrendingUp,
        hint: "total kelulusan",
      },
      {
        title: "Cuti Akademik",
        value: overallCounts.cuti.toLocaleString("id-ID"),
        icon: FiPauseCircle,
        hint: "status non-aktif",
      },
      {
        title: "Risiko (DO+Skors)",
        value: risiko.toLocaleString("id-ID"),
        icon: FiAlertTriangle,
        hint: "perlu evaluasi",
      },
    ];
  }, [overallCounts, totalAll]);

  return (
    <div className="min-h-screen bg-[#070A14] text-white">
      {/* background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute top-32 -right-20 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-lime-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <div className="text-sm text-white/60">Admin • Dashboard</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              Dashboard Utama{" "}
              <span className="text-white/50">— rekap semua tahun</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-80">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/55" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search… (tahun/kategori/status)"
                className="w-full rounded-2xl bg-white/5 px-10 py-2.5 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none transition focus:ring-white/20"
              />
            </div>
            <button
              className="rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10 hover:bg-white/10"
              aria-label="Notification"
            >
              <FiBell />
            </button>
          </div>
        </motion.div>

        {/* Loading/Error */}
        {loading ? (
          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            Memuat data dari Firestore...
          </div>
        ) : err ? (
          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-red-400/30 text-red-200">
            Error Firestore: {err}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              {stats.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.title}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    custom={i}
                    className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-white/70">{s.title}</div>
                      <div className="rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
                        <Icon />
                      </div>
                    </div>
                    <div className="mt-3 text-2xl font-bold">{s.value}</div>
                    <div className="mt-1 text-xs text-white/55">{s.hint}</div>
                  </motion.div>
                );
              })}
            </div>

            {/* Main charts */}
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {/* Pie */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={5}
                className="lg:col-span-1 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white/70">Snapshot</div>
                    <div className="text-lg font-semibold">
                      Kondisi Aktual (Semua Tahun)
                    </div>
                  </div>
                  <div className="text-xs text-white/55">
                    Total: <span className="text-white/80">{totalAll}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <PieChart slices={slices} />
                </div>
              </motion.div>

              {/* Bar */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={6}
                className="lg:col-span-2 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white/70">Chart Bar</div>
                    <div className="text-lg font-semibold">
                      Distribusi Status (Semua Tahun)
                    </div>
                  </div>
                  <div className="text-xs text-white/55">
                    Search mempengaruhi chart (kalau search diisi)
                  </div>
                </div>

                <div className="mt-4">
                  <BarChart items={statusItems} />
                </div>
              </motion.div>
            </div>

            {/* Per year summary */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={7}
              className="mt-6 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white/70">Rekap Per Tahun</div>
                  <div className="text-lg font-semibold">
                    Klik tahun untuk detail
                  </div>
                </div>
                <div className="text-xs text-white/55 flex items-center gap-2">
                  <FiCalendar />
                  <span>{perYear.length} tahun terdeteksi</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {perYear.map((y) => (
                  <Link
                    key={y.year}
                    href={`/admin/dashboard/${y.year}`}
                    className="rounded-3xl bg-black/25 p-4 ring-1 ring-white/10 hover:bg-white/5 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold">
                        Tahun {y.year}
                      </div>
                      <div className="text-sm text-white/70">
                        Total:{" "}
                        <span className="text-white font-bold">{y.total}</span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                        Lulus:{" "}
                        <span className="text-white font-semibold">
                          {y.counts.lulus}
                        </span>
                      </div>
                      <div className="rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                        Skors:{" "}
                        <span className="text-white font-semibold">
                          {y.counts.skorsing}
                        </span>
                      </div>
                      <div className="rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                        Cuti:{" "}
                        <span className="text-white font-semibold">
                          {y.counts.cuti}
                        </span>
                      </div>
                      <div className="rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                        DO:{" "}
                        <span className="text-white font-semibold">
                          {y.counts.dropout}
                        </span>
                      </div>
                      <div className="col-span-2 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                        Mengundurkan:{" "}
                        <span className="text-white font-semibold">
                          {y.counts.mengundurkan}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-cyan-300 flex items-center gap-2">
                      Buka detail <FiChevronRight />
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}

        <div className="mt-6 text-xs text-white/45">
          © {new Date().getFullYear()} Admin Dashboard — Rekap semua tahun
        </div>
      </div>
    </div>
  );
}
