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
  FiTable,
  FiFilter,
  FiRotateCcw,
} from "react-icons/fi";

import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

/** =========================
 *  TYPES
 *  ========================= */
type StatusKey =
  | "aktif"
  | "lulus"
  | "skorsing"
  | "cuti"
  | "dropout"
  | "mengundurkan";

type Row = {
  id: string;
  year: number;
  kategori: string; // diploma-iii / dp-iii / dp-iv
  program: string; // contoh: "nautika (reguler)" , "teknika (mandiri)" , "nautika"
  keterangan: string; // status text
};

type ProgramTingkat = "Diploma III" | "DP III" | "DP IV";
type Jalur = "Reguler" | "Mandiri" | "Polbit";

type Prodi = "Nautika" | "Teknika" | "Permesinan Kapal" | "MTL" | "Lainnya";

type StatusItem = {
  label: string;
  value: number;
  color: string;
  icon: React.ComponentType<any>;
};

type PieSlice = {
  label: string;
  value: number;
  color: string;
};

type RekapRow = {
  year: number; // angkatan
  programTingkat: ProgramTingkat; // Diploma III / DP III / DP IV (dari kategori)
  jalur: Jalur; // Reguler / Mandiri (dari program -> default Reguler)
  prodi: Prodi; // Nautika/Teknika/Permesinan Kapal/MTL (dari program)
  total: number; // jumlah awal
  aktif: number;
  lulus: number;
  cuti: number;
  skorsing: number;
  dropout: number;
  mengundurkan: number;
  belumLulus: number; // total - lulus
};

/** =========================
 *  ANIMATION
 *  ========================= */
const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.06 * i, duration: 0.5, ease: easeOut },
  }),
};

/** =========================
 *  HELPERS
 *  ========================= */
function normalizeStatus(keterangan: string): StatusKey {
  const s = (keterangan || "").toLowerCase().trim().replace(/\s+/g, " ");

  // kalau kosong -> kamu sebelumnya default mengundurkan
  if (!s) return "mengundurkan";

  // ✅ status baru
  if (s.includes("aktif")) return "aktif";

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

  // default
  return "mengundurkan";
}

function emptyCounts(): Record<StatusKey, number> {
  return {
    aktif: 0,
    lulus: 0,
    skorsing: 0,
    cuti: 0,
    dropout: 0,
    mengundurkan: 0,
  };
}

function kategoriToProgramTingkat(kategoriSlug: string): ProgramTingkat {
  const k = (kategoriSlug || "").toLowerCase();
  if (k === "diploma-iii") return "Diploma III";
  if (k === "dp-iii") return "DP III";
  return "DP IV";
}

/**
 * ✅ RULE JALUR (sesuai koreksi kamu)
 * - ada "(mandiri)" => Mandiri
 * - ada "(reguler)" => Reguler
 * - tidak ada keduanya => default Reguler (bukan lainnya)
 */
function parseJalur(programText: string): Jalur {
  const s = (programText || "").toLowerCase();

  // ✅ prioritas: polbit dulu
  if (s.includes("polbit")) return "Polbit";

  // mandiri
  if (s.includes("mandiri")) return "Mandiri";

  // reguler
  if (s.includes("reguler")) return "Reguler";

  // ✅ default jika tidak ada kata apa pun
  return "Reguler";
}

/**
 * Prodi diambil dari field "program" yang tersimpan di Firestore.
 * Contoh:
 *  - "nautika (reguler)" => Nautika
 *  - "permesinan kapal (mandiri)" => Permesinan Kapal
 *  - "mtl" => MTL
 */
function parseProdi(programText: string): Prodi {
  const s = (programText || "").toLowerCase().trim();

  // rapikan (hapus tanda kurung)
  const clean = s
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.includes("permesinan kapal")) return "Permesinan Kapal";
  if (clean.includes("nautika")) return "Nautika";
  if (clean.includes("teknika")) return "Teknika";
  if (/\bmtl\b/.test(clean) || clean.includes("manajemen transportasi laut"))
    return "MTL";

  return "Lainnya";
}

/** =========================
 *  PIE CHART HELPERS
 *  ========================= */
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

/** =========================
 *  PAGE
 *  ========================= */
