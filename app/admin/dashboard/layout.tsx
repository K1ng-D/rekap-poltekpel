"use client";

import React, { useEffect, useState } from "react";
import SidebarAdmin from "@/components/SideBar";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { usePathname, useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ===== AUTH GUARD =====
  const router = useRouter();
  const pathname = usePathname();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setCheckingAuth(false);
    });

    return () => unsub();
  }, [router, pathname]);

  // ===== SIDEBAR STATE =====
  const [selectedYear, setSelectedYear] = useState<number>(2019);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  function handleSelect(year: number, category: string | null) {
    setSelectedYear(year);
    setSelectedCategory(category);
  }

  // tampil loading saat cek auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#070A14] text-white flex items-center justify-center">
        <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          Memverifikasi akses admin...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A14] text-white">
      <div className="mx-auto px-4 py-6">
        <div className="grid gap-4 md:grid-cols-[288px_1fr]">
          <SidebarAdmin
            selectedYear={selectedYear}
            selectedCategory={selectedCategory}
            onSelect={handleSelect}
          />

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
