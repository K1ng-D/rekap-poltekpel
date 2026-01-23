"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiHome,
  FiFolder,
  FiChevronDown,
  FiCalendar,
  FiBookOpen,
} from "react-icons/fi";

type SidebarAdminProps = {
  selectedYear: number;
  selectedCategory: string | null;
  onSelect: (year: number, category: string | null) => void;
};

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function SidebarAdmin({
  selectedYear,
  selectedCategory,
  onSelect,
}: SidebarAdminProps) {
  const pathname = usePathname();

  const years = useMemo(() => [2019, 2020, 2021, 2022, 2023, 2024, 2025], []);
  const kategoris = useMemo(
    () => [
      { slug: "diploma-iii", label: "Diploma III" },
      { slug: "dp-iii", label: "DP III" },
      { slug: "dp-iv", label: "DP IV" },
    ],
    [],
  );

  const [open, setOpen] = useState(true);

  const isHome = pathname === "/admin/dashboard";
  const isYearPage =
    pathname === `/admin/dashboard/${selectedYear}` ||
    pathname.startsWith(`/admin/dashboard/${selectedYear}/`);

  return (
    <aside className="w-full md:w-72 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur">
      <div className="mb-4">
        <div className="text-xs text-white/60">Navigation</div>
        <h2 className="text-lg font-semibold">Dashboard</h2>
      </div>

      <nav className="space-y-2">
        <Link
          href="/admin/dashboard"
          className={[
            "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm ring-1 transition",
            isHome
              ? "bg-cyan-400/10 ring-cyan-300/30"
              : "bg-black/20 ring-white/10 hover:bg-white/10",
          ].join(" ")}
        >
          <FiHome />
          Dashboard Utama
        </Link>

        <div className="rounded-2xl bg-black/20 ring-1 ring-white/10">
          <button
            onClick={() => setOpen((p) => !p)}
            className={[
              "flex w-full items-center gap-3 px-3 py-3 text-sm rounded-2xl transition",
              open ? "bg-white/5" : "hover:bg-white/5",
            ].join(" ")}
          >
            <span className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
              <FiFolder />
            </span>
            <span className="flex-1 text-left">
              <div className="font-semibold">Data Pertahun</div>
              <div className="text-xs text-white/50">
                Klik untuk pilih tahun
              </div>
            </span>

            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.2, ease }}
              className="text-white/70"
            >
              <FiChevronDown />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3">
                  <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
                    <FiCalendar />
                    <span>Pilih Tahun</span>
                  </div>

                  <select
                    value={selectedYear}
                    onChange={(e) => onSelect(Number(e.target.value), null)}
                    className="mt-2 w-full rounded-2xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 outline-none focus:ring-white/20"
                  >
                    {years.map((y) => (
                      <option key={y} value={y} className="bg-[#070A14]">
                        {y}
                      </option>
                    ))}
                  </select>

                  <div className="mt-3 space-y-2">
                    <Link
                      href={`/admin/dashboard/${selectedYear}`}
                      className={[
                        "block rounded-2xl px-3 py-2 text-sm ring-1 transition",
                        isYearPage
                          ? "bg-cyan-400/10 ring-cyan-300/25"
                          : "bg-white/5 ring-white/10 hover:bg-white/10",
                      ].join(" ")}
                    >
                      Lihat semua data {selectedYear}
                    </Link>

                    <div className="grid grid-cols-1 gap-2">
                      {kategoris.map((k) => {
                        const active = pathname.startsWith(
                          `/admin/dashboard/${selectedYear}/${k.slug}`,
                        );

                        return (
                          <Link
                            key={k.slug}
                            href={`/admin/dashboard/${selectedYear}/${k.slug}`}
                            onClick={() => onSelect(selectedYear, k.slug)}
                            className={[
                              "flex items-center gap-2 rounded-2xl px-3 py-2 text-sm ring-1 transition",
                              active
                                ? "bg-fuchsia-500/10 ring-fuchsia-300/30"
                                : "bg-black/30 ring-white/10 hover:bg-white/10",
                            ].join(" ")}
                          >
                            <FiBookOpen />
                            {k.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-black/30 p-3 text-xs text-white/65 ring-1 ring-white/10">
                    Tahun aktif:{" "}
                    <span className="text-white font-semibold">
                      {selectedYear}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </aside>
  );
}