export default function DashboardPage() {
  const [query, setQuery] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  /** Realtime read */
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
            program: String(x.program ?? ""), // ✅ dipakai untuk prodi + jalur
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

  /** Search sederhana (tahun/kategori/status/program) */
  const searched = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      return (
        String(r.year).includes(s) ||
        r.kategori.toLowerCase().includes(s) ||
        r.keterangan.toLowerCase().includes(s) ||
        r.program.toLowerCase().includes(s)
      );
    });
  }, [rows, query]);

  /** Overall counts (mengikuti search) */
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

  /** Rekap per tahun (card grid) -> tidak pakai filter tabel, hanya sumber raw rows */
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

    return Array.from(map.entries())
      .map(([year, v]) => ({ year, ...v }))
      .sort((a, b) => b.year - a.year);
  }, [rows]);

  /** Items untuk chart (overall) */
  const statusItems: StatusItem[] = useMemo(
    () => [
      {
        label: "Aktif",
        value: overallCounts.aktif,
        color: "#22C55E",
        icon: FiUsers,
      },
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

  /** Cards atas */
  const stats = useMemo(() => {
    const risiko = overallCounts.dropout + overallCounts.skorsing;
    return [
      {
        title: "Total Data",
        value: totalAll.toLocaleString("id-ID"),
        icon: FiLayers,
        hint: "gabungan semua tahun",
      },
      {
        title: "Aktif",
        value: overallCounts.aktif.toLocaleString("id-ID"),
        icon: FiUsers,
        hint: "taruna aktif",
      },
      {
        title: "Lulus",
        value: overallCounts.lulus.toLocaleString("id-ID"),
        icon: FiTrendingUp,
        hint: "total kelulusan",
      },
      {
        title: "Risiko (DO+Skors)",
        value: risiko.toLocaleString("id-ID"),
        icon: FiAlertTriangle,
        hint: "perlu evaluasi",
      },
    ];
  }, [overallCounts, totalAll]);

  /** =========================
   *  REKAP TABEL (angkatan/program/jalur/prodi/status)
   *  - menggunakan semua rows (bukan searched), karena filter tabel terpisah
   *  ========================= */
  const rekapAll: RekapRow[] = useMemo(() => {
    // key: year|programTingkat|jalur|prodi
    const map = new Map<string, Omit<RekapRow, "belumLulus">>();

    for (const r of rows) {
      const y = Number(r.year);
      if (!Number.isFinite(y) || y <= 0) continue;

      const programTingkat = kategoriToProgramTingkat(r.kategori);
      const jalur = parseJalur(r.program);
      const prodi = parseProdi(r.program);

      const key = `${y}|${programTingkat}|${jalur}|${prodi}`;

      if (!map.has(key)) {
        map.set(key, {
          year: y,
          programTingkat,
          jalur,
          prodi,
          total: 0,
          aktif: 0,
          lulus: 0,
          cuti: 0,
          skorsing: 0,
          dropout: 0,
          mengundurkan: 0,
        });
      }

      const obj = map.get(key)!;
      obj.total += 1;

      const st = normalizeStatus(r.keterangan);
      obj[st] += 1;
    }

    const out: RekapRow[] = Array.from(map.values()).map((x) => ({
      ...x,
      belumLulus: x.total - x.lulus, // ✅ belum lulus = selain lulus
    }));

    // urut rapi: year desc, program, jalur, prodi
    out.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      if (a.programTingkat !== b.programTingkat)
        return a.programTingkat.localeCompare(b.programTingkat);
      if (a.jalur !== b.jalur) return a.jalur.localeCompare(b.jalur);
      return a.prodi.localeCompare(b.prodi);
    });

    return out;
  }, [rows]);

  /** =========================
   *  FILTER TABEL REKAP
   *  ========================= */
  const [filterYear, setFilterYear] = useState<number | "ALL">("ALL");
  const [filterYearInput, setFilterYearInput] = useState<string>(""); // input bebas

  const [filterProgramTingkat, setFilterProgramTingkat] = useState<
    ProgramTingkat | "ALL"
  >("ALL");
  const [filterJalur, setFilterJalur] = useState<Jalur | "ALL">("ALL");
  const [filterProdi, setFilterProdi] = useState<Prodi | "ALL">("ALL");

  const filterOptions = useMemo(() => {
    const years = Array.from(new Set(rekapAll.map((r) => r.year))).sort(
      (a, b) => b - a,
    );
    const programs = Array.from(
      new Set(rekapAll.map((r) => r.programTingkat)),
    ).sort((a, b) => a.localeCompare(b));
    const jalurs = Array.from(new Set(rekapAll.map((r) => r.jalur))).sort(
      (a, b) => a.localeCompare(b),
    );
    const prodis = Array.from(new Set(rekapAll.map((r) => r.prodi))).sort(
      (a, b) => a.localeCompare(b),
    );
    return { years, programs, jalurs, prodis };
  }, [rekapAll]);

  const rekapFiltered = useMemo(() => {
    return rekapAll.filter((r) => {
      if (filterYear !== "ALL" && r.year !== filterYear) return false;
      if (
        filterProgramTingkat !== "ALL" &&
        r.programTingkat !== filterProgramTingkat
      )
        return false;
      if (filterJalur !== "ALL" && r.jalur !== filterJalur) return false;
      if (filterProdi !== "ALL" && r.prodi !== filterProdi) return false;
      return true;
    });
  }, [rekapAll, filterYear, filterProgramTingkat, filterJalur, filterProdi]);

  /** Total per angkatan (mengikuti filter tabel) */
  const totalPerAngkatanFiltered = useMemo(() => {
    const map = new Map<
      number,
      {
        year: number;
        total: number;
        aktif: number;
        lulus: number;
        cuti: number;
        skorsing: number;
        dropout: number;
        mengundurkan: number;
        belumLulus: number;
      }
    >();

    for (const r of rekapFiltered) {
      if (!map.has(r.year)) {
        map.set(r.year, {
          year: r.year,
          total: 0,
          aktif: 0,
          lulus: 0,
          cuti: 0,
          skorsing: 0,
          dropout: 0,
          mengundurkan: 0,
          belumLulus: 0,
        });
      }
      const t = map.get(r.year)!;
      t.total += r.total;
      t.aktif += r.aktif;
      t.lulus += r.lulus;
      t.cuti += r.cuti;
      t.skorsing += r.skorsing;
      t.dropout += r.dropout;
      t.mengundurkan += r.mengundurkan;
      t.belumLulus += r.belumLulus;
    }

    return Array.from(map.values()).sort((a, b) => b.year - a.year);
  }, [rekapFiltered]);

  /** Grand total semua angkatan (mengikuti filter tabel) */
  const grandTotalFiltered = useMemo(() => {
    return totalPerAngkatanFiltered.reduce(
      (acc, r) => {
        acc.total += r.total;
        acc.aktif += r.aktif;
        acc.lulus += r.lulus;
        acc.cuti += r.cuti;
        acc.skorsing += r.skorsing;
        acc.dropout += r.dropout;
        acc.mengundurkan += r.mengundurkan;
        acc.belumLulus += r.belumLulus;
        return acc;
      },
      {
        total: 0,
        aktif: 0,
        lulus: 0,
        cuti: 0,
        skorsing: 0,
        dropout: 0,
        mengundurkan: 0,
        belumLulus: 0,
      },
    );
  }, [totalPerAngkatanFiltered]);

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
            <div className="text-sm text-white/60">REKAP TARUNA POLTEKPEL</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              Dashboard Utama{" "}
              <span className="text-white/50">— rekap semua tahun</span>
            </h1>
            <div className="mt-2 text-xs text-white/55 flex items-center gap-2">
              <FiLayers />
              <span>Source: Firestore • Collection: students</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-80">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/55" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search… (tahun/kategori/status/program)"
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

            {/* Charts */}
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
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
                    <div className="mt-1 text-xs text-white/55">
                      Chart mengikuti search (kalau search diisi)
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
                    Sinkron dengan pie
                  </div>
                </div>

                <div className="mt-4">
                  <BarChart items={statusItems} />
                </div>
              </motion.div>
            </div>

            {/* Rekap per tahun (cards link) */}
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
                        Aktif:{" "}
                        <span className="text-white font-semibold">
                          {y.counts.aktif}
                        </span>
                      </div>
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
                      <div className="rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                        Undur:{" "}
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

            {/* =========================
                TABEL REKAP SEMUA (angkatan/program/jalur/prodi/status)
               ========================= */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={8}
              className="mt-6 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm text-white/70 flex items-center gap-2">
                    <FiTable /> Tabel Rekap Semua
                  </div>
                  <div className="text-lg font-semibold">
                    Angkatan • Program • Jalur • Prodi • Status
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    Jalur diambil dari field <b>program</b>:
                    (mandiri)/(reguler), jika tidak ada maka{" "}
                    <b>default Reguler</b>.
                  </div>
                </div>

                <div className="text-xs text-white/60">
                  Baris:{" "}
                  <span className="text-white/85 font-semibold">
                    {rekapFiltered.length}
                  </span>
                </div>
              </div>

              {/* Filters */}
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3">
                  <div className="text-xs text-white/60 flex items-center gap-2">
                    <FiFilter /> Filter
                  </div>

                  <button
                    onClick={() => {
                      setFilterYear("ALL");
                      setFilterYearInput("");
                      setFilterProgramTingkat("ALL");
                      setFilterJalur("ALL");
                      setFilterProdi("ALL");
                    }}
                    className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10 hover:bg-white/10"
                  >
                    <FiRotateCcw /> Reset
                  </button>
                </div>

                {/* Tahun */}
                <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/60 flex items-center gap-2">
                      <FiCalendar /> Filter Tahun
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setFilterYear("ALL");
                        setFilterYearInput("");
                      }}
                      className="rounded-xl bg-black/30 px-3 py-1 text-xs ring-1 ring-white/10 hover:bg-white/10"
                    >
                      ALL
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={filterYearInput}
                      onChange={(e) => setFilterYearInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const y = Number(filterYearInput);
                          if (Number.isFinite(y) && y >= 1900 && y <= 2100)
                            setFilterYear(y);
                        }
                      }}
                      type="number"
                      min={1900}
                      max={2100}
                      placeholder="contoh: 2019"
                      className="w-full rounded-2xl bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none focus:ring-white/20"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const y = Number(filterYearInput);
                        if (Number.isFinite(y) && y >= 1900 && y <= 2100)
                          setFilterYear(y);
                      }}
                      className="rounded-2xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/10"
                      title="Terapkan tahun"
                    >
                      Terapkan
                    </button>
                  </div>

                  <div className="mt-2 text-xs text-white/55">
                    Tahun aktif:{" "}
                    <span className="text-white/80 font-semibold">
                      {filterYear === "ALL" ? "Semua" : filterYear}
                    </span>
                  </div>
                </div>

                {/* Program */}
                <select
                  value={filterProgramTingkat}
                  onChange={(e) =>
                    setFilterProgramTingkat(e.target.value as any)
                  }
                  className="rounded-2xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-white/20"
                >
                  <option value="ALL" className="bg-[#070A14]">
                    Semua Program
                  </option>
                  {filterOptions.programs.map((p) => (
                    <option key={p} value={p} className="bg-[#070A14]">
                      {p}
                    </option>
                  ))}
                </select>

                {/* Jalur */}
                <select
                  value={filterJalur}
                  onChange={(e) => setFilterJalur(e.target.value as any)}
                  className="rounded-2xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-white/20"
                >
                  <option value="ALL" className="bg-[#070A14]">
                    Semua Jalur
                  </option>
                  {filterOptions.jalurs.map((j) => (
                    <option key={j} value={j} className="bg-[#070A14]">
                      {j}
                    </option>
                  ))}
                </select>

                {/* Prodi */}
                <select
                  value={filterProdi}
                  onChange={(e) => setFilterProdi(e.target.value as any)}
                  className="rounded-2xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-white/20 md:col-start-4"
                >
                  <option value="ALL" className="bg-[#070A14]">
                    Semua Prodi
                  </option>
                  {filterOptions.prodis.map((p) => (
                    <option key={p} value={p} className="bg-[#070A14]">
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Table */}
              <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-white/10">
                <table className="min-w-[1200px] w-full text-sm">
                  <thead className="bg-black/30 text-white/70">
                    <tr>
                      <th className="px-3 py-3 text-left">Angkatan</th>
                      <th className="px-3 py-3 text-left">Program</th>
                      <th className="px-3 py-3 text-left">Jalur</th>
                      <th className="px-3 py-3 text-left">Prodi</th>

                      <th className="px-3 py-3 text-right">Jumlah Awal</th>
                      <th className="px-3 py-3 text-right">Aktif</th>
                      <th className="px-3 py-3 text-right">Lulus</th>
                      <th className="px-3 py-3 text-right">Cuti</th>
                      <th className="px-3 py-3 text-right">Skorsing</th>
                      <th className="px-3 py-3 text-right">DO</th>
                      <th className="px-3 py-3 text-right">Mengundurkan</th>
                      <th className="px-3 py-3 text-right">Belum Lulus</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rekapFiltered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={12}
                          className="px-3 py-8 text-center text-white/60"
                        >
                          Tidak ada data sesuai filter.
                        </td>
                      </tr>
                    ) : (
                      rekapFiltered.map((r, idx) => (
                        <tr
                          key={`${r.year}-${r.programTingkat}-${r.jalur}-${r.prodi}-${idx}`}
                          className="border-t border-white/10 hover:bg-white/5"
                        >
                          <td className="px-3 py-3 font-semibold">{r.year}</td>
                          <td className="px-3 py-3 text-white/85">
                            {r.programTingkat}
                          </td>
                          <td className="px-3 py-3 text-white/85">{r.jalur}</td>
                          <td className="px-3 py-3 text-white/85">{r.prodi}</td>

                          <td className="px-3 py-3 text-right font-semibold">
                            {r.total}
                          </td>
                          <td className="px-3 py-3 text-right">{r.aktif}</td>
                          <td className="px-3 py-3 text-right">{r.lulus}</td>
                          <td className="px-3 py-3 text-right">{r.cuti}</td>
                          <td className="px-3 py-3 text-right">{r.skorsing}</td>
                          <td className="px-3 py-3 text-right">{r.dropout}</td>
                          <td className="px-3 py-3 text-right">
                            {r.mengundurkan}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-white/90">
                            {r.belumLulus}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  {/* Totals per angkatan + grand total */}
                  {totalPerAngkatanFiltered.length > 0 && (
                    <tfoot className="bg-black/20">
                      {totalPerAngkatanFiltered.map((t) => (
                        <tr
                          key={`total-${t.year}`}
                          className="border-t border-white/10"
                        >
                          <td className="px-3 py-3 font-semibold" colSpan={4}>
                            Total Angkatan {t.year}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold">
                            {t.total}
                          </td>
                          <td className="px-3 py-3 text-right">{t.aktif}</td>
                          <td className="px-3 py-3 text-right">{t.lulus}</td>
                          <td className="px-3 py-3 text-right">{t.cuti}</td>
                          <td className="px-3 py-3 text-right">{t.skorsing}</td>
                          <td className="px-3 py-3 text-right">{t.dropout}</td>
                          <td className="px-3 py-3 text-right">
                            {t.mengundurkan}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-white/90">
                            {t.belumLulus}
                          </td>
                        </tr>
                      ))}

                      <tr className="border-t border-white/10">
                        <td className="px-3 py-4 font-bold" colSpan={4}>
                          Grand Total (Semua Angkatan)
                        </td>
                        <td className="px-3 py-4 text-right font-bold">
                          {grandTotalFiltered.total}
                        </td>
                        <td className="px-3 py-4 text-right font-bold">
                          {grandTotalFiltered.aktif}
                        </td>
                        <td className="px-3 py-4 text-right font-bold">
                          {grandTotalFiltered.lulus}
                        </td>
                        <td className="px-3 py-4 text-right font-bold">
                          {grandTotalFiltered.cuti}
                        </td>
                        <td className="px-3 py-4 text-right font-bold">
                          {grandTotalFiltered.skorsing}
                        </td>
                        <td className="px-3 py-4 text-right font-bold">
                          {grandTotalFiltered.dropout}
                        </td>
                        <td className="px-3 py-4 text-right font-bold">
                          {grandTotalFiltered.mengundurkan}
                        </td>
                        <td className="px-3 py-4 text-right font-bold text-white">
                          {grandTotalFiltered.belumLulus}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <div className="mt-3 text-[11px] text-white/45">
                Catatan: <b>Belum Lulus</b> = semua status selain <b>Lulus</b>{" "}
                (otomatis: total - lulus). Jalur default <b>Reguler</b> jika
                program tidak mengandung (reguler)/(mandiri).
              </div>
            </motion.div>
          </>
        )}

        <div className="mt-6 text-xs text-white/45">
          © {new Date().getFullYear()} REKAP TARUNA POLTEKPEL
        </div>
      </div>
    </div>
  );
}
