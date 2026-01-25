"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import Papa from "papaparse";
import { CldUploadWidget } from "next-cloudinary";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  FiChevronLeft,
  FiChevronRight,
  FiCalendar,
  FiTag,
  FiUsers,
  FiCheckCircle,
  FiPauseCircle,
  FiXCircle,
  FiAlertTriangle,
  FiSearch,
  FiUploadCloud,
  FiTrash2,
  FiLogOut,
  FiEdit3,
  FiSave,
  FiX,
} from "react-icons/fi";

// ✅ sesuaikan path ini dengan project kamu
import { db } from "@/lib/firebase";
// kalau yang benar: import { db } from "@/lib/firebase/client";

import {
  collection,
  query,
  where,
  onSnapshot,
  writeBatch,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";

/** ===== Cloudinary ===== */
const UPLOAD_PRESET_NAME = "poltekpel"; // <-- preset kamu
const SIGNATURE_ENDPOINT = "/api/sign-cloudinary-params";

/** slug -> label */
const KATEGORI_MAP: Record<string, string> = {
  "diploma-iii": "Diploma III",
  "dp-iii": "DP III",
  "dp-iv": "DP IV",
};

type SkFile = {
  name: string;
  url: string;
  publicId: string;
};

type Student = {
  id: string;
  year: number;
  kategori: string;

  no: number;
  nama: string;
  nrt: string;
  ttl: string; // CSV: TTL
  lp: string; // CSV: L/P
  program: string;
  keterangan: string; // CSV: KET

  skName: string; // CSV: SK (tampil teks)
  skFile: SkFile | null; // Cloudinary (link)
};

type PieSlice = { label: string; value: number; color: string };

type StatusKey =
  | "aktif"
  | "lulus"
  | "skorsing"
  | "cuti"
  | "dropout"
  | "mengundurkan";

type StatusItem = {
  key: StatusKey;
  label: string;
  value: number;
  color: string;
  icon: React.ComponentType<any>;
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

/** ===== STATUS MAPPING (6 status) ===== */
function normalizeStatus(keterangan: string): StatusKey {
  const s = (keterangan || "").toLowerCase().trim().replace(/\s+/g, " ");

  // kalau kosong -> mengundurkan (sesuai aturan sebelumnya)
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

function parseNumberSafe(x: any, fallback = 0) {
  const n = Number(String(x ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

/** Normalisasi header CSV:
 * NO/NO. -> no
 * NAMA -> nama
 * NRT -> nrt
 * TTL -> ttl
 * L/P -> lp
 * PROGRAM -> program
 * KET -> ket
 * SK -> sk
 */
function normalizeHeader(h: string) {
  return h
    .toLowerCase()
    .trim()
    .replace(/\uFEFF/g, "")
    .replace(/[\s._,/-]+/g, "");
}

function detectDelimiter(sampleText: string): "," | "\t" {
  const tabCount = (sampleText.match(/\t/g) || []).length;
  const commaCount = (sampleText.match(/,/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
}

/** ===== PIE HELPERS ===== */
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
            key={it.key}
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

export default function Page() {
  const params = useParams<{ year: string; kategori: string }>();
  const year = Number(params.year);
  const kategoriSlug = String(params.kategori || "").toLowerCase();
  const kategoriLabel = KATEGORI_MAP[kategoriSlug];

  const allowedYear = Number.isFinite(year) && year >= 2000 && year <= 2100;
  if (!allowedYear || !kategoriLabel) return notFound();

  /** Firestore data */
  const [rows, setRows] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  /** UI */
  const [qText, setQText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey | null>(null);

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /** Edit row state */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Student>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [qText, statusFilter, year, kategoriSlug]);

  /** READ realtime */
  useEffect(() => {
    setLoading(true);
    setErr(null);

    const qRef = query(
      collection(db, "students"),
      where("year", "==", year),
      where("kategori", "==", kategoriSlug),
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const data: Student[] = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            year: x.year,
            kategori: x.kategori,
            no: Number(x.no ?? 0),
            nama: x.nama ?? "",
            nrt: x.nrt ?? "",
            ttl: x.ttl ?? "",
            lp: x.lp ?? "",
            program: x.program ?? "",
            keterangan: x.keterangan ?? "",
            skName: x.skName ?? "",
            skFile: x.skFile && typeof x.skFile === "object" ? x.skFile : null,
          };
        });

        data.sort((a, b) => Number(a.no) - Number(b.no));
        setRows(data);
        setLoading(false);
      },
      (e) => {
        setErr(e?.message ?? String(e));
        setLoading(false);
      },
    );

    return () => unsub();
  }, [year, kategoriSlug]);

  /** FILTER */
  const filtered = useMemo(() => {
    const s = qText.trim().toLowerCase();

    return rows.filter((r) => {
      const matchSearch =
        !s ||
        String(r.no).toLowerCase().includes(s) ||
        r.nama.toLowerCase().includes(s) ||
        r.nrt.toLowerCase().includes(s) ||
        r.program.toLowerCase().includes(s) ||
        r.keterangan.toLowerCase().includes(s) ||
        r.skName.toLowerCase().includes(s);

      if (!matchSearch) return false;

      if (!statusFilter) return true;
      return normalizeStatus(r.keterangan) === statusFilter;
    });
  }, [rows, qText, statusFilter]);

  /** STATUS COUNTS */
  const statusItems: StatusItem[] = useMemo(() => {
    const counts: Record<StatusKey, number> = {
      aktif: 0,
      lulus: 0,
      skorsing: 0,
      cuti: 0,
      dropout: 0,
      mengundurkan: 0,
    };

    for (const r of filtered) {
      counts[normalizeStatus(r.keterangan)] += 1;
    }

    return [
      {
        key: "aktif",
        label: "Aktif",
        value: counts.aktif,
        color: "#22C55E",
        icon: FiUsers,
      },
      {
        key: "lulus",
        label: "Lulus",
        value: counts.lulus,
        color: "#00E5FF",
        icon: FiCheckCircle,
      },
      {
        key: "skorsing",
        label: "Skorsing",
        value: counts.skorsing,
        color: "#FF2D95",
        icon: FiAlertTriangle,
      },
      {
        key: "cuti",
        label: "Cuti Akademik",
        value: counts.cuti,
        color: "#B6FF00",
        icon: FiPauseCircle,
      },
      {
        key: "dropout",
        label: "Dropout",
        value: counts.dropout,
        color: "#FFB000",
        icon: FiXCircle,
      },
      {
        key: "mengundurkan",
        label: "Mengundurkan Diri",
        value: counts.mengundurkan,
        color: "#8B5CFF",
        icon: FiLogOut,
      },
    ];
  }, [filtered]);

  const total = useMemo(
    () => statusItems.reduce((a, b) => a + b.value, 0),
    [statusItems],
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

  /** PAGINATION */
  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pagedRows = useMemo(
    () => filtered.slice(start, end),
    [filtered, start, end],
  );

  /** IMPORT CSV -> Firestore */
  async function handleImportCsv(file: File) {
    setImporting(true);
    setImportMsg(null);

    try {
      const text = await file.text();
      const delimiter = detectDelimiter(text);

      const parsed = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        transformHeader: (h) => normalizeHeader(h),
      });

      if (parsed.errors?.length)
        throw new Error(parsed.errors[0]?.message || "CSV parse error");

      const dataRaw = (parsed.data || []) as Record<string, any>[];

      const mapped = dataRaw
        .map((r, idx) => {
          const no = parseNumberSafe(r["no"], idx + 1);
          return {
            year,
            kategori: kategoriSlug,
            no,
            nama: (r["nama"] ?? "").toString().trim(),
            nrt: (r["nrt"] ?? "").toString().trim(),
            ttl: (r["ttl"] ?? "").toString().trim(),
            lp: (r["lp"] ?? "").toString().trim(),
            program: (r["program"] ?? "").toString().trim(),
            // KET dari CSV -> keterangan
            keterangan: (r["ket"] ?? r["keterangan"] ?? "").toString().trim(),
            // SK dari CSV -> skName
            skName: (r["sk"] ?? "").toString().trim(),
            skFile: null,
          };
        })
        .filter(
          (x) =>
            x.nama || x.nrt || x.ttl || x.program || x.keterangan || x.skName,
        );

      if (mapped.length === 0) {
        setImportMsg("CSV terbaca, tapi tidak ada baris data yang valid.");
        setImporting(false);
        return;
      }

      // delete old data
      const existingSnap = await getDocs(
        query(
          collection(db, "students"),
          where("year", "==", year),
          where("kategori", "==", kategoriSlug),
        ),
      );

      const deletes = existingSnap.docs.map((d) => d.ref);
      const chunkSize = 450;

      for (let i = 0; i < deletes.length; i += chunkSize) {
        const b = writeBatch(db);
        deletes.slice(i, i + chunkSize).forEach((ref) => b.delete(ref));
        await b.commit();
      }

      for (let i = 0; i < mapped.length; i += chunkSize) {
        const b = writeBatch(db);
        const part = mapped.slice(i, i + chunkSize);

        part.forEach((item) => {
          const docId = `${year}_${kategoriSlug}_${item.no}_${(item.nrt || "NA").replace(/\s+/g, "")}`;
          b.set(doc(collection(db, "students"), docId), item, { merge: true });
        });

        await b.commit();
      }

      setImportMsg(`Import sukses ✅ Inserted: ${mapped.length} baris.`);
    } catch (e: any) {
      setImportMsg(`Import gagal ❌ ${e?.message ?? String(e)}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function clearData() {
    if (!confirm(`Hapus semua data ${year} • ${kategoriLabel}?`)) return;

    setImporting(true);
    setImportMsg(null);

    try {
      const snap = await getDocs(
        query(
          collection(db, "students"),
          where("year", "==", year),
          where("kategori", "==", kategoriSlug),
        ),
      );

      const refs = snap.docs.map((d) => d.ref);
      const chunkSize = 450;

      for (let i = 0; i < refs.length; i += chunkSize) {
        const b = writeBatch(db);
        refs.slice(i, i + chunkSize).forEach((ref) => b.delete(ref));
        await b.commit();
      }

      setImportMsg(`Data berhasil dihapus ✅ (${refs.length} dokumen).`);
    } catch (e: any) {
      setImportMsg(`Gagal hapus data ❌ ${e?.message ?? String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  /** EDIT */
  function startEdit(row: Student) {
    setEditingId(row.id);
    setDraft({
      nama: row.nama,
      nrt: row.nrt,
      ttl: row.ttl,
      lp: row.lp,
      program: row.program,
      keterangan: row.keterangan,
      skName: row.skName,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
  }

  async function saveEdit(rowId: string) {
    if (editingId !== rowId) return;
    setSavingId(rowId);

    try {
      const ref = doc(collection(db, "students"), rowId);
      await updateDoc(ref, {
        nama: String(draft.nama ?? "").trim(),
        nrt: String(draft.nrt ?? "").trim(),
        ttl: String(draft.ttl ?? "").trim(),
        lp: String(draft.lp ?? "").trim(),
        program: String(draft.program ?? "").trim(),
        keterangan: String(draft.keterangan ?? "").trim(),
        skName: String(draft.skName ?? "").trim(),
      });
      setEditingId(null);
      setDraft({});
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan perubahan.");
    } finally {
      setSavingId(null);
    }
  }

  async function setSkFile(rowId: string, file: SkFile, fallbackName: string) {
    const ref = doc(collection(db, "students"), rowId);
    const finalName = fallbackName?.trim() ? fallbackName : file.name;

    // ✅ simpan hanya field aman (tanpa format/resourceType)
    await updateDoc(ref, {
      skName: finalName,
      skFile: {
        name: finalName,
        url: file.url,
        publicId: file.publicId,
      },
    });
  }

  const empty = !loading && !err && rows.length === 0;

  return (
    <div className="min-h-screen bg-[#070A14] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
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
              Tahun {year} •{" "}
              <span className="text-white/80">{kategoriLabel}</span>
            </h1>

            <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
                <FiCalendar /> {year}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
                <FiTag /> {kategoriLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
                <FiUsers /> Total: {total}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/dashboard/${year}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/10"
            >
              <FiChevronLeft /> Kembali Tahun {year}
            </Link>
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/10"
            >
              Dashboard Utama <FiChevronRight />
            </Link>
          </div>
        </motion.div>

        {/* Import panel */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={0}
          className="mt-6 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm text-white/70">Import Data</div>
              <div className="text-lg font-semibold">Upload CSV</div>
              <div className="text-xs text-white/55">
                Header: <b>NO,NAMA,NRT,TTL,L/P,PROGRAM,KET,SK</b>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportCsv(f);
                }}
              />

              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400/10 px-4 py-2 text-sm ring-1 ring-cyan-300/25 hover:bg-cyan-400/15 disabled:opacity-60"
              >
                <FiUploadCloud /> {importing ? "Importing..." : "Import CSV"}
              </button>

              <button
                onClick={clearData}
                disabled={importing}
                className="inline-flex items-center gap-2 rounded-2xl bg-fuchsia-500/10 px-4 py-2 text-sm ring-1 ring-fuchsia-300/25 hover:bg-fuchsia-500/15 disabled:opacity-60"
              >
                <FiTrash2 /> Hapus Data
              </button>
            </div>
          </div>

          {importMsg && (
            <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm text-white/80 ring-1 ring-white/10">
              {importMsg}
            </div>
          )}
        </motion.div>

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
            {empty && (
              <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                <div className="text-lg font-semibold">Data masih kosong</div>
                <div className="mt-1 text-sm text-white/70">
                  Klik <b>Import CSV</b> untuk mengisi data.
                </div>
              </div>
            )}

            {/* Charts */}
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={1}
                className="lg:col-span-1 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white/70">Snapshot</div>
                    <div className="text-lg font-semibold">Kondisi Aktual</div>
                    <div className="mt-1 text-xs text-white/55">
                      Termasuk status <b>Aktif</b>
                    </div>
                  </div>
                  <div className="text-xs text-white/60">
                    Total:{" "}
                    <span className="text-white/90 font-semibold">{total}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <PieChart slices={slices} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {statusItems.map((s) => (
                    <div
                      key={s.key}
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
                      <span className="ml-auto text-white font-semibold">
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={2}
                className="lg:col-span-2 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white/70">Chart Bar</div>
                    <div className="text-lg font-semibold">
                      Distribusi Status
                    </div>
                  </div>
                  <div className="text-xs text-white/55">
                    6 status (termasuk Aktif)
                  </div>
                </div>

                <div className="mt-4">
                  <BarChart items={statusItems} />
                </div>
              </motion.div>
            </div>

            {/* Table */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={3}
              className="mt-6 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm text-white/70">Data Taruna</div>
                  <div className="text-lg font-semibold">Records</div>
                  <div className="text-xs text-white/55">
                    Menampilkan: {pagedRows.length} data (Hal {currentPage}/
                    {totalPages}) dari {totalRows}
                  </div>
                </div>

                <div className="relative w-full md:w-96">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/55" />
                  <input
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    placeholder="Search (Nama/NRT/Status/SK)"
                    className="w-full rounded-2xl bg-white/5 px-10 py-2.5 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none focus:ring-white/20"
                  />
                </div>
              </div>

              {/* Filter chips */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setStatusFilter(null)}
                  className={[
                    "rounded-2xl px-4 py-2 text-sm ring-1 transition",
                    statusFilter === null
                      ? "bg-white/10 ring-white/20"
                      : "bg-black/20 ring-white/10 hover:bg-white/10",
                  ].join(" ")}
                >
                  Semua
                </button>

                {statusItems.map((it) => {
                  const active = statusFilter === it.key;
                  return (
                    <button
                      key={it.key}
                      onClick={() => setStatusFilter(active ? null : it.key)}
                      className={[
                        "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm ring-1 transition",
                        active
                          ? "ring-white/25 bg-white/10"
                          : "bg-black/20 ring-white/10 hover:bg-white/10",
                      ].join(" ")}
                      style={
                        active
                          ? { boxShadow: `0 0 18px ${it.color}25` }
                          : undefined
                      }
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: it.color,
                          boxShadow: `0 0 10px ${it.color}`,
                        }}
                      />
                      {it.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-white/10">
                <table className="min-w-[1450px] w-full text-sm">
                  <thead className="bg-black/30 text-white/70">
                    <tr>
                      <th className="px-3 py-3 text-left">NO</th>
                      <th className="px-3 py-3 text-left">NAMA</th>
                      <th className="px-3 py-3 text-left">NRT</th>
                      <th className="px-3 py-3 text-left">TTL</th>
                      <th className="px-3 py-3 text-left">L/P</th>
                      <th className="px-3 py-3 text-left">PROGRAM</th>
                      <th className="px-3 py-3 text-left">SK</th>
                      <th className="px-3 py-3 text-left">STATUS</th>
                      <th className="px-3 py-3 text-left">Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagedRows.map((r) => {
                      const isEditing = editingId === r.id;

                      return (
                        <tr
                          key={r.id}
                          className="border-t border-white/10 hover:bg-white/5"
                        >
                          <td className="px-3 py-3 text-white/80">{r.no}</td>

                          <td className="px-3 py-3">
                            {isEditing ? (
                              <input
                                value={String(draft.nama ?? "")}
                                onChange={(e) =>
                                  setDraft((p) => ({
                                    ...p,
                                    nama: e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-white/20"
                              />
                            ) : (
                              <span className="font-semibold">{r.nama}</span>
                            )}
                          </td>

                          <td className="px-3 py-3 text-white/80">
                            {isEditing ? (
                              <input
                                value={String(draft.nrt ?? "")}
                                onChange={(e) =>
                                  setDraft((p) => ({
                                    ...p,
                                    nrt: e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-white/20"
                              />
                            ) : (
                              r.nrt
                            )}
                          </td>

                          <td className="px-3 py-3 text-white/80">
                            {isEditing ? (
                              <input
                                value={String(draft.ttl ?? "")}
                                onChange={(e) =>
                                  setDraft((p) => ({
                                    ...p,
                                    ttl: e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-white/20"
                              />
                            ) : (
                              r.ttl
                            )}
                          </td>

                          <td className="px-3 py-3 text-white/80">
                            {isEditing ? (
                              <select
                                value={String(draft.lp ?? "")}
                                onChange={(e) =>
                                  setDraft((p) => ({
                                    ...p,
                                    lp: e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-white/20"
                              >
                                <option value="" className="bg-[#070A14]">
                                  -
                                </option>
                                <option value="L" className="bg-[#070A14]">
                                  L
                                </option>
                                <option value="P" className="bg-[#070A14]">
                                  P
                                </option>
                              </select>
                            ) : (
                              r.lp
                            )}
                          </td>

                          <td className="px-3 py-3 text-white/80">
                            {isEditing ? (
                              <input
                                value={String(draft.program ?? "")}
                                onChange={(e) =>
                                  setDraft((p) => ({
                                    ...p,
                                    program: e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-white/20"
                              />
                            ) : (
                              r.program
                            )}
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              {r.skFile?.url ? (
                                <a
                                  href={r.skFile.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-cyan-300 hover:underline"
                                  title="Buka file SK"
                                >
                                  {r.skFile.name || r.skName || "Lihat SK"}
                                </a>
                              ) : (
                                <span
                                  className="text-sm text-white/70"
                                  title="File belum diupload"
                                >
                                  {r.skName ? r.skName : "Belum ada"}
                                </span>
                              )}

                              <CldUploadWidget
                                uploadPreset={UPLOAD_PRESET_NAME}
                                signatureEndpoint={SIGNATURE_ENDPOINT}
                                options={{
                                  sources: ["local"],
                                  multiple: false,
                                  resourceType: "raw",
                                  clientAllowedFormats: ["pdf"],
                                  folder: `poltekpel/${year}/${kategoriSlug}/sk`,
                                }}
                                onSuccess={async (result: any) => {
                                  const info = result?.info;
                                  if (!info?.secure_url || !info?.public_id)
                                    return;

                                  const uploadedName =
                                    info.original_filename && info.format
                                      ? `${info.original_filename}.${info.format}`
                                      : "SK.pdf";

                                  await setSkFile(
                                    r.id,
                                    {
                                      name: uploadedName,
                                      url: info.secure_url,
                                      publicId: info.public_id,
                                    },
                                    r.skName,
                                  );
                                }}
                              >
                                {({ open }) => (
                                  <button
                                    type="button"
                                    onClick={() => open()}
                                    className="rounded-xl bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10 hover:bg-white/10"
                                  >
                                    Upload
                                  </button>
                                )}
                              </CldUploadWidget>
                            </div>

                            {isEditing ? (
                              <div className="mt-2">
                                <input
                                  value={String(draft.skName ?? "")}
                                  onChange={(e) =>
                                    setDraft((p) => ({
                                      ...p,
                                      skName: e.target.value,
                                    }))
                                  }
                                  placeholder="Edit nama SK (opsional)"
                                  className="w-full rounded-xl bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10 outline-none focus:ring-white/20"
                                />
                              </div>
                            ) : null}
                          </td>

                          <td className="px-3 py-3 text-white/80">
                            {isEditing ? (
                              <select
                                value={String(draft.keterangan ?? "")}
                                onChange={(e) =>
                                  setDraft((p) => ({
                                    ...p,
                                    keterangan: e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-white/20"
                              >
                                <option value="aktif" className="bg-[#070A14]">
                                  aktif
                                </option>
                                <option value="lulus" className="bg-[#070A14]">
                                  lulus
                                </option>
                                <option
                                  value="skorsing"
                                  className="bg-[#070A14]"
                                >
                                  skorsing
                                </option>
                                <option
                                  value="cuti akademik"
                                  className="bg-[#070A14]"
                                >
                                  cuti akademik
                                </option>
                                <option
                                  value="do/ lewat masa studi (dropout)"
                                  className="bg-[#070A14]"
                                >
                                  do/ lewat masa studi (dropout)
                                </option>
                                <option
                                  value="mengundurkan diri"
                                  className="bg-[#070A14]"
                                >
                                  mengundurkan diri
                                </option>
                                <option
                                  value="pengunduran diri"
                                  className="bg-[#070A14]"
                                >
                                  pengunduran diri
                                </option>
                              </select>
                            ) : (
                              r.keterangan
                            )}
                          </td>

                          <td className="px-3 py-3">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => saveEdit(r.id)}
                                  disabled={savingId === r.id}
                                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-400/10 px-3 py-2 text-xs ring-1 ring-cyan-300/25 hover:bg-cyan-400/15 disabled:opacity-60"
                                >
                                  <FiSave />
                                  {savingId === r.id ? "Saving..." : "Save"}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10 hover:bg-white/10"
                                >
                                  <FiX /> Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEdit(r)}
                                className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10 hover:bg-white/10"
                              >
                                <FiEdit3 /> Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {pagedRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-3 py-6 text-center text-white/60"
                        >
                          Tidak ada data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-white/60">
                  Menampilkan{" "}
                  <span className="text-white/80">
                    {totalRows === 0 ? 0 : start + 1}
                  </span>
                  –
                  <span className="text-white/80">
                    {Math.min(end, totalRows)}
                  </span>{" "}
                  dari <span className="text-white/80">{totalRows}</span> data •
                  Hal <span className="text-white/80">{currentPage}</span>/
                  <span className="text-white/80">{totalPages}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="rounded-2xl bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="rounded-2xl bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}

        <div className="mt-6 text-xs text-white/45">
          © {new Date().getFullYear()} Admin Dashboard
        </div>
      </div>
    </div>
  );
}
