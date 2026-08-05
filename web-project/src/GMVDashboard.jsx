import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import {
  ArrowUp, ArrowDown, Minus, AlertTriangle, CheckCircle2, Info,
  ClipboardPaste, ChevronDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, Calendar, Trash2, Copy,
  Loader2, ShoppingBag, Music2, PlusCircle, FileSpreadsheet, Download, XCircle, Trophy, Medal,
  Radio, Eye, Clock,
} from "lucide-react";
import * as XLSX from "xlsx";
import { fetchAllEntries, saveEntryDay, deleteEntryDay, fetchAllTargets, saveTargetMonth, fetchAllRevisions, addRevisionRecord, fetchAllLiveSessions, saveLiveSession, deleteLiveSession } from "./storageAdapter.js";

/* ============================================================
   TOKENS — palet & tipografi
   Subjek: console performa harian toko kosmetik/skincare mass-market
   di 6 akun TikTok Shop + 1 Shopee. Nada: colorful & modern, terinspirasi
   dunia beauty-tech — gradient violet/fuchsia sebagai identitas utama,
   warna status tetap mengikuti konvensi (hijau=baik, merah=kurang baik).
   ============================================================ */
const PALETTE = {
  bg: "#FAF8FF",
  bgDeep: "#F1EBFF",
  panel: "#FFFFFF",
  panelAlt: "#F5F1FC",
  ink: "#1A1523",
  inkSoft: "#6B6478",
  inkFaint: "#A39DB0",
  line: "#E8E1F5",

  // Identitas utama — violet & fuchsia, dipakai untuk brand/CTA/hero
  brand: "#7C3AED",
  brandDeep: "#5B21B6",
  brand2: "#EC4899",
  brandSoft: "#F1E4FE",

  // Token nama lama dipertahankan (dipakai luas di seluruh kode) tapi nilainya
  // diganti ke palet vivid baru:
  teal: "#10B981",      // status POSITIF (emerald)
  tealDeep: "#059669",
  tealSoft: "#D1FAE5",
  coral: "#F43F5E",     // status NEGATIF (rose)
  coralDeep: "#BE123C",
  coralSoft: "#FFE4E9",
  ochre: "#F59E0B",     // status CAUTION (amber)
  ochreDeep: "#B45309",
  ochreSoft: "#FEF3C7",
  plum: "#6366F1",      // aksen sekunder (indigo)
  plumDeep: "#4338CA",
  plumSoft: "#E0E7FF",
};

// Glow & gradient helpers — dipakai untuk Dial (elemen signature halaman ini),
// kartu hero, dan tombol utama. Dipakai secukupnya, bukan di semua elemen.
const glow = (hex, intensity = 0.32) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `0 12px 32px -8px rgba(${r},${g},${b},${intensity}), 0 2px 8px -2px rgba(${r},${g},${b},${intensity * 0.6})`;
};
const cardShadow = "0 1px 2px rgba(26,21,35,0.05), 0 8px 24px -12px rgba(124,58,237,0.12)";
const cardShadowHover = "0 1px 2px rgba(26,21,35,0.06), 0 16px 36px -12px rgba(124,58,237,0.20)";
const gradientText = (from, to) => ({
  backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
  WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
});
const btnPrimaryStyle = (base, deep) => ({
  background: `linear-gradient(135deg, ${base}, ${deep})`,
  color: "#fff",
  boxShadow: glow(base, 0.3),
});
const btnClass = "px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5";

const SOURCE_FIELD_META = {
  livePenjual: { label: "Live Penjual", color: "#F43F5E" },
  liveAffiliate: { label: "Live Affiliate", color: "#FB923C" },
  video: { label: "Video", color: "#7C3AED" },
  videoAffiliate: { label: "Video Affiliate", color: "#A78BFA" },
  kartuProduk: { label: "Kartu Produk", color: "#06B6D4" },
};

const ACCOUNT_COLORS = ["#7C3AED", "#EC4899", "#F59E0B", "#10B981", "#06B6D4", "#F43F5E", "#6366F1", "#0EA5E9", "#84CC16", "#D946EF", "#F97316", "#14B8A6"];

// Generate id baru yang unik untuk akun tambahan (di luar 7 akun default tt1-tt6+shopee).
// Pola: tt7, tt8, ... untuk TikTok Shop tambahan; shopee2, shopee3, ... untuk Shopee tambahan.
function generateAccountId(platform, existingAccounts) {
  const prefix = platform === "shopee" ? "shopee" : "tt";
  let n = platform === "shopee" ? 2 : 1;
  const existingIds = new Set(existingAccounts.map((a) => a.id));
  if (platform === "shopee" && !existingIds.has("shopee")) return "shopee";
  while (existingIds.has(platform === "shopee" ? `${prefix}${n}` : `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

// Identitas visual khusus Live Tracker — sengaja beda dari brand utama (violet/fuchsia)
// supaya orang yang isi data langsung sadar ini bukan form Input Data GMV biasa.
const LIVE_ACCENT = "#E11D48"; // rose
const LIVE_ACCENT_DEEP = "#9F1239";
const LIVE_ACCENT_SOFT = "#FFE4E9";

// Gradient band untuk leaderboard ranking pencapaian toko — rank 1/2/3 dapat warna medali,
// sisanya cycle lewat palet vivid supaya tetap ramai & menyenangkan.
const RANK_GOLD = ["#F59E0B", "#FCD34D"];
const RANK_SILVER = ["#9CA3AF", "#E5E7EB"];
const RANK_BRONZE = ["#B45309", "#F59E0B"];
const RANK_BAND_CYCLE = [
  ["#7C3AED", "#A78BFA"],
  ["#06B6D4", "#67E8F9"],
  ["#10B981", "#6EE7B7"],
  ["#EC4899", "#F9A8D4"],
  ["#6366F1", "#A5B4FC"],
];
const rankBandColors = (idx) => (idx === 0 ? RANK_GOLD : idx === 1 ? RANK_SILVER : idx === 2 ? RANK_BRONZE : RANK_BAND_CYCLE[(idx - 3) % RANK_BAND_CYCLE.length]);

const DEFAULT_ACCOUNTS = [
  { id: "tt1", name: "TikTok Shop 1", platform: "tiktok" },
  { id: "tt2", name: "TikTok Shop 2", platform: "tiktok" },
  { id: "tt3", name: "TikTok Shop 3", platform: "tiktok" },
  { id: "tt4", name: "TikTok Shop 4", platform: "tiktok" },
  { id: "tt5", name: "TikTok Shop 5", platform: "tiktok" },
  { id: "tt6", name: "TikTok Shop 6", platform: "tiktok" },
  { id: "shopee", name: "Shopee", platform: "shopee" },
].map((a, i) => ({ ...a, color: ACCOUNT_COLORS[i] }));

// Hasil baca Google Sheets "EC PLAN" (tab Juni 2026, gid=332676377) pada 18 Jun 2026.
// tt1..tt6 = 6 akun TikTok Shop, shopee = akun Shopee ("Twie" di sheet asal).
const IMPORT_2026_06 = {
  names: { tt1: "Pretty", tt2: "Lovie", tt3: "Flowie", tt4: "Our", tt5: "Celline", tt6: "Kiwie", shopee: "Twie" },
  targets: { tt1: 500000000, tt2: 700000000, tt3: 500000000, tt4: 200000000, tt5: 400000000, tt6: 70000000, shopee: 100000000 },
  daily: {
    "2026-06-01": { tt1: 11374058, tt2: 22065091, tt3: 14877523, tt4: 3598827, tt5: 10117785, tt6: 2175274, shopee: 7705544 },
    "2026-06-02": { tt1: 9512638, tt2: 19517089, tt3: 9035426, tt4: 2791542, tt5: 7607660, tt6: 1084020, shopee: 6545369 },
    "2026-06-03": { tt1: 7678112, tt2: 19502423, tt3: 9408594, tt4: 1520239, tt5: 7062431, tt6: 1166749, shopee: 6067202 },
    "2026-06-04": { tt1: 5971051, tt2: 18321128, tt3: 12619179, tt4: 2601519, tt5: 6245876, tt6: 630816, shopee: 6084581 },
    "2026-06-05": { tt1: 13188526, tt2: 21754958, tt3: 13578734, tt4: 4150136, tt5: 12263500, tt6: 4919240, shopee: 4622511 },
    "2026-06-06": { tt1: 13211666, tt2: 59621571, tt3: 25139468, tt4: 3978161, tt5: 21371960, tt6: 5402189, shopee: 12651376 },
    "2026-06-07": { tt1: 13044173, tt2: 33517059, tt3: 30182118, tt4: 3829342, tt5: 14908208, tt6: 5937334, shopee: 13013858 },
    "2026-06-08": { tt1: 12443929, tt2: 28849970, tt3: 18597985, tt4: 3031505, tt5: 8768623, tt6: 2560191, shopee: 10255356 },
    "2026-06-09": { tt1: 11440601, tt2: 35770387, tt3: 12005047, tt4: 5326225, tt5: 14621443, tt6: 5053823, shopee: 11841282 },
    "2026-06-10": { tt1: 8344779, tt2: 33113803, tt3: 16902228, tt4: 3838187, tt5: 13257183, tt6: 4811729, shopee: 8266721 },
    "2026-06-11": { tt1: 17748826, tt2: 43941863, tt3: 20258880, tt4: 6880739, tt5: 21584958, tt6: 5755734, shopee: 5344514 },
    "2026-06-12": { tt1: 15340349, tt2: 58548514, tt3: 15422080, tt4: 7639422, tt5: 20602501, tt6: 3802853, shopee: 8697209 },
    "2026-06-13": { tt1: 15665258, tt2: 58154132, tt3: 14874175, tt4: 7440313, tt5: 18753147, tt6: 3911496, shopee: 6465976 },
    "2026-06-14": { tt1: 10230249, tt2: 60449285, tt3: 18200461, tt4: 7776771, tt5: 12944065, tt6: 1957030, shopee: 8994707 },
    "2026-06-15": { tt1: 11969933, tt2: 44419781, tt3: 14674843, tt4: 6588911, tt5: 8744790, tt6: 1177627, shopee: 6024938 },
    "2026-06-16": { tt1: 12854418, tt2: 57209482, tt3: 17082900, tt4: 9025612, tt5: 30391195, tt6: 1232985, shopee: 4895260 },
    "2026-06-17": { tt1: 8854434, tt2: 35026119, tt3: 17332300, tt4: 9068196, tt5: 17084616, tt6: 913305, shopee: 5744290 },
  },
};

// Breakdown sumber GMV — khusus akun TikTok Shop (sesuai kategori di TikTok Shop Compass)
const GMV_SOURCE_FIELDS = [
  ["video", "Video"],
  ["videoAffiliate", "Video Affiliate"],
  ["livePenjual", "Live Penjual"],
  ["liveAffiliate", "Live Affiliate"],
  ["kartuProduk", "Kartu Produk"],
];

// Breakdown sumber GMV — khusus akun Shopee (kategori beda dari TikTok Shop, makanya field
// terpisah dengan prefix "sp" supaya tidak bentrok nama dengan field TikTok di atas).
const SHOPEE_SOURCE_FIELDS = [
  ["spHalamanProduk", "GMV Halaman Produk"],
  ["spLivePenjual", "Live Penjual"],
  ["spVideoPenjual", "Video Penjual"],
  ["spAffiliate", "Affiliate"],
];
const SHOPEE_SOURCE_FIELD_META = {
  spHalamanProduk: { label: "GMV Halaman Produk", color: "#06B6D4" },
  spLivePenjual: { label: "Live Penjual", color: "#F43F5E" },
  spVideoPenjual: { label: "Video Penjual", color: "#7C3AED" },
  spAffiliate: { label: "Affiliate", color: "#F59E0B" },
};

// Helper: dapatkan daftar field breakdown sesuai platform akun (TikTok / Shopee)
const sourceFieldsFor = (platform) => (platform === "shopee" ? SHOPEE_SOURCE_FIELDS : GMV_SOURCE_FIELDS);
const sourceMetaFor = (platform) => (platform === "shopee" ? SHOPEE_SOURCE_FIELD_META : SOURCE_FIELD_META);

const FULL_SHOP_NAMES = {
  tt1: "Pretty Cosmetic",
  tt2: "Lovie Dovey",
  tt3: "Flowie Cosmetic",
  tt4: "Our Beauty Space",
  tt5: "Celline Cosmetic",
  tt6: "Kiwie Cosmetic",
  shopee: "Twie Beauty",
};

const STATUS_META = {
  "on-track": { label: "Sesuai Target", color: PALETTE.teal, bg: PALETTE.tealSoft },
  "at-risk": { label: "Perlu Dikejar", color: PALETTE.ochre, bg: PALETTE.ochreSoft },
  behind: { label: "Tertinggal", color: PALETTE.coral, bg: PALETTE.coralSoft },
  tercapai: { label: "Target Tercapai", color: PALETTE.teal, bg: PALETTE.tealSoft },
  "tidak-tercapai": { label: "Tidak Tercapai", color: PALETTE.coral, bg: PALETTE.coralSoft },
  "no-target": { label: "Target Belum Diset", color: PALETTE.inkFaint, bg: PALETTE.panelAlt },
  upcoming: { label: "Belum Dimulai", color: PALETTE.inkFaint, bg: PALETTE.panelAlt },
};

const SEVERITY_META = {
  critical: { color: PALETTE.coral, bg: PALETTE.coralSoft, icon: AlertTriangle, label: "Kritis" },
  warning: { color: PALETTE.ochre, bg: PALETTE.ochreSoft, icon: AlertTriangle, label: "Perhatian" },
  info: { color: PALETTE.inkSoft, bg: PALETTE.panelAlt, icon: Info, label: "Info" },
};

const CFG_KEY = "gmv-dashboard-config-v1";
const EXPORTED_YEARS_KEY = "gmv-dashboard-exported-years-v1";
// Toko yang HANYA dijadwalkan di Live Tracker — tidak ikut tracking GMV harian (Input Data,
// Target, Sumber GMV, Performa Iklan). Terpisah total dari DEFAULT_ACCOUNTS.
const LIVE_ONLY_ACCOUNTS_KEY = "gmv-dashboard-live-only-accounts-v1";
const DEFAULT_LIVE_ONLY_ACCOUNTS = [
  { id: "pompurin", name: "Pompurin", platform: "shopee", color: "#0EA5E9" },
  { id: "star", name: "Star", platform: "shopee", color: "#D946EF" },
];

// Konstanta fitur Jadwal Live
const SCHEDULE_HOSTS_KEY = "gmv-dashboard-schedule-hosts-v1";
const SCHEDULE_DATA_KEY  = "gmv-dashboard-schedule-data-v1"; // { [weekKey]: { slots, off } }
const HOST_NAMES_KEY = "gmv-dashboard-host-names-v1"; // daftar nama host bersama Live Tracker + Jadwal
const DEFAULT_HOST_NAMES = ["Ivonne","Fifi","Gita","Citra","Ana","Bella","Rena","Sherly","Winda"];
const SCHEDULE_ROOMS = ["Ruang 1A", "Ruang 1B", "Ruang 2", "Ruang 3"];
const SCHED_ACCENT = "#1D9E75"; // hijau — beda dari Live Tracker (rose) dan GMV brand (violet)
const SCHED_SOFT   = "#E1F5EE";
const SCHED_DEEP   = "#14532D";
// Helper jadwal (perlu scope top-level karena dipakai di useMemo & handler)
const getMonday = (d) => { const dt = new Date(d); const day = dt.getDay(); const diff = dt.getDate() - day + (day === 0 ? -6 : 1); return new Date(dt.setDate(diff)); };
const weekKey  = (d) => { const m = getMonday(d); return `${m.getFullYear()}-W${String(Math.ceil(((m - new Date(m.getFullYear(),0,1))/86400000+1)/7)).padStart(2,'0')}`; };
const SCHED_DAYS_SHORT = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
const SCHED_DAYS_FULL  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
// Catatan kebijakan: riwayat revisi TIDAK PERNAH dipangkas/dihapus otomatis.
// Data hanya terhapus lewat aksi manual eksplisit oleh Admin di tab Target & Akun.
// (entries/targets/revisions disimpan per-akun lewat storageAdapter.js, bukan blob tunggal —
// supaya security rules Firestore bisa menegakkan batasan akses per toko.)

const FIELD_LABELS = {
  gmv: "GMV Total", orders: "Orders", visitors: "Visitors", adSpend: "Ad Spend", adRevenue: "Ad Revenue",
  video: "Video", videoAffiliate: "Video Affiliate", livePenjual: "Live Penjual", liveAffiliate: "Live Affiliate", kartuProduk: "Kartu Produk",
  rating: "Rating Toko", followers: "Followers",
  spHalamanProduk: "GMV Halaman Produk", spLivePenjual: "Live Penjual (Shopee)", spVideoPenjual: "Video Penjual", spAffiliate: "Affiliate",
};
const MONEY_FIELDS = new Set(["gmv", "adSpend", "adRevenue", "video", "videoAffiliate", "livePenjual", "liveAffiliate", "kartuProduk", "spHalamanProduk", "spLivePenjual", "spVideoPenjual", "spAffiliate"]);
const RATING_FIELDS = new Set(["rating"]);
const fmtFieldVal = (field, v) => (v === undefined || v === null ? "—" : MONEY_FIELDS.has(field) ? fmtRp(v) : RATING_FIELDS.has(field) ? fmtRating(v) : fmtNum(v));

/* ============================================================
   HELPERS — tanggal & angka
   ============================================================ */
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const daysInMonthOf = (ymStr) => { const [y, m] = ymStr.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const monthLabel = (ymStr) => { const [y, m] = ymStr.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" }); };
const dayShortLabel = (dateStr) => new Date(dateStr).toLocaleDateString("id-ID", { weekday: "short" });

// Bangun grid kalender 1 bulan (array of weeks, tiap week array of 7 { date, inMonth }).
// Minggu dimulai Senin (sesuai konvensi lokal), termasuk tanggal "bleed" dari bulan
// sebelum/sesudahnya supaya grid selalu rapi kelipatan 7.
function buildCalendarWeeks(year, month) {
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Senin=0
  const daysInMonthCount = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) cells.push({ date: new Date(year, month - 1, prevMonthDays - i), inMonth: false });
  for (let d = 1; d <= daysInMonthCount; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
  let nextDay = 1;
  while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month + 1, nextDay++), inMonth: false });
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// "Hari ini" di seluruh dashboard ini = tanggal kalender asli dikurangi 1 hari, karena data GMV
// baru final/lengkap keesokan harinya. Semua referensi "Hari Ini" / "Kemarin" / "Minggu Lalu"
// memakai titik acuan ini supaya konsisten satu sama lain.
const effectiveToday = () => addDays(new Date(), -1);
const todayStr = () => ymd(effectiveToday());
const todayYM = () => ym(effectiveToday());
const todayLabelLong = () => effectiveToday().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

const fmtRp = (n) => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
const fmtCompactRp = (n) => {
  const v = n || 0; const av = Math.abs(v);
  if (av >= 1e9) return "Rp" + (v / 1e9).toFixed(2).replace(/\.00$/, "") + "M";
  if (av >= 1e6) return "Rp" + (v / 1e6).toFixed(1).replace(/\.0$/, "") + "jt";
  if (av >= 1e3) return "Rp" + (v / 1e3).toFixed(0) + "rb";
  return "Rp" + Math.round(v).toLocaleString("id-ID");
};
const parseNum = (str) => { const d = String(str ?? "").replace(/[^0-9]/g, ""); return d ? parseInt(d, 10) : 0; };
const parseDecimal = (str) => { const cleaned = String(str ?? "").replace(",", ".").replace(/[^0-9.]/g, ""); const v = parseFloat(cleaned); return isNaN(v) ? 0 : v; };
const fmtNum = (n) => Math.round(n || 0).toLocaleString("id-ID");
const fmtRating = (n) => (n === undefined || n === null ? "" : Number(n).toFixed(1).replace(".", ","));
const isTwinDate = (dateStr) => { const d = new Date(dateStr); return d.getDate() === d.getMonth() + 1 && d.getDate() <= 12; };
const isPaydayWindow = (dateStr) => { const day = new Date(dateStr).getDate(); return day >= 25 || day <= 5; };

function genMonthOptions(entries, targets, liveSessions) {
  const now = new Date(); const opts = new Set();
  for (let off = 1; off >= -36; off--) opts.add(ym(new Date(now.getFullYear(), now.getMonth() + off, 1)));
  // Pastikan bulan mana pun yang sudah punya data tetap bisa dipilih, walau lebih lama dari 36 bulan.
  Object.keys(entries || {}).forEach((d) => opts.add(d.slice(0, 7)));
  Object.keys(targets || {}).forEach((m) => opts.add(m));
  (liveSessions || []).forEach((s) => { if (s.date) opts.add(s.date.slice(0, 7)); });
  return Array.from(opts).sort().reverse();
}

function sumField(entries, dates, accId, field) {
  return dates.reduce((s, d) => s + (entries?.[d]?.[accId]?.[field] || 0), 0);
}
function countDaysWithGmv(entries, dates, accId) {
  return dates.filter((d) => entries?.[d]?.[accId]?.gmv !== undefined).length;
}

/* ============================================================
   STORAGE
   ============================================================ */
async function safeGet(key, fallback) {
  try {
    if (!window.storage) return fallback;
    const res = await window.storage.get(key, true);
    return res ? JSON.parse(res.value) : fallback;
  } catch (e) { return fallback; }
}
async function safeSet(key, value) {
  try {
    if (!window.storage) return false;
    const res = await window.storage.set(key, JSON.stringify(value), true);
    return !!res;
  } catch (e) { return false; }
}

/* ============================================================
   SMALL UI PIECES
   ============================================================ */
function Dial({ percent, size = 116, stroke = 10, color, label, valueOverride }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = percent == null ? 0 : percent;
  const clamped = Math.max(0, Math.min(p, 100));
  const offset = c * (1 - clamped / 100);
  const overflow = p > 100;
  const dialColor = overflow ? PALETTE.teal : (color || PALETTE.teal);
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      {/* glow ambient — signature element halaman ini */}
      <div className="absolute rounded-full" style={{
        width: size * 0.92, height: size * 0.92,
        background: `radial-gradient(circle, ${dialColor}33 0%, transparent 72%)`,
        filter: "blur(6px)",
      }} />
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "relative" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={PALETTE.line} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dialColor} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 6px ${dialColor}66)` }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: PALETTE.ink }} className="text-2xl font-semibold leading-none">
          {valueOverride ?? `${Math.round(p)}%`}
        </span>
        {label && <span className="text-[10px] uppercase tracking-wide mt-1.5 text-center px-2" style={{ color: PALETTE.inkSoft }}>{label}</span>}
      </div>
    </div>
  );
}

function DeltaBadge({ value, size = "text-xs" }) {
  if (value === null || value === undefined || !isFinite(value)) {
    return <span className={`${size}`} style={{ color: PALETTE.inkFaint }}>—</span>;
  }
  const flat = Math.abs(value) < 0.5;
  const up = value > 0;
  const color = flat ? PALETTE.inkSoft : up ? PALETTE.teal : PALETTE.coral;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${size}`} style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>
      <Icon size={12} strokeWidth={3} />{Math.abs(value).toFixed(1)}%
    </span>
  );
}

// Badge untuk selisih dalam POIN persentase (mis. pencapaian hari ini vs kemarin, keduanya sudah dalam %)
// — beda dari DeltaBadge yang menghitung persen perubahan dari nilai mentah.
function PointDeltaBadge({ value, size = "text-xs" }) {
  if (value === null || value === undefined || !isFinite(value)) {
    return <span className={`${size}`} style={{ color: PALETTE.inkFaint }}>—</span>;
  }
  const flat = Math.abs(value) < 0.05;
  const up = value > 0;
  const color = flat ? PALETTE.inkSoft : up ? PALETTE.teal : PALETTE.coral;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${size}`} style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>
      <Icon size={12} strokeWidth={3} />{Math.abs(value).toFixed(1)} poin
    </span>
  );
}

// Badge selisih bertanda untuk metrik "snapshot" (Rating, Followers) — beda dari DeltaBadge/
// PointDeltaBadge karena nilainya ditampilkan apa adanya (bukan %), dengan jumlah desimal custom.
function SignedDeltaBadge({ value, decimals = 0, size = "text-xs" }) {
  if (value === null || value === undefined || !isFinite(value)) {
    return <span className={`${size}`} style={{ color: PALETTE.inkFaint }}>—</span>;
  }
  const threshold = decimals > 0 ? 0.05 : 0.5;
  const flat = Math.abs(value) < threshold;
  const up = value > 0;
  const color = flat ? PALETTE.inkSoft : up ? PALETTE.teal : PALETTE.coral;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${size}`} style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>
      <Icon size={12} strokeWidth={3} />{up ? "+" : ""}{decimals > 0 ? value.toFixed(decimals).replace(".", ",") : value.toFixed(decimals)}
    </span>
  );
}

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META["no-target"];
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap" style={{ color: m.color, background: m.bg, boxShadow: `0 2px 8px -2px ${m.color}40` }}>
      {m.label}
    </span>
  );
}

// Popover kalender dual-month dengan pilih-rentang via klik langsung (klik tanggal mulai,
// lalu klik tanggal akhir) — dipakai bersama di toggle Custom dashboard utama dan filter
// laporan Live Tracker, supaya UX-nya konsisten di kedua tempat.
function DateRangePicker({ startDate, endDate, onApply, accentColor }) {
  const accent = accentColor || PALETTE.brand;
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [pickingEnd, setPickingEnd] = useState(false);
  const [baseMonth, setBaseMonth] = useState(() => { const d = new Date(startDate); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => { if (popRef.current && !popRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const openPicker = () => {
    setDraftStart(startDate); setDraftEnd(endDate); setPickingEnd(false);
    const d = new Date(startDate); setBaseMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setOpen(true);
  };

  const handleDayClick = (dateStr) => {
    if (!pickingEnd) {
      setDraftStart(dateStr); setDraftEnd(dateStr); setPickingEnd(true);
    } else {
      if (dateStr < draftStart) { setDraftEnd(draftStart); setDraftStart(dateStr); }
      else { setDraftEnd(dateStr); }
      setPickingEnd(false);
    }
  };

  const applyPreset = (backStart, backEnd) => {
    const end = ymd(addDays(effectiveToday(), -backEnd));
    const start = ymd(addDays(effectiveToday(), -backStart));
    setDraftStart(start); setDraftEnd(end); setPickingEnd(false);
    const d = new Date(start); setBaseMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const confirm = () => {
    const s = draftStart <= draftEnd ? draftStart : draftEnd;
    const e = draftStart <= draftEnd ? draftEnd : draftStart;
    onApply(s, e);
    setOpen(false);
  };

  const renderMonth = (monthDate) => {
    const weeks = buildCalendarWeeks(monthDate.getFullYear(), monthDate.getMonth());
    const lo = draftStart <= draftEnd ? draftStart : draftEnd;
    const hi = draftStart <= draftEnd ? draftEnd : draftStart;
    return (
      <div className="flex-1 min-w-[230px]">
        <div className="text-center text-xs font-bold mb-2" style={{ color: PALETTE.ink, fontFamily: "'JetBrains Mono', monospace" }}>
          {pad(monthDate.getMonth() + 1)}/{monthDate.getFullYear()}
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
            <div key={d} className="text-[10px] text-center font-semibold py-1" style={{ color: PALETTE.inkSoft }}>{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">
            {week.map((cell, ci) => {
              const ds = ymd(cell.date);
              const isStart = ds === lo, isEnd = ds === hi;
              const inRange = ds > lo && ds < hi;
              const isToday = ds === todayStr();
              return (
                <button key={ci} disabled={!cell.inMonth} onClick={() => handleDayClick(ds)}
                  className="text-xs h-7 rounded-md transition-all"
                  style={{
                    color: !cell.inMonth ? PALETTE.inkFaint : (isStart || isEnd) ? "#fff" : PALETTE.ink,
                    background: (isStart || isEnd) ? accent : inRange ? `${accent}22` : "transparent",
                    fontWeight: isStart || isEnd ? 700 : 400,
                    cursor: cell.inMonth ? "pointer" : "default",
                    boxShadow: isToday && !isStart && !isEnd ? `inset 0 0 0 1px ${accent}` : "none",
                  }}>
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <button onClick={openPicker}
        className="text-sm px-3 py-1.5 rounded-lg border outline-none flex items-center gap-1.5" style={{ borderColor: PALETTE.line, background: PALETTE.panel, boxShadow: cardShadow }}>
        <Calendar size={14} style={{ color: accent }} />
        {startDate === endDate
          ? new Date(startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
          : `${new Date(startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} \u2013 ${new Date(endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`}
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3" style={{ background: "rgba(28,21,35,0.45)" }}>
          <div ref={popRef} className="rounded-xl p-4 w-full overflow-y-auto" style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.line}`, boxShadow: cardShadowHover, maxWidth: 520, maxHeight: "88vh" }}>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[["Hari Ini", 0, 0], ["Kemarin", 1, 1], ["7 Hari", 6, 0], ["30 Hari", 29, 0]].map(([label, bs, be]) => (
                <button key={label} onClick={() => applyPreset(bs, be)}
                  className="text-[11px] px-2.5 py-1 rounded-full font-medium" style={{ background: PALETTE.panelAlt, color: PALETTE.inkSoft }}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-1">
                <button onClick={() => setBaseMonth(new Date(baseMonth.getFullYear() - 1, baseMonth.getMonth(), 1))} className="p-1 rounded hover:opacity-70" style={{ color: PALETTE.inkSoft }}><ChevronsLeft size={16} /></button>
                <button onClick={() => setBaseMonth(new Date(baseMonth.getFullYear(), baseMonth.getMonth() - 1, 1))} className="p-1 rounded hover:opacity-70" style={{ color: PALETTE.inkSoft }}><ChevronLeft size={16} /></button>
              </div>
              <span className="text-[11px]" style={{ color: PALETTE.inkFaint }}>{pickingEnd ? "Klik tanggal akhir…" : "Klik tanggal mulai…"}</span>
              <div className="flex gap-1">
                <button onClick={() => setBaseMonth(new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1))} className="p-1 rounded hover:opacity-70" style={{ color: PALETTE.inkSoft }}><ChevronRight size={16} /></button>
                <button onClick={() => setBaseMonth(new Date(baseMonth.getFullYear() + 1, baseMonth.getMonth(), 1))} className="p-1 rounded hover:opacity-70" style={{ color: PALETTE.inkSoft }}><ChevronsRight size={16} /></button>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap sm:flex-nowrap">
              {renderMonth(baseMonth)}
              {renderMonth(new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 flex-wrap gap-2" style={{ borderTop: `1px solid ${PALETTE.line}` }}>
              <span className="text-xs" style={{ color: PALETTE.inkSoft, fontFamily: "'JetBrains Mono', monospace" }}>
                {draftStart} {draftStart !== draftEnd ? `\u2013 ${draftEnd}` : ""}
              </span>
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: PALETTE.inkSoft }}>Batal</button>
                <button onClick={confirm} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: accent, color: "#fff" }}>Terapkan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlatformTag({ platform }) {
  const isShopee = platform === "shopee";
  const Icon = isShopee ? ShoppingBag : Music2;
  const color = isShopee ? PALETTE.coral : PALETTE.plum;
  const bg = isShopee ? PALETTE.coralSoft : PALETTE.plumSoft;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide" style={{ color, background: bg }}>
      <Icon size={10} />{isShopee ? "Shopee" : "TikTok Shop"}
    </span>
  );
}

// Donut chart 5 kanal sumber GMV (Video, Video Affiliate, Live Penjual, Live Affiliate, Kartu Produk)
// dengan total ditampilkan di tengah. Dipakai di tab "Sumber GMV", per akun maupun gabungan.
function SourceDonut({ sums, size = 168, centerLabel = "Total", fields = GMV_SOURCE_FIELDS, meta = SOURCE_FIELD_META }) {
  const data = fields
    .map(([f]) => ({ key: f, name: meta[f].label, value: sums[f] || 0, color: meta[f].color }))
    .filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center rounded-full" style={{ width: size, height: size, border: `2px dashed ${PALETTE.line}` }}>
        <span className="text-[11px] text-center px-4" style={{ color: PALETTE.inkFaint }}>Belum ada data breakdown</span>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={size * 0.31} outerRadius={size * 0.49} paddingAngle={2} stroke="none" strokeLinejoin="round">
            {data.map((d) => <Cell key={d.key} fill={d.color} />)}
          </Pie>
          <Tooltip
            formatter={(v, n) => [`${fmtRp(v)} (${((v / total) * 100).toFixed(1)}%)`, n]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${PALETTE.line}`, boxShadow: cardShadowHover }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: PALETTE.ink }}>{fmtCompactRp(total)}</span>
        <span className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: PALETTE.inkSoft }}>{centerLabel}</span>
      </div>
    </div>
  );
}

function Card({ children, className = "", accent }) {
  return (
    <div
      className={`relative rounded-xl p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 ${className}`}
      style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.line}`, boxShadow: cardShadow }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = cardShadowHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = cardShadow; }}
    >
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />
      )}
      {children}
    </div>
  );
}

function SectionTitle({ eyebrow, title, right }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-2 mb-3">
      <div>
        {eyebrow && <div className="text-[10px] uppercase tracking-[0.16em] font-medium mb-0.5" style={{ color: PALETTE.brand }}>{eyebrow}</div>}
        <h2 className="text-base font-semibold" style={{ fontFamily: "'Sora', sans-serif", color: PALETTE.ink }}>{title}</h2>
      </div>
      {right}
    </div>
  );
}

/* ============================================================
   INSIGHT ENGINE — analisis area yang perlu ditingkatkan
   ============================================================ */
function computeTrendFlags(accounts, entries, benchmarks) {
  const allDates = Object.keys(entries).sort();
  const anchor = allDates.length ? new Date(allDates[allDates.length - 1]) : effectiveToday();
  const last7 = Array.from({ length: 7 }, (_, i) => ymd(addDays(anchor, -i)));
  const prev7 = Array.from({ length: 7 }, (_, i) => ymd(addDays(anchor, -(i + 7))));
  const flags = [];

  accounts.forEach((acc) => {
    const daysWithData = countDaysWithGmv(entries, last7, acc.id);
    if (daysWithData === 0) {
      flags.push({ severity: "info", category: "Data", accountName: acc.name, message: `${acc.name}: belum ada input GMV dalam 7 hari terakhir.` });
      return;
    }
    if (daysWithData < 5) {
      flags.push({ severity: "info", category: "Data", accountName: acc.name, message: `${acc.name}: data baru terisi ${daysWithData}/7 hari pada periode terakhir — insight di bawah belum tentu representatif.` });
    }

    const gmvLastSum = sumField(entries, last7, acc.id, "gmv");
    const gmvPrevSum = sumField(entries, prev7, acc.id, "gmv");
    const ordLastSum = sumField(entries, last7, acc.id, "orders");
    const ordPrevSum = sumField(entries, prev7, acc.id, "orders");
    const visLastSum = sumField(entries, last7, acc.id, "visitors");
    const visPrevSum = sumField(entries, prev7, acc.id, "visitors");
    const adSpendLastSum = sumField(entries, last7, acc.id, "adSpend");
    const adRevLastSum = sumField(entries, last7, acc.id, "adRevenue");
    const adSpendPrevSum = sumField(entries, prev7, acc.id, "adSpend");
    const adRevPrevSum = sumField(entries, prev7, acc.id, "adRevenue");

    const pctChange = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    const dGmv = pctChange(gmvLastSum, gmvPrevSum);
    const dVis = pctChange(visLastSum, visPrevSum);

    const crLast = visLastSum > 0 ? (ordLastSum / visLastSum) * 100 : null;
    const crPrev = visPrevSum > 0 ? (ordPrevSum / visPrevSum) * 100 : null;
    const dCr = crPrev > 0 ? ((crLast - crPrev) / crPrev) * 100 : null;

    const aovLast = ordLastSum > 0 ? gmvLastSum / ordLastSum : null;
    const aovPrev = ordPrevSum > 0 ? gmvPrevSum / ordPrevSum : null;
    const dAov = aovPrev > 0 ? ((aovLast - aovPrev) / aovPrev) * 100 : null;

    const roasLast = adSpendLastSum > 0 ? adRevLastSum / adSpendLastSum : null;
    const roasPrev = adSpendPrevSum > 0 ? adRevPrevSum / adSpendPrevSum : null;
    const dRoas = roasPrev > 0 ? ((roasLast - roasPrev) / roasPrev) * 100 : null;

    if (dGmv !== null && dGmv <= -10) {
      let cause = "Penyebab belum jelas dari data yang ada — cek manual (stok habis? listing turun? kompetitor promo?).";
      if (dVis !== null && dVis <= -8) cause = `Traffic turun ${Math.abs(dVis).toFixed(0)}% — evaluasi exposure organik, konten, atau alokasi ads.`;
      else if (dCr !== null && dCr <= -8) cause = `Conversion Rate turun ${Math.abs(dCr).toFixed(0)}% meski traffic relatif stabil — cek listing, harga, stok, atau response time CS.`;
      else if (dAov !== null && dAov <= -8) cause = `AOV turun ${Math.abs(dAov).toFixed(0)}% — pertimbangkan bundling atau upsell untuk menaikkan nilai per order.`;
      flags.push({ severity: "warning", category: "GMV", accountName: acc.name, message: `${acc.name}: GMV turun ${Math.abs(dGmv).toFixed(0)}% (7 hari terakhir vs 7 hari sebelumnya). ${cause}` });
    }

    if (roasLast !== null && roasLast < 1) {
      flags.push({ severity: "critical", category: "Ads", accountName: acc.name, message: `${acc.name}: ROAS ${roasLast.toFixed(2)} — biaya iklan lebih besar dari revenue yang dihasilkan ads, evaluasi segera.` });
    } else if (benchmarks.targetROAS > 0 && roasLast !== null && roasLast < benchmarks.targetROAS) {
      flags.push({ severity: "warning", category: "Ads", accountName: acc.name, message: `${acc.name}: ROAS ${roasLast.toFixed(2)} masih di bawah target minimum ${benchmarks.targetROAS}.` });
    } else if (dRoas !== null && dRoas <= -15 && roasLast !== null) {
      flags.push({ severity: "warning", category: "Ads", accountName: acc.name, message: `${acc.name}: ROAS turun ${Math.abs(dRoas).toFixed(0)}% dibanding periode sebelumnya (${roasPrev.toFixed(2)} → ${roasLast.toFixed(2)}) — cek targeting/creative.` });
    }

    if (benchmarks.targetCR > 0 && crLast !== null && crLast < benchmarks.targetCR) {
      flags.push({ severity: "warning", category: "Konversi", accountName: acc.name, message: `${acc.name}: Conversion Rate ${crLast.toFixed(2)}% di bawah target minimum ${benchmarks.targetCR}%.` });
    }
  });

  return flags;
}

function computePaceFlags(accounts, targets, entries) {
  const curYM = todayYM();
  const dim = daysInMonthOf(curYM);
  const elapsed = effectiveToday().getDate();
  const remaining = dim - elapsed;
  const dates = Array.from({ length: elapsed }, (_, i) => `${curYM}-${pad(i + 1)}`);
  const flags = [];

  accounts.forEach((acc) => {
    const target = targets?.[curYM]?.[acc.id] || 0;
    if (!target) return;
    const mtd = sumField(entries, dates, acc.id, "gmv");
    const pace = elapsed > 0 ? mtd / elapsed : 0;
    const projected = pace * dim;
    if (remaining === 0) {
      if (mtd < target) flags.push({ severity: "critical", category: "Pace", accountName: acc.name, message: `${acc.name}: bulan ditutup di ${fmtCompactRp(mtd)}, di bawah target ${fmtCompactRp(target)}.` });
    } else {
      const ratio = projected / target;
      if (ratio < 0.85) {
        const needed = (target - mtd) / remaining;
        flags.push({ severity: "critical", category: "Pace", accountName: acc.name, message: `${acc.name}: proyeksi akhir bulan ${fmtCompactRp(projected)} (~${Math.round(ratio * 100)}% dari target). Perlu rata-rata ${fmtCompactRp(needed)}/hari di ${remaining} hari sisa — saat ini rata-rata baru ${fmtCompactRp(pace)}/hari.` });
      } else if (ratio < 1) {
        flags.push({ severity: "warning", category: "Pace", accountName: acc.name, message: `${acc.name}: sedikit di bawah pace target (proyeksi ~${Math.round(ratio * 100)}%), masih bisa dikejar di ${remaining} hari sisa.` });
      }
    }
  });
  return flags;
}

const SEV_ORDER = { critical: 0, warning: 1, info: 2 };
function combineInsights(accounts, targets, entries, benchmarks) {
  const flags = [...computePaceFlags(accounts, targets, entries), ...computeTrendFlags(accounts, entries, benchmarks)];
  return flags.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}

function diffRow(before, after) {
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  return keys
    .filter((k) => (before?.[k] ?? undefined) !== (after?.[k] ?? undefined))
    .map((k) => ({ field: k, label: FIELD_LABELS[k] || k, oldVal: before?.[k] ?? null, newVal: after?.[k] ?? null }));
}

/* ============================================================
   PASTE PARSER
   ============================================================ */
function parseDateFlexible(s) {
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}
function matchAccount(input, accounts) {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  const n = norm(input);
  return accounts.find((a) => norm(a.name) === n) || accounts.find((a) => norm(a.id) === n)
    || accounts.find((a) => norm(a.name).includes(n) || n.includes(norm(a.name)));
}

// Hitung durasi live (jam, desimal) dari jam mulai & selesai berformat "HH:MM".
// Menangani kasus live yang lewat tengah malam (misal mulai 23:30, selesai 01:00 ->
// dianggap selesai di hari berikutnya, bukan durasi negatif).
function calcLiveHours(startTime, endTime) {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((v) => isNaN(v))) return null;
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // lewat tengah malam
  return mins / 60;
}
const fmtHours = (h) => (h === null || h === undefined ? "—" : `${Math.floor(h)}j ${Math.round((h % 1) * 60)}m`);

function parsePasteData(text, accounts) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    const cols = (line.includes("\t") ? line.split("\t") : line.split(",")).map((c) => c.trim());
    if (cols.length < 3) return { raw: line, ok: false, error: "Kolom kurang dari 3 — minimal: Tanggal, Akun, GMV" };
    const [
      dateRaw, accRaw, gmvRaw, ordersRaw, visitorsRaw, adSpendRaw, adRevenueRaw,
      videoRaw, videoAffRaw, livePenjualRaw, liveAffRaw, kartuProdukRaw, ratingRaw, followersRaw,
      spHalamanProdukRaw, spLivePenjualRaw, spVideoPenjualRaw, spAffiliateRaw,
    ] = cols;
    const date = parseDateFlexible(dateRaw);
    if (!date) return { raw: line, ok: false, error: `Tanggal tidak terbaca: "${dateRaw}"` };
    const acc = matchAccount(accRaw, accounts);
    if (!acc) return { raw: line, ok: false, error: `Akun tidak cocok: "${accRaw}"` };

    const breakdownRaw = acc.platform === "shopee"
      ? { spHalamanProduk: spHalamanProdukRaw, spLivePenjual: spLivePenjualRaw, spVideoPenjual: spVideoPenjualRaw, spAffiliate: spAffiliateRaw }
      : { video: videoRaw, videoAffiliate: videoAffRaw, livePenjual: livePenjualRaw, liveAffiliate: liveAffRaw, kartuProduk: kartuProdukRaw };
    const fields = sourceFieldsFor(acc.platform);
    const hasBreakdown = Object.values(breakdownRaw).some((v) => v);
    const breakdown = {};
    let gmv;
    if (hasBreakdown) {
      fields.forEach(([f]) => { if (breakdownRaw[f]) breakdown[f] = parseNum(breakdownRaw[f]); });
      gmv = fields.reduce((s, [f]) => s + (breakdown[f] || 0), 0);
    } else if (gmvRaw) {
      gmv = parseNum(gmvRaw);
    } else {
      return { raw: line, ok: false, error: "GMV (atau breakdown sumber) wajib diisi minimal satu" };
    }

    return {
      raw: line, ok: true, date, accountId: acc.id, accountName: acc.name,
      gmv, ...breakdown,
      orders: ordersRaw ? parseNum(ordersRaw) : undefined,
      visitors: visitorsRaw ? parseNum(visitorsRaw) : undefined,
      adSpend: adSpendRaw ? parseNum(adSpendRaw) : undefined,
      adRevenue: adRevenueRaw ? parseNum(adRevenueRaw) : undefined,
      rating: ratingRaw ? parseDecimal(ratingRaw) : undefined,
      followers: followersRaw ? parseNum(followersRaw) : undefined,
    };
  });
}

/* ============================================================
   MAIN APP
   ============================================================ */
export default function GMVDashboard({ myAccountId = "admin" }) {
  const isAdmin = myAccountId === "admin";
  const [loading, setLoading] = useState(true);
  const [storageOk, setStorageOk] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("overview");
  const [selectedMonth, setSelectedMonth] = useState(todayYM());
  const [periodMode, setPeriodMode] = useState("month"); // "month" | "day" | "custom"
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [customStartDate, setCustomStartDate] = useState(todayStr());
  const [customEndDate, setCustomEndDate] = useState(todayStr());

  // viewDates: daftar tanggal yang dipakai oleh SEMUA useMemo (overview, sourceBreakdown, dll).
  // Mode "month"  = semua hari di selectedMonth.
  // Mode "day"    = cuma satu tanggal (selectedDate).
  // Mode "custom" = semua tanggal dari customStartDate s/d customEndDate (inklusif, urutan dibalik kalau end < start).

  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);
  const [benchmarks, setBenchmarks] = useState({ targetROAS: 0, targetCR: 0 });
  const [targets, setTargets] = useState({});
  const [adBudgets, setAdBudgets] = useState({}); // { [ym]: { [accId]: budgetPerHari } }
  const [entries, setEntries] = useState({});
  const [revisions, setRevisions] = useState([]);
  const [showAllRevisions, setShowAllRevisions] = useState(false);
  const [exportedYears, setExportedYears] = useState({});
  const [recapYear, setRecapYear] = useState(String(new Date().getFullYear()));

  // ---- Live Tracker: state terpisah total dari Input Data GMV (sengaja tidak digabung) ----
  const [liveSessions, setLiveSessions] = useState([]);
  // Toko yang HANYA perlu dijadwalkan live-nya, tidak ikut tracking GMV harian sama sekali —
  // makanya disimpan terpisah dari `accounts` (yang dipakai Input Data/Target/Sumber GMV/Iklan).
  const [liveOnlyAccounts, setLiveOnlyAccounts] = useState([]);
  const [newLiveAccountName, setNewLiveAccountName] = useState("");
  const [newLiveAccountPlatform, setNewLiveAccountPlatform] = useState("shopee");
  const [liveDraft, setLiveDraft] = useState({ accountId: "", date: todayStr(), hostName: "", startTime: "", endTime: "", orders: "", directGmv: "", totalViewers: "", co: "", ctr: "", gpm: "" });
  const [liveFilterMonth, setLiveFilterMonth] = useState(todayYM());
  const [liveFilterMode, setLiveFilterMode] = useState("month"); // "month" | "custom"
  const [liveFilterStart, setLiveFilterStart] = useState(todayStr());
  const [liveFilterEnd, setLiveFilterEnd] = useState(todayStr());
  const [liveFilterAccount, setLiveFilterAccount] = useState("all");
  const [liveFilterHost, setLiveFilterHost] = useState("all");

  // ---- Jadwal Live ----
  const [schedHosts, setSchedHosts] = useState([]); // [{id,name,color,bg,sessions:[2,2]}]
  const [hostNames, setHostNames] = useState(DEFAULT_HOST_NAMES); // daftar nama bersama Live Tracker & Jadwal
  const [newHostNameInput, setNewHostNameInput] = useState("");
  const [schedData, setSchedData] = useState({}); // { [weekKey]: { slots:{date:{room:{hostId,toko,starts[]}}}, off:{date:[hostId]} } }
  const [schedWeekStart, setSchedWeekStart] = useState(() => getMonday(new Date()));
  const [schedMode, setSchedMode] = useState("view"); // "view"|"edit"
  const [schedEditCtx, setSchedEditCtx] = useState(null); // {date,room}
  const [schedSesiStarts, setSchedSesiStarts] = useState([]);
  const [schedNewName, setSchedNewName] = useState("");
  const [schedNewSessions, setSchedNewSessions] = useState("2,2");
  const [schedNewColor, setSchedNewColor] = useState("#1D9E75");
  const [showSchedSidebar, setShowSchedSidebar] = useState(false);
  const [schedRecapView, setSchedRecapView] = useState(false); // toggle rekap minggu
  const [liveSavedFlash, setLiveSavedFlash] = useState(false);

  const [hiddenAccounts, setHiddenAccounts] = useState(new Set());
  const [inputMode, setInputMode] = useState("form");
  const [inputDate, setInputDate] = useState(todayStr());
  const [draft, setDraft] = useState({});
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [pasteText, setPasteText] = useState("");
  const [pastePreview, setPastePreview] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

  const [targetDraft, setTargetDraft] = useState({});
  const [adBudgetDraft, setAdBudgetDraft] = useState({});
  const [accountDraft, setAccountDraft] = useState(DEFAULT_ACCOUNTS);
  const [benchmarkDraft, setBenchmarkDraft] = useState({ targetROAS: 0, targetCR: 0 });

  // ---- load on mount ----
  useEffect(() => {
    (async () => {
      const ok = typeof window !== "undefined" && !!window.storage;
      setStorageOk(ok);
      const [cfg, expYears, savedAdBudgets, savedLiveOnlyAccounts, savedSchedHosts, savedSchedData, savedHostNames] = await Promise.all([
        safeGet(CFG_KEY, null),
        safeGet(EXPORTED_YEARS_KEY, {}),
        safeGet("gmv-dashboard-adbudgets-v1", {}),
        safeGet(LIVE_ONLY_ACCOUNTS_KEY, null),
        safeGet(SCHEDULE_HOSTS_KEY, []),
        safeGet(SCHEDULE_DATA_KEY, {}),
        safeGet(HOST_NAMES_KEY, null),
      ]);
      const finalCfg = cfg || { accounts: DEFAULT_ACCOUNTS, benchmarks: { targetROAS: 0, targetCR: 0 } };
      setAccounts(finalCfg.accounts);
      setBenchmarks(finalCfg.benchmarks);
      setAccountDraft(finalCfg.accounts);
      setBenchmarkDraft(finalCfg.benchmarks);
      setExportedYears(expYears);
      setAdBudgets(savedAdBudgets);
      if (!cfg && ok) await safeSet(CFG_KEY, finalCfg);

      const finalLiveOnly = savedLiveOnlyAccounts || DEFAULT_LIVE_ONLY_ACCOUNTS;
      setLiveOnlyAccounts(finalLiveOnly);
      if (!savedLiveOnlyAccounts && ok) await safeSet(LIVE_ONLY_ACCOUNTS_KEY, finalLiveOnly);

      setSchedHosts(savedSchedHosts || []);
      setSchedData(savedSchedData || {});
      const finalHostNames = savedHostNames || DEFAULT_HOST_NAMES;
      setHostNames(finalHostNames);
      if (!savedHostNames && ok) await safeSet(HOST_NAMES_KEY, finalHostNames);

      const accountIds = finalCfg.accounts.map((a) => a.id);
      const liveAccountIds = [...accountIds, ...finalLiveOnly.map((a) => a.id)];
      try {
        const [ent, tgt, rev, live] = await Promise.all([
          fetchAllEntries(accountIds),
          fetchAllTargets(accountIds),
          fetchAllRevisions(),
          fetchAllLiveSessions(liveAccountIds),
        ]);
        setEntries(ent);
        setTargets(tgt);
        setRevisions(rev);
        setLiveSessions(live);
      } catch (e) {
        console.error("Gagal memuat data per-akun:", e);
      }
      setLoading(false);
    })();
  }, []);

  // ---- sync drafts when month or data changes ----
  useEffect(() => {
    setTargetDraft(targets[selectedMonth] || {});
    setAdBudgetDraft(adBudgets[selectedMonth] || {});
  }, [selectedMonth, targets, adBudgets]);
  useEffect(() => { setDraft(entries[inputDate] ? { ...entries[inputDate] } : {}); }, [inputDate, entries]);
  useEffect(() => { setLiveFilterHost("all"); }, [liveFilterAccount, liveFilterMonth, liveFilterMode, liveFilterStart, liveFilterEnd]);

  const persist = useCallback(async (key, value, setter) => {
    setSaving(true);
    await safeSet(key, value);
    setSaving(false);
  }, []);

  const toastTimerRef = useRef(null);
  const showToast = useCallback((type, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), type === "error" ? 6000 : 3000);
  }, []);

  /* ---------- derived: overview ---------- */
  const monthMeta = useMemo(() => {
    const dim = daysInMonthOf(selectedMonth);
    const isCurrent = selectedMonth === todayYM();
    const isPast = selectedMonth < todayYM();
    const elapsed = isCurrent ? effectiveToday().getDate() : isPast ? dim : 0;
    const remaining = Math.max(dim - elapsed, 0);
    return { dim, isCurrent, isPast, elapsed, remaining };
  }, [selectedMonth]);

  const monthDates = useMemo(
    () => Array.from({ length: monthMeta.elapsed }, (_, i) => `${selectedMonth}-${pad(i + 1)}`),
    [selectedMonth, monthMeta.elapsed]
  );

  // viewDates = tanggal-tanggal yang dipakai oleh overview/sourceBreakdown/adPerformance.
  // Ini satu-satunya hal yang berubah antara mode bulan vs hari — useMemo lain tidak perlu diubah.
  const viewDates = useMemo(() => {
    if (periodMode === "day") return [selectedDate];
    if (periodMode === "custom") {
      let start = customStartDate, end = customEndDate;
      if (start > end) { const t = start; start = end; end = t; } // tukar kalau kebalik
      const dates = [];
      let cur = new Date(start);
      const endD = new Date(end);
      while (cur <= endD) { dates.push(ymd(cur)); cur = addDays(cur, 1); }
      return dates;
    }
    return monthDates;
  }, [periodMode, selectedDate, customStartDate, customEndDate, monthDates]);

  // selectedMonth ikut berubah kalau mode hari (supaya bulan yang ditampilkan tetap sesuai)
  const effectiveMonth = periodMode === "day" ? selectedDate.slice(0, 7) : selectedMonth;
  const periodLabel = periodMode === "day"
    ? new Date(selectedDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : periodMode === "custom"
    ? (() => {
        const fmt = (d) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
        const start = customStartDate <= customEndDate ? customStartDate : customEndDate;
        const end = customStartDate <= customEndDate ? customEndDate : customStartDate;
        return start === end ? fmt(start) : `${fmt(start)} \u2013 ${fmt(end)}`;
      })()
    : monthLabel(selectedMonth);

  const overview = useMemo(() => {
    const { dim, elapsed, remaining, isPast, isCurrent } = monthMeta;
    const monthTargets = targets[selectedMonth] || {};
    const totalTarget = accounts.reduce((s, a) => s + (monthTargets[a.id] || 0), 0);
    const timeGonePercent = dim > 0 ? Math.min((elapsed / dim) * 100, 100) : 0;

    // Pencapaian hari ini selalu merujuk ke tanggal hari ini sungguhan & target bulan berjalan
    // sungguhan (bukan bulan yang sedang dibrowse) KALAU mode bulanan. Di mode Harian/Custom,
    // "Hari Ini" mengikuti tanggal yang dipilih user (selectedDate / akhir rentang custom).
    const curYM = todayYM();
    const curDim = daysInMonthOf(curYM);
    const curMonthTargets = targets[curYM] || {};

    const refDate = periodMode === "day" ? selectedDate
      : periodMode === "custom" ? (customStartDate <= customEndDate ? customEndDate : customStartDate)
      : todayStr();
    const refYM = periodMode === "month" ? curYM : refDate.slice(0, 7);
    const refDim = periodMode === "month" ? curDim : daysInMonthOf(refYM);
    const refMonthTargets = periodMode === "month" ? curMonthTargets : (targets[refYM] || {});

    const perAccount = accounts.map((acc) => {
      const target = monthTargets[acc.id] || 0;
      const mtd = sumField(entries, viewDates, acc.id, "gmv");
      const pace = elapsed > 0 ? mtd / elapsed : 0;
      const projected = pace * dim;
      let status;
      if (!isPast && !isCurrent) status = "upcoming";
      else if (!target) status = "no-target";
      else if (remaining === 0) status = mtd >= target ? "tercapai" : "tidak-tercapai";
      else {
        const ratio = projected / target;
        status = ratio >= 1 ? "on-track" : ratio >= 0.85 ? "at-risk" : "behind";
      }
      const todayGmv = entries[refDate]?.[acc.id]?.gmv;
      const yestGmv = entries[ymd(addDays(new Date(refDate), -1))]?.[acc.id]?.gmv;
      const lastWeekGmv = entries[ymd(addDays(new Date(refDate), -7))]?.[acc.id]?.gmv;
      const dDoD = todayGmv !== undefined && yestGmv ? ((todayGmv - yestGmv) / yestGmv) * 100 : null;
      const dWoW = todayGmv !== undefined && lastWeekGmv ? ((todayGmv - lastWeekGmv) / lastWeekGmv) * 100 : null;

      const dailyTargetToday = refMonthTargets[acc.id] ? refMonthTargets[acc.id] / refDim : 0;
      const pencapaianHariIni = dailyTargetToday > 0 && todayGmv !== undefined ? (todayGmv / dailyTargetToday) * 100 : null;
      const pencapaianKemarin = dailyTargetToday > 0 && yestGmv !== undefined ? (yestGmv / dailyTargetToday) * 100 : null;
      const achievementDiffPts = pencapaianHariIni !== null && pencapaianKemarin !== null ? pencapaianHariIni - pencapaianKemarin : null;
      const achievementTrend = achievementDiffPts === null ? null : achievementDiffPts > 0.05 ? "up" : achievementDiffPts < -0.05 ? "down" : "flat";

      return { ...acc, target, mtd, pace, projected, status, todayGmv, yestGmv, dDoD, dWoW, pctTarget: target ? (mtd / target) * 100 : null, dailyTargetToday, pencapaianHariIni, pencapaianKemarin, achievementDiffPts, achievementTrend };
    });

    const totalMtd = perAccount.reduce((s, a) => s + a.mtd, 0);
    const avgPace = elapsed > 0 ? totalMtd / elapsed : 0;
    const totalProjected = avgPace * dim;
    let totalStatus;
    if (!isPast && !isCurrent) totalStatus = "upcoming";
    else if (!totalTarget) totalStatus = "no-target";
    else if (remaining === 0) totalStatus = totalMtd >= totalTarget ? "tercapai" : "tidak-tercapai";
    else { const r = totalProjected / totalTarget; totalStatus = r >= 1 ? "on-track" : r >= 0.85 ? "at-risk" : "behind"; }
    const requiredRate = remaining > 0 ? Math.max((totalTarget - totalMtd) / remaining, 0) : null;

    const todayTotal = accounts.reduce((s, a) => s + (entries[refDate]?.[a.id]?.gmv || 0), 0);
    const yestTotal = accounts.reduce((s, a) => s + (entries[ymd(addDays(new Date(refDate), -1))]?.[a.id]?.gmv || 0), 0);
    const lastWeekTotal = accounts.reduce((s, a) => s + (entries[ymd(addDays(new Date(refDate), -7))]?.[a.id]?.gmv || 0), 0);
    const hasToday = accounts.some((a) => entries[refDate]?.[a.id]?.gmv !== undefined);
    const hasYest = accounts.some((a) => entries[ymd(addDays(new Date(refDate), -1))]?.[a.id]?.gmv !== undefined);
    const hasLastWeek = accounts.some((a) => entries[ymd(addDays(new Date(refDate), -7))]?.[a.id]?.gmv !== undefined);
    const dDoDTotal = hasToday && hasYest && yestTotal ? ((todayTotal - yestTotal) / yestTotal) * 100 : null;
    const dWoWTotal = hasToday && hasLastWeek && lastWeekTotal ? ((todayTotal - lastWeekTotal) / lastWeekTotal) * 100 : null;

    const curTotalTarget = accounts.reduce((s, a) => s + (refMonthTargets[a.id] || 0), 0);
    const dailyTargetTodayTotal = curTotalTarget > 0 ? curTotalTarget / refDim : 0;
    const pencapaianHariIniTotal = dailyTargetTodayTotal > 0 && hasToday ? (todayTotal / dailyTargetTodayTotal) * 100 : null;
    const pencapaianKemarinTotal = dailyTargetTodayTotal > 0 && hasYest ? (yestTotal / dailyTargetTodayTotal) * 100 : null;
    const achievementDiffPtsTotal = pencapaianHariIniTotal !== null && pencapaianKemarinTotal !== null ? pencapaianHariIniTotal - pencapaianKemarinTotal : null;
    const achievementTrendTotal = achievementDiffPtsTotal === null ? null : achievementDiffPtsTotal > 0.05 ? "up" : achievementDiffPtsTotal < -0.05 ? "down" : "flat";

    const pencapaianPercentOverall = totalTarget ? (totalMtd / totalTarget) * 100 : null;
    const paceDiff = pencapaianPercentOverall !== null ? pencapaianPercentOverall - timeGonePercent : null;

    const targetPace = totalTarget > 0 ? totalTarget / dim : 0;
    const chartData = viewDates.map((date) => {
      const d = new Date(date);
      const row = { date, day: d.getDate(), isTwin: isTwinDate(date), isPayday: isPaydayWindow(date), targetPace };
      let total = 0;
      accounts.forEach((a) => { const v = entries[date]?.[a.id]?.gmv; row[a.id] = v ?? null; total += v || 0; });
      row.total = total;
      return row;
    });

    // Perbandingan dengan periode sebelumnya: mode bulan = bulan lalu; mode hari/custom = N hari
    // tepat sebelum periode ini, N = panjang periode (hari mode = 1 hari, custom = sepanjang range).
    const [selY, selM] = selectedMonth.split("-").map(Number);
    const lastMonthYM = ym(new Date(selY, selM - 2, 1));
    let lastMonthDates, lastMonthMtd, lastMonthTarget, lastMonthPct;
    if (periodMode === "day" || periodMode === "custom") {
      const n = viewDates.length || 1;
      const startDate = new Date(viewDates[0]);
      const prevDates = Array.from({ length: n }, (_, i) => ymd(addDays(startDate, -(n - i))));
      lastMonthDates = prevDates;
      lastMonthMtd = accounts.reduce((s, a) => s + sumField(entries, prevDates, a.id, "gmv"), 0);
      lastMonthTarget = 0;
      lastMonthPct = null;
    } else {
      const lastMonthDim = daysInMonthOf(lastMonthYM);
      lastMonthDates = Array.from({ length: lastMonthDim }, (_, i) => `${lastMonthYM}-${pad(i + 1)}`);
      lastMonthMtd = accounts.reduce((s, a) => s + sumField(entries, lastMonthDates, a.id, "gmv"), 0);
      lastMonthTarget = accounts.reduce((s, a) => s + (targets[lastMonthYM]?.[a.id] || 0), 0);
      lastMonthPct = lastMonthTarget > 0 ? (lastMonthMtd / lastMonthTarget) * 100 : null;
    }
    const mtdVsLastMonth = lastMonthMtd > 0 ? ((totalMtd - lastMonthMtd) / lastMonthMtd) * 100 : null;

    // Total orders periode ini vs periode lalu
    const totalOrders = accounts.reduce((s, a) => s + sumField(entries, viewDates, a.id, "orders"), 0);
    const lastMonthOrders = accounts.reduce((s, a) => s + sumField(entries, lastMonthDates, a.id, "orders"), 0);
    const ordersVsLast = lastMonthOrders > 0 ? ((totalOrders - lastMonthOrders) / lastMonthOrders) * 100 : null;
    const hasOrdersData = totalOrders > 0 || lastMonthOrders > 0;

    return {
      perAccount, totalMtd, totalTarget, avgPace, totalProjected, totalStatus, requiredRate,
      todayTotal: hasToday ? todayTotal : null, dDoDTotal, dWoWTotal, chartData, targetPace, dim, elapsed, remaining,
      timeGonePercent, pencapaianPercentOverall, paceDiff,
      pencapaianHariIniTotal, pencapaianKemarinTotal, achievementDiffPtsTotal, achievementTrendTotal,
      lastMonthMtd, lastMonthTarget, lastMonthPct, lastMonthYM, mtdVsLastMonth,
      totalOrders, lastMonthOrders, ordersVsLast, hasOrdersData,
      refDate,
    };
  }, [accounts, targets, entries, selectedMonth, monthMeta, viewDates, periodMode, selectedDate, customStartDate, customEndDate]);

  const insights = useMemo(() => combineInsights(accounts, targets, entries, benchmarks), [accounts, targets, entries, benchmarks]);

  // Ranking pencapaian toko — diurutkan dari % capaian target tertinggi. Toko tanpa target
  // disusun di bawah (berdasarkan MTD mentah sebagai tie-breaker), karena tidak adil
  // dibandingkan % terhadap toko yang sudah punya target.
  const ranking = useMemo(() => {
    return [...overview.perAccount].sort((a, b) => {
      const aHasTarget = a.target > 0, bHasTarget = b.target > 0;
      if (aHasTarget !== bHasTarget) return aHasTarget ? -1 : 1;
      if (aHasTarget && bHasTarget && b.pctTarget !== a.pctTarget) return b.pctTarget - a.pctTarget;
      return b.mtd - a.mtd;
    });
  }, [overview.perAccount]);

  const sourceBreakdown = useMemo(() => {
    const allDatesInMonth = viewDates;
    const tiktokAccounts = accounts.filter((a) => a.platform === "tiktok");
    const shopeeAccounts = accounts.filter((a) => a.platform === "shopee");

    const perAccount = tiktokAccounts.map((acc) => {
      const sums = {};
      GMV_SOURCE_FIELDS.forEach(([f]) => { sums[f] = sumField(entries, allDatesInMonth, acc.id, f); });
      const breakdownTotal = GMV_SOURCE_FIELDS.reduce((s, [f]) => s + sums[f], 0);
      const gmvRecorded = sumField(entries, allDatesInMonth, acc.id, "gmv");
      const daysWithBreakdown = allDatesInMonth.filter((d) => GMV_SOURCE_FIELDS.some(([f]) => entries[d]?.[acc.id]?.[f] !== undefined)).length;
      const daysGmvOnly = allDatesInMonth.filter((d) => entries[d]?.[acc.id]?.gmv !== undefined && !GMV_SOURCE_FIELDS.some(([f]) => entries[d]?.[acc.id]?.[f] !== undefined)).length;
      return { ...acc, sums, breakdownTotal, gmvRecorded, daysWithBreakdown, daysGmvOnly };
    });

    const combined = {};
    GMV_SOURCE_FIELDS.forEach(([f]) => { combined[f] = perAccount.reduce((s, a) => s + a.sums[f], 0); });
    const combinedBreakdownTotal = GMV_SOURCE_FIELDS.reduce((s, [f]) => s + combined[f], 0);
    const combinedGmvRecorded = perAccount.reduce((s, a) => s + a.gmvRecorded, 0);
    const totalDaysGmvOnly = perAccount.reduce((s, a) => s + a.daysGmvOnly, 0);

    const shopeeTotal = shopeeAccounts.reduce((s, a) => s + sumField(entries, allDatesInMonth, a.id, "gmv"), 0);

    const perShopee = shopeeAccounts.map((acc) => {
      const sums = {};
      SHOPEE_SOURCE_FIELDS.forEach(([f]) => { sums[f] = sumField(entries, allDatesInMonth, acc.id, f); });
      const breakdownTotal = SHOPEE_SOURCE_FIELDS.reduce((s, [f]) => s + sums[f], 0);
      const gmvRecorded = sumField(entries, allDatesInMonth, acc.id, "gmv");
      const daysWithBreakdown = allDatesInMonth.filter((d) => SHOPEE_SOURCE_FIELDS.some(([f]) => entries[d]?.[acc.id]?.[f] !== undefined)).length;
      const daysGmvOnly = allDatesInMonth.filter((d) => entries[d]?.[acc.id]?.gmv !== undefined && !SHOPEE_SOURCE_FIELDS.some(([f]) => entries[d]?.[acc.id]?.[f] !== undefined)).length;
      return { ...acc, sums, breakdownTotal, gmvRecorded, daysWithBreakdown, daysGmvOnly };
    });

    return { perAccount, combined, combinedBreakdownTotal, combinedGmvRecorded, totalDaysGmvOnly, shopeeAccounts, shopeeTotal, perShopee };
  }, [accounts, entries, viewDates, periodMode]);

  const adPerformance = useMemo(() => {
    const allDatesInMonth = viewDates;
    const curAdBudgets = adBudgets[selectedMonth] || {};
    const dim = daysInMonthOf(selectedMonth);

    const perAccount = accounts.map((acc) => {
      const spend = sumField(entries, allDatesInMonth, acc.id, "adSpend");
      const revenue = sumField(entries, allDatesInMonth, acc.id, "adRevenue");
      const orders = sumField(entries, allDatesInMonth, acc.id, "orders");
      const roas = spend > 0 ? revenue / spend : null;
      const cpa = orders > 0 ? spend / orders : null;
      const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : null;
      const budgetPerHari = curAdBudgets[acc.id] || 0;
      const daysWithAdData = allDatesInMonth.filter((d) => entries[d]?.[acc.id]?.adSpend !== undefined).length;

      const td = todayStr();
      const yd = ymd(addDays(effectiveToday(), -1));
      const todaySpend = entries[td]?.[acc.id]?.adSpend, todayRevenue = entries[td]?.[acc.id]?.adRevenue;
      const yestSpend = entries[yd]?.[acc.id]?.adSpend, yestRevenue = entries[yd]?.[acc.id]?.adRevenue;
      const todayRoas = todaySpend > 0 ? todayRevenue / todaySpend : null;
      const yestRoas = yestSpend > 0 ? yestRevenue / yestSpend : null;
      const dRoas = (todayRoas !== null && yestRoas !== null) ? todayRoas - yestRoas : null;

      return { ...acc, spend, revenue, orders, roas, cpa, roi, budgetPerHari, daysWithAdData, todayRoas, yestRoas, dRoas };
    });

    const totalSpend = perAccount.reduce((s, a) => s + a.spend, 0);
    const totalRevenue = perAccount.reduce((s, a) => s + a.revenue, 0);
    const totalOrders = perAccount.reduce((s, a) => s + a.orders, 0);
    const totalBudgetPerHari = perAccount.reduce((s, a) => s + a.budgetPerHari, 0);
    const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : null;
    const overallCpa = totalOrders > 0 ? totalSpend / totalOrders : null;
    const overallRoi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null;
    const totalDaysWithAdData = perAccount.reduce((s, a) => s + a.daysWithAdData, 0);

    // GMV total semua sumber (bukan hanya dari iklan) — untuk perbandingan seberapa besar
    // kontribusi revenue iklan terhadap total GMV toko secara keseluruhan.
    const totalGmvAllStores = accounts.reduce((s, a) => s + sumField(entries, allDatesInMonth, a.id, "gmv"), 0);
    const adRevenueShare = totalGmvAllStores > 0 ? (totalRevenue / totalGmvAllStores) * 100 : null;

    // GMV per akun untuk kolom tabel
    const perAccountWithGmv = perAccount.map((a) => ({
      ...a,
      gmvTotal: sumField(entries, allDatesInMonth, a.id, "gmv"),
    }));

    const chartData = allDatesInMonth.map((date) => {
      const d = new Date(date);
      const row = { date, day: d.getDate() };
      accounts.forEach((acc) => {
        const sp = entries[date]?.[acc.id]?.adSpend, rev = entries[date]?.[acc.id]?.adRevenue;
        row[acc.id] = (sp !== undefined && sp > 0 && rev !== undefined) ? rev / sp : null;
      });
      return row;
    });

    return { perAccount: perAccountWithGmv, totalSpend, totalRevenue, totalOrders, totalBudgetPerHari, overallRoas, overallCpa, overallRoi, totalDaysWithAdData, chartData, dim, totalGmvAllStores, adRevenueShare };
  }, [accounts, entries, adBudgets, viewDates, periodMode, selectedMonth]);

  // ---- Live Tracker: filter & agregasi (terpisah total dari useMemo Input Data GMV) ----
  // Gabungan toko yang ditrack GMV (accounts) + toko khusus Live (liveOnlyAccounts) — ini yang
  // dipakai sebagai pilihan "Nama Toko" di form Live Tracker & filter laporan, BUKAN `accounts`
  // saja, supaya Pompurin/Star (yang tidak ikut GMV) tetap bisa dipilih di sini.
  const liveAccountOptions = useMemo(() => [...accounts, ...liveOnlyAccounts], [accounts, liveOnlyAccounts]);

  // Opsi host yang ditampilkan di dropdown — dihitung dari sesi yang sudah disaring bulan+toko
  // (BELUM disaring host), supaya daftar host yang muncul relevan dengan filter toko yang dipilih.
  // helper: cek apakah tanggal sesi cocok dengan filter periode aktif (mode bulan atau custom)
  const liveDateInFilter = useCallback((dateStr) => {
    if (!dateStr) return false;
    if (liveFilterMode === "custom") {
      const lo = liveFilterStart <= liveFilterEnd ? liveFilterStart : liveFilterEnd;
      const hi = liveFilterStart <= liveFilterEnd ? liveFilterEnd : liveFilterStart;
      return dateStr >= lo && dateStr <= hi;
    }
    return dateStr.startsWith(liveFilterMonth);
  }, [liveFilterMode, liveFilterMonth, liveFilterStart, liveFilterEnd]);

  const liveHostOptions = useMemo(() => {
    const pool = liveSessions.filter((s) => liveDateInFilter(s.date) && (liveFilterAccount === "all" || s.accountId === liveFilterAccount));
    return Array.from(new Set(pool.map((s) => s.hostName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [liveSessions, liveDateInFilter, liveFilterAccount]);

  const liveSessionsForMonth = useMemo(() => {
    return liveSessions
      .filter((s) => liveDateInFilter(s.date))
      .filter((s) => liveFilterAccount === "all" || s.accountId === liveFilterAccount)
      .filter((s) => liveFilterHost === "all" || s.hostName === liveFilterHost)
      .sort((a, b) => (b.date + (b.startTime || "")).localeCompare(a.date + (a.startTime || "")));
  }, [liveSessions, liveDateInFilter, liveFilterAccount, liveFilterHost]);

  const livePeriodLabel = liveFilterMode === "custom"
    ? (() => {
        const fmt = (d) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
        const lo = liveFilterStart <= liveFilterEnd ? liveFilterStart : liveFilterEnd;
        const hi = liveFilterStart <= liveFilterEnd ? liveFilterEnd : liveFilterStart;
        return lo === hi ? fmt(lo) : `${fmt(lo)} \u2013 ${fmt(hi)}`;
      })()
    : monthLabel(liveFilterMonth);

  const liveStats = useMemo(() => {
    const sessions = liveSessionsForMonth;
    const totalSessions = sessions.length;
    const totalOrders = sessions.reduce((s, x) => s + (x.orders || 0), 0);
    const totalGmv = sessions.reduce((s, x) => s + (x.directGmv || 0), 0);
    const totalViewers = sessions.reduce((s, x) => s + (x.totalViewers || 0), 0);
    const totalHours = sessions.reduce((s, x) => s + (calcLiveHours(x.startTime, x.endTime) || 0), 0);
    const avgCo = sessions.filter((x) => x.co !== null && x.co !== undefined).length > 0
      ? sessions.reduce((s, x) => s + (x.co || 0), 0) / sessions.filter((x) => x.co !== null && x.co !== undefined).length
      : null;
    const avgCtr = sessions.filter((x) => x.ctr !== null && x.ctr !== undefined).length > 0
      ? sessions.reduce((s, x) => s + (x.ctr || 0), 0) / sessions.filter((x) => x.ctr !== null && x.ctr !== undefined).length
      : null;
    const avgGpm = sessions.filter((x) => x.gpm !== null && x.gpm !== undefined).length > 0
      ? sessions.reduce((s, x) => s + (x.gpm || 0), 0) / sessions.filter((x) => x.gpm !== null && x.gpm !== undefined).length
      : null;

    // ranking host berdasarkan total Direct GMV — dikelompokkan PER NAMA HOST (bukan per toko),
    // jadi satu orang yang live di beberapa toko tetap muncul sebagai satu baris di ranking.
    const byHost = {};
    sessions.forEach((x) => {
      const key = x.hostName; // key = nama orang, bukan akun+nama
      if (!byHost[key]) byHost[key] = { hostName: x.hostName, accountNames: new Set(), sessions: 0, gmv: 0, orders: 0, hours: 0 };
      byHost[key].accountNames.add(x.accountName);
      byHost[key].sessions += 1;
      byHost[key].gmv += x.directGmv || 0;
      byHost[key].orders += x.orders || 0;
      byHost[key].hours += calcLiveHours(x.startTime, x.endTime) || 0;
    });
    // Konversi Set ke string untuk ditampilkan (misal "Pretty, Lovie")
    const hostRanking = Object.values(byHost)
      .map((h) => ({ ...h, accountName: Array.from(h.accountNames).join(", ") }))
      .sort((a, b) => b.gmv - a.gmv);

    return { totalSessions, totalOrders, totalGmv, totalViewers, totalHours, avgCo, avgCtr, avgGpm, hostRanking };
  }, [liveSessionsForMonth]);

  // Rating & Followers adalah metrik "snapshot" (bukan akumulasi harian seperti GMV) — yang
  // dibandingkan adalah nilai pada refDate vs persis nilai sehari sebelumnya. refDate mengikuti
  // mode periode: hari ini sungguhan (mode Bulanan), atau tanggal yang dipilih user (mode
  // Harian/Custom) — supaya konsisten dengan tabel Perbandingan Harian di atasnya.
  const growthMetrics = useMemo(() => {
    const td = overview.refDate;
    const yd = ymd(addDays(new Date(td), -1));
    return accounts.map((acc) => {
      const todayRating = entries[td]?.[acc.id]?.rating;
      const yestRating = entries[yd]?.[acc.id]?.rating;
      const dRating = (todayRating !== undefined && yestRating !== undefined) ? todayRating - yestRating : null;
      const todayFollowers = entries[td]?.[acc.id]?.followers;
      const yestFollowers = entries[yd]?.[acc.id]?.followers;
      const dFollowers = (todayFollowers !== undefined && yestFollowers !== undefined) ? todayFollowers - yestFollowers : null;
      return { ...acc, todayRating, yestRating, dRating, todayFollowers, yestFollowers, dFollowers };
    });
  }, [accounts, entries, overview.refDate]);

  /* ---------- handlers: daily form ---------- */
  const updateDraftField = (accId, field, value) => {
    setDraft((prev) => ({ ...prev, [accId]: { ...prev[accId], [field]: value } }));
  };
  const toggleExpand = (accId) => {
    setExpandedRows((prev) => { const n = new Set(prev); n.has(accId) ? n.delete(accId) : n.add(accId); return n; });
  };
  const saveDraft = async () => {
    const oldDayData = entries[inputDate] || {};
    const cleaned = {};
    const newRevisions = [];
    const editableAccounts = accounts.filter((acc) => isAdmin || acc.id === myAccountId);
    editableAccounts.forEach((acc) => {
      const row = draft[acc.id] || {};
      const fields = sourceFieldsFor(acc.platform);
      let gmv;
      const breakdown = {};
      const anySource = fields.some(([f]) => row[f] !== undefined);
      if (anySource) {
        gmv = fields.reduce((s, [f]) => s + (row[f] || 0), 0);
        fields.forEach(([f]) => { if (row[f] !== undefined) breakdown[f] = row[f]; });
      } else {
        gmv = row.gmv; // belum pernah diisi breakdown — pertahankan total lama (misal hasil import)
      }
      if (gmv === undefined || gmv === "" || gmv === null) return;
      const newRow = {
        gmv: parseNum(gmv),
        ...breakdown,
        ...(row.orders !== undefined && row.orders !== "" ? { orders: parseNum(row.orders) } : {}),
        ...(row.visitors !== undefined && row.visitors !== "" ? { visitors: parseNum(row.visitors) } : {}),
        ...(row.adSpend !== undefined && row.adSpend !== "" ? { adSpend: parseNum(row.adSpend) } : {}),
        ...(row.adRevenue !== undefined && row.adRevenue !== "" ? { adRevenue: parseNum(row.adRevenue) } : {}),
        ...(row.rating !== undefined && row.rating !== "" ? { rating: parseDecimal(row.rating) } : {}),
        ...(row.followers !== undefined && row.followers !== "" ? { followers: parseNum(row.followers) } : {}),
      };
      cleaned[acc.id] = newRow;
      const oldRow = oldDayData[acc.id];
      if (oldRow) {
        const diffs = diffRow(oldRow, newRow);
        if (diffs.length > 0) {
          newRevisions.push({
            id: `${Date.now()}-${acc.id}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(), date: inputDate, accountId: acc.id, accountName: acc.name,
            before: oldRow, after: newRow, diffs,
          });
        }
      }
    });
    if (Object.keys(cleaned).length === 0) {
      showToast("error", "Tidak ada data untuk disimpan — isi minimal GMV salah satu akun dulu.");
      return;
    }
    setSaving(true);
    const mergedDay = { ...oldDayData, ...cleaned };
    setEntries((prev) => ({ ...prev, [inputDate]: mergedDay }));
    try {
      await Promise.all(Object.entries(cleaned).map(([accId, row]) => saveEntryDay(accId, inputDate, row)));
      if (newRevisions.length > 0) {
        await Promise.all(newRevisions.map((r) => addRevisionRecord(r)));
        setRevisions((prev) => [...newRevisions, ...prev]);
      }
      setSaving(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      showToast("success", `Data ${inputDate} berhasil disimpan.`);
    } catch (e) {
      setSaving(false);
      setEntries((prev) => ({ ...prev, [inputDate]: oldDayData })); // rollback tampilan ke kondisi sebelum gagal
      showToast("error", `Gagal menyimpan: ${e.message || "cek koneksi / izin akun"}.`);
    }
  };

  /* ---------- handlers: paste ---------- */
  const processPaste = () => {
    const parsed = parsePasteData(pasteText, accounts);
    const guarded = isAdmin ? parsed : parsed.map((r) => (
      r.ok && r.accountId !== myAccountId
        ? { ...r, ok: false, error: `Kamu cuma bisa input data toko sendiri (akun ini menyasar "${r.accountName}").` }
        : r
    ));
    setPastePreview(guarded);
  };
  const commitPaste = async () => {
    if (!pastePreview) return;
    const next = { ...entries };
    const newRevisions = [];
    const writes = [];
    pastePreview.filter((r) => r.ok).forEach((r) => {
      const acc = accounts.find((a) => a.id === r.accountId);
      const breakdownToSave = {};
      sourceFieldsFor(acc?.platform).forEach(([f]) => { if (r[f] !== undefined) breakdownToSave[f] = r[f]; });
      const newRow = {
        gmv: r.gmv,
        ...breakdownToSave,
        ...(r.orders !== undefined ? { orders: r.orders } : {}),
        ...(r.visitors !== undefined ? { visitors: r.visitors } : {}),
        ...(r.adSpend !== undefined ? { adSpend: r.adSpend } : {}),
        ...(r.adRevenue !== undefined ? { adRevenue: r.adRevenue } : {}),
        ...(r.rating !== undefined ? { rating: r.rating } : {}),
        ...(r.followers !== undefined ? { followers: r.followers } : {}),
      };
      const oldRow = entries[r.date]?.[r.accountId];
      next[r.date] = { ...next[r.date], [r.accountId]: newRow };
      writes.push({ accountId: r.accountId, date: r.date, row: newRow });
      if (oldRow) {
        const diffs = diffRow(oldRow, newRow);
        if (diffs.length > 0) {
          newRevisions.push({
            id: `${Date.now()}-${r.accountId}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(), date: r.date, accountId: r.accountId, accountName: r.accountName,
            before: oldRow, after: newRow, diffs,
          });
        }
      }
    });
    if (writes.length === 0) {
      showToast("error", "Tidak ada baris valid untuk disimpan.");
      return;
    }
    setSaving(true);
    const prevEntries = entries;
    setEntries(next);
    try {
      await Promise.all(writes.map((w) => saveEntryDay(w.accountId, w.date, w.row)));
      if (newRevisions.length > 0) {
        await Promise.all(newRevisions.map((r) => addRevisionRecord(r)));
        setRevisions((prev) => [...newRevisions, ...prev]);
      }
      setSaving(false);
      setPasteText(""); setPastePreview(null);
      setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000);
      showToast("success", `${writes.length} baris berhasil disimpan.`);
    } catch (e) {
      setSaving(false);
      setEntries(prevEntries);
      showToast("error", `Gagal menyimpan: ${e.message || "cek koneksi / izin akun"}.`);
    }
  };

  const restoreRevision = async (rev) => {
    if (!isAdmin && rev.accountId !== myAccountId) return;
    if (!window.confirm(`Pulihkan data ${rev.accountName} tanggal ${rev.date} ke kondisi sebelum revisi ini?`)) return;
    setSaving(true);
    const prevEntries = entries;
    const next = { ...entries };
    try {
      if (rev.before) {
        next[rev.date] = { ...next[rev.date], [rev.accountId]: rev.before };
        setEntries(next);
        await saveEntryDay(rev.accountId, rev.date, rev.before);
      } else {
        const dayData = { ...(next[rev.date] || {}) };
        delete dayData[rev.accountId];
        next[rev.date] = dayData;
        setEntries(next);
        await deleteEntryDay(rev.accountId, rev.date);
      }
      const restoreRecord = {
        id: `${Date.now()}-${rev.accountId}-restore`,
        timestamp: Date.now(), date: rev.date, accountId: rev.accountId, accountName: rev.accountName,
        before: rev.after, after: rev.before || {}, diffs: diffRow(rev.after, rev.before || {}), isRestore: true,
      };
      await addRevisionRecord(restoreRecord);
      setRevisions((prev) => [restoreRecord, ...prev]);
      setSaving(false);
      showToast("success", "Data berhasil dipulihkan.");
    } catch (e) {
      setSaving(false);
      setEntries(prevEntries);
      showToast("error", `Gagal memulihkan: ${e.message || "cek koneksi / izin akun"}.`);
    }
  };

  /* ---------- handlers: targets & accounts ---------- */
  const saveTargets = async () => {
    const editableEntries = Object.entries(targetDraft).filter(([accId]) => isAdmin || accId === myAccountId);
    if (editableEntries.length === 0) {
      showToast("error", "Tidak ada target untuk disimpan.");
      return;
    }
    setSaving(true);
    const prevTargets = targets;
    const next = { ...targets, [selectedMonth]: { ...(targets[selectedMonth] || {}), ...Object.fromEntries(editableEntries) } };
    setTargets(next);
    try {
      await Promise.all(editableEntries.map(([accId, value]) => saveTargetMonth(accId, selectedMonth, value)));
      setSaving(false);
      showToast("success", `Target ${monthLabel(selectedMonth)} berhasil disimpan.`);
    } catch (e) {
      setSaving(false);
      setTargets(prevTargets);
      showToast("error", `Gagal menyimpan target: ${e.message || "cek koneksi / izin akun"}.`);
    }
  };
  const copyFromLastMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevYM = ym(new Date(y, m - 2, 1));
    setTargetDraft(targets[prevYM] || {});
  };

  const saveAdBudgets = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const next = { ...adBudgets, [selectedMonth]: { ...(adBudgets[selectedMonth] || {}), ...adBudgetDraft } };
      setAdBudgets(next);
      await safeSet("gmv-dashboard-adbudgets-v1", next);
      setSaving(false);
      showToast("success", `Budget iklan ${monthLabel(selectedMonth)} berhasil disimpan.`);
    } catch (e) {
      setSaving(false);
      showToast("error", `Gagal menyimpan budget: ${e.message || "cek koneksi"}.`);
    }
  };

  /* ---------- handlers: Live Tracker (terpisah total dari Input Data GMV) ---------- */
  const updateLiveDraftField = (field, value) => setLiveDraft((prev) => ({ ...prev, [field]: value }));

  const saveLiveSessionEntry = async () => {
    const acc = liveAccountOptions.find((a) => a.id === liveDraft.accountId);
    if (!acc) { showToast("error", "Pilih toko dulu sebelum simpan sesi live."); return; }
    if (!liveDraft.date || !liveDraft.hostName.trim()) { showToast("error", "Tanggal dan Nama Host wajib diisi."); return; }

    setSaving(true);
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sessionData = {
      date: liveDraft.date,
      hostName: liveDraft.hostName.trim(),
      startTime: liveDraft.startTime || null,
      endTime: liveDraft.endTime || null,
      orders: liveDraft.orders === "" ? null : parseNum(liveDraft.orders),
      directGmv: liveDraft.directGmv === "" ? null : parseNum(liveDraft.directGmv),
      totalViewers: liveDraft.totalViewers === "" ? null : parseNum(liveDraft.totalViewers),
      co: liveDraft.co === "" ? null : parseDecimal(liveDraft.co),
      ctr: liveDraft.ctr === "" ? null : parseDecimal(liveDraft.ctr),
      gpm: liveDraft.gpm === "" ? null : parseNum(liveDraft.gpm),
      accountName: acc.name,
      platform: acc.platform,
      createdAt: Date.now(),
    };
    try {
      await saveLiveSession(acc.id, sessionId, sessionData);
      setLiveSessions((prev) => [...prev, { id: sessionId, accountId: acc.id, ...sessionData }]);
      setSaving(false);
      setLiveSavedFlash(true);
      setTimeout(() => setLiveSavedFlash(false), 2000);
      showToast("success", `Sesi live ${acc.name} (${liveDraft.hostName}) berhasil dicatat.`);
      // reset draft tapi pertahankan toko & tanggal yang sama (mempermudah input berturut-turut)
      setLiveDraft((prev) => ({ ...prev, hostName: "", startTime: "", endTime: "", orders: "", directGmv: "", totalViewers: "", co: "", ctr: "", gpm: "" }));
    } catch (e) {
      setSaving(false);
      showToast("error", `Gagal menyimpan sesi live: ${e.message || "cek koneksi / izin akun"}.`);
    }
  };

  const removeLiveSession = async (session) => {
    if (!window.confirm(`Hapus sesi live ${session.accountName} — ${session.hostName} (${session.date})? Tindakan ini tidak bisa dibatalkan.`)) return;
    setSaving(true);
    try {
      await deleteLiveSession(session.accountId, session.id);
      setLiveSessions((prev) => prev.filter((s) => s.id !== session.id));
      setSaving(false);
      showToast("success", "Sesi live berhasil dihapus.");
    } catch (e) {
      setSaving(false);
      showToast("error", `Gagal menghapus: ${e.message || "cek koneksi / izin akun"}.`);
    }
  };

  const exportLiveReport = () => {
    if (liveSessionsForMonth.length === 0) {
      showToast("error", "Tidak ada data untuk diexport pada filter ini.");
      return;
    }
    try {
      const rows = liveSessionsForMonth.map((s) => ({
        Date: s.date,
        "Nama Toko": s.accountName,
        Platform: s.platform === "shopee" ? "Shopee" : "TikTok Shop",
        "Nama HOST": s.hostName,
        "Start Live": s.startTime || "",
        "End Live": s.endTime || "",
        "Live Hours": fmtHours(calcLiveHours(s.startTime, s.endTime)),
        Orders: s.orders ?? "",
        "Direct GMV": s.directGmv ?? "",
        "Total Viewers": s.totalViewers ?? "",
        "CO (%)": s.co ?? "",
        "CTR (%)": s.ctr ?? "",
        GPM: s.gpm ?? "",
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Laporan Live");

      const summaryRows = [
        { Metrik: "Total Sesi", Nilai: liveStats.totalSessions },
        { Metrik: "Total Direct GMV", Nilai: liveStats.totalGmv },
        { Metrik: "Total Orders", Nilai: liveStats.totalOrders },
        { Metrik: "Total Jam Live", Nilai: fmtHours(liveStats.totalHours) },
        { Metrik: "Rata-rata CO%", Nilai: liveStats.avgCo !== null ? liveStats.avgCo.toFixed(1) : "—" },
        { Metrik: "Rata-rata CTR%", Nilai: liveStats.avgCtr !== null ? liveStats.avgCtr.toFixed(1) : "—" },
        { Metrik: "Rata-rata GPM", Nilai: liveStats.avgGpm !== null ? Math.round(liveStats.avgGpm) : "—" },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Ringkasan");

      const accLabel = liveFilterAccount === "all" ? "SemuaToko" : (liveAccountOptions.find((a) => a.id === liveFilterAccount)?.name || liveFilterAccount).replace(/\s+/g, "");
      const hostLabel = liveFilterHost === "all" ? "" : `-${liveFilterHost.replace(/\s+/g, "")}`;
      const periodLabelForFile = liveFilterMode === "custom" ? `${liveFilterStart}_${liveFilterEnd}` : liveFilterMonth;
      XLSX.writeFile(wb, `Laporan-Live-${periodLabelForFile}-${accLabel}${hostLabel}.xlsx`);
      showToast("success", "Laporan Live berhasil diexport.");
    } catch (e) {
      showToast("error", `Export gagal: ${e.message || "coba lagi"}.`);
    }
  };

  const addLiveOnlyAccount = async () => {
    if (!isAdmin) return;
    const trimmedName = newLiveAccountName.trim();
    if (!trimmedName) { showToast("error", "Nama toko wajib diisi."); return; }
    const combined = [...accounts, ...liveOnlyAccounts];
    if (combined.some((a) => a.name.toLowerCase() === trimmedName.toLowerCase())) {
      showToast("error", `"${trimmedName}" sudah ada di daftar toko.`);
      return;
    }
    const baseSlug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    let newId = `live_${baseSlug}`;
    let suffix = 2;
    const existingIds = new Set(combined.map((a) => a.id));
    while (existingIds.has(newId)) { newId = `live_${baseSlug}_${suffix}`; suffix++; }
    const usedColors = new Set(combined.map((a) => a.color));
    const color = ACCOUNT_COLORS.find((c) => !usedColors.has(c)) || ACCOUNT_COLORS[combined.length % ACCOUNT_COLORS.length];
    const newAccount = { id: newId, name: trimmedName, platform: newLiveAccountPlatform, color };
    setSaving(true);
    try {
      const next = [...liveOnlyAccounts, newAccount];
      await safeSet(LIVE_ONLY_ACCOUNTS_KEY, next);
      setLiveOnlyAccounts(next);
      setNewLiveAccountName("");
      setSaving(false);
      showToast("success", `"${trimmedName}" ditambahkan ke daftar toko Live Tracker.`);
    } catch (e) {
      setSaving(false);
      showToast("error", `Gagal menambah toko: ${e.message || "cek koneksi"}.`);
    }
  };

  const removeLiveOnlyAccount = async (accountId) => {
    if (!isAdmin) return;
    const acc = liveOnlyAccounts.find((a) => a.id === accountId);
    if (!acc) return;
    if (!window.confirm(`Hapus "${acc.name}" dari daftar toko Live Tracker? Sesi live yang sudah tercatat untuk toko ini TIDAK ikut terhapus, tapi nama tokonya tidak akan muncul lagi di pilihan toko baru.`)) return;
    setSaving(true);
    try {
      const next = liveOnlyAccounts.filter((a) => a.id !== accountId);
      await safeSet(LIVE_ONLY_ACCOUNTS_KEY, next);
      setLiveOnlyAccounts(next);
      setSaving(false);
      showToast("success", `"${acc.name}" dihapus dari daftar toko Live Tracker.`);
    } catch (e) {
      setSaving(false);
      showToast("error", `Gagal menghapus: ${e.message || "cek koneksi"}.`);
    }
  };

  /* ---------- handlers: Jadwal Live ---------- */
  const schedWeekKey = weekKey(schedWeekStart);
  const schedWeekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(schedWeekStart); d.setDate(d.getDate() + i); return d; });

  // ---- Struktur slot BARU: room → [{ id, hostId, toko, startHour, endHour }]
  // Satu ruangan bisa punya BANYAK assignment host di jam yang berbeda (bahkan bersamaan).
  const getRoomAssignments = useCallback((date, room) => {
    const dk = ymd(date), wk = weekKey(date);
    const raw = schedData[wk]?.slots?.[dk]?.[room];
    return Array.isArray(raw) ? raw : [];
  }, [schedData]);

  const getSchedOff = useCallback((date) => {
    const dk = ymd(date), wk = weekKey(date);
    return schedData[wk]?.off?.[dk] || [];
  }, [schedData]);

  const addSchedAssignment = async (date, room, assignment) => {
    const dk = ymd(date), wk = weekKey(date);
    const next = JSON.parse(JSON.stringify(schedData));
    if (!next[wk]) next[wk] = { slots: {}, off: {} };
    if (!next[wk].slots[dk]) next[wk].slots[dk] = {};
    const arr = Array.isArray(next[wk].slots[dk][room]) ? next[wk].slots[dk][room] : [];
    arr.push({ ...assignment, id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}` });
    next[wk].slots[dk][room] = arr;
    setSchedData(next);
    try { await safeSet(SCHEDULE_DATA_KEY, next); }
    catch (e) { showToast("error", `Gagal simpan jadwal: ${e.message}`); }
  };

  const removeSchedAssignment = async (date, room, assignmentId) => {
    const dk = ymd(date), wk = weekKey(date);
    const next = JSON.parse(JSON.stringify(schedData));
    const arr = next[wk]?.slots?.[dk]?.[room];
    if (!Array.isArray(arr)) return;
    next[wk].slots[dk][room] = arr.filter((a) => a.id !== assignmentId);
    setSchedData(next);
    try { await safeSet(SCHEDULE_DATA_KEY, next); }
    catch (e) { showToast("error", `Gagal hapus: ${e.message}`); }
  };

  const toggleSchedOff = async (date, hostId) => {
    const dk = ymd(date), wk = weekKey(date);
    const next = JSON.parse(JSON.stringify(schedData));
    if (!next[wk]) next[wk] = { slots: {}, off: {} };
    if (!next[wk].off[dk]) next[wk].off[dk] = [];
    const arr = next[wk].off[dk];
    const idx = arr.indexOf(hostId);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(hostId);
    setSchedData(next);
    try { await safeSet(SCHEDULE_DATA_KEY, next); }
    catch (e) { showToast("error", `Gagal simpan off: ${e.message}`); }
  };

  // Daftar nama host bersama — dipakai di Live Tracker (dropdown nama) dan Jadwal (pilih nama saat tambah host)
  const addHostName = async () => {
    if (!isAdmin) return;
    const name = newHostNameInput.trim();
    if (!name) { showToast("error", "Nama tidak boleh kosong."); return; }
    if (hostNames.includes(name)) { showToast("error", `"${name}" sudah ada di daftar.`); return; }
    const next = [...hostNames, name].sort((a, b) => a.localeCompare(b));
    setHostNames(next);
    setNewHostNameInput("");
    try { await safeSet(HOST_NAMES_KEY, next); showToast("success", `"${name}" ditambahkan ke daftar host.`); }
    catch (e) { showToast("error", `Gagal: ${e.message}`); }
  };

  const removeHostName = async (name) => {
    if (!isAdmin) return;
    if (!window.confirm(`Hapus "${name}" dari daftar host? Data live yang sudah dicatat dengan nama ini tidak ikut terhapus.`)) return;
    const next = hostNames.filter((n) => n !== name);
    setHostNames(next);
    try { await safeSet(HOST_NAMES_KEY, next); showToast("success", `"${name}" dihapus dari daftar host.`); }
    catch (e) { showToast("error", `Gagal: ${e.message}`); }
  };

  const addSchedHost = async () => {
    if (!isAdmin) return;
    const name = schedNewName;
    if (!name) { showToast("error", "Pilih nama host dari daftar."); return; }
    if (schedHosts.some((h) => h.name === name)) { showToast("error", `"${name}" sudah ada di jadwal minggu ini. Hapus dulu sebelum tambah ulang.`); return; }
    const sessions = schedNewSessions.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n > 0);
    if (!sessions.length) { showToast("error", "Format sesi tidak valid. Contoh: 2,2"); return; }
    const id = `host_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
    const bg = schedNewColor + "30";
    const newHost = { id, name, color: schedNewColor, bg, sessions };
    const next = [...schedHosts, newHost];
    setSchedHosts(next);
    setSchedNewName(""); setSchedNewSessions("2,2");
    try { await safeSet(SCHEDULE_HOSTS_KEY, next); showToast("success", `Host "${name}" ditambahkan ke jadwal.`); }
    catch (e) { showToast("error", `Gagal: ${e.message}`); }
  };

  const removeSchedHost = async (id) => {
    if (!isAdmin) return;
    const next = schedHosts.filter((h) => h.id !== id);
    setSchedHosts(next);
    try { await safeSet(SCHEDULE_HOSTS_KEY, next); showToast("success", "Host dihapus."); }
    catch (e) { showToast("error", `Gagal: ${e.message}`); }
  };

  // Cek apakah sesi live aktual (dari liveSessions) cocok dengan jadwal yang direncanakan.
  // "Sesuai" = nama host sama, tanggal sama, dan ada irisan waktu antara jadwal & aktual.
  const checkSchedCompliance = useCallback((hostName, dateStr, scheduledStarts, sessionDurations) => {
    if (!scheduledStarts?.length) return null;
    // Ambil semua sesi live aktual host ini di tanggal itu
    const actualSessions = liveSessions.filter((s) =>
      s.date === dateStr &&
      s.hostName?.toLowerCase().trim() === hostName?.toLowerCase().trim()
    );

    const totalSchedHours = scheduledStarts.reduce((s, st, si) => st != null ? s + (sessionDurations[si] || 2) : s, 0);
    const totalActualHours = actualSessions.reduce((s, m) => s + (calcLiveHours(m.startTime, m.endTime) || 0), 0);
    const totalActualGmv = actualSessions.reduce((s, m) => s + (m.directGmv || 0), 0);

    if (!scheduledStarts?.length) return null;
    if (!actualSessions.length) return { status: "absent", totalSchedHours, totalActualHours: 0, totalActualGmv: 0, detail: "Tidak live" };

    // Evaluasi tiap sesi yang dijadwalkan
    const sessionResults = scheduledStarts.map((start, si) => {
      if (start == null) return { status: "unset" };
      const dur = sessionDurations[si] || 2;
      const schedEnd = start + dur;

      // Cari sesi aktual yang paling banyak overlap dengan jadwal ini
      let bestMatch = null, bestOverlap = 0;
      actualSessions.forEach((m) => {
        const aS = m.startTime ? parseInt(m.startTime.split(":")[0]) : null;
        const aE = m.endTime   ? parseInt(m.endTime.split(":")[0])   : null;
        if (aS === null || aE === null) return;
        const overlapH = Math.max(0, Math.min(aE, schedEnd) - Math.max(aS, start));
        if (overlapH > bestOverlap) { bestOverlap = overlapH; bestMatch = m; }
      });

      const schedLabel = `${String(start).padStart(2,"0")}:00–${String(schedEnd).padStart(2,"00")}:00`;

      if (bestMatch && bestOverlap > 0) {
        const aS = parseInt(bestMatch.startTime.split(":")[0]);
        const aE = parseInt(bestMatch.endTime.split(":")[0]);
        const actualDur = aE - aS;
        const actualLabel = `${String(aS).padStart(2,"0")}:00–${String(aE).padStart(2,"00")}:00`;
        const overlapPct = bestOverlap / dur;
        // Sesuai: overlap ≥ 70% jadwal dan durasi aktual ≥ 80% jadwal
        if (overlapPct >= 0.7 && actualDur >= dur * 0.8) {
          return { status: "on_time", schedLabel, actualLabel, dur, actualDur };
        }
        // Live ada overlap tapi durasi kurang (live lebih pendek dari jadwal)
        if (overlapPct >= 0.4) {
          return { status: "short", schedLabel, actualLabel, dur, actualDur, detail: `Live ${actualDur}j dari ${dur}j terjadwal` };
        }
      }

      // Tidak ada overlap — cek apakah ada live di waktu lain (wrong_time)
      const anyLive = actualSessions.find((m) => {
        const aS = m.startTime ? parseInt(m.startTime.split(":")[0]) : null;
        const aE = m.endTime   ? parseInt(m.endTime.split(":")[0])   : null;
        return aS !== null && aE !== null;
      });
      if (anyLive) {
        const aS = parseInt(anyLive.startTime.split(":")[0]);
        const aE = parseInt(anyLive.endTime.split(":")[0]);
        const actualLabel = `${String(aS).padStart(2,"0")}:00–${String(aE).padStart(2,"00")}:00`;
        return { status: "wrong_time", schedLabel, actualLabel, dur, actualDur: aE - aS, detail: `Jadwal ${schedLabel} → live ${actualLabel}` };
      }

      return { status: "missed", schedLabel, dur, detail: `Jadwal ${schedLabel} tidak terlaksana` };
    });

    const validResults = sessionResults.filter((r) => r.status !== "unset");
    const allOnTime    = validResults.every((r) => r.status === "on_time");
    const allMissed    = validResults.every((r) => r.status === "missed");
    const hasWrongTime = validResults.some((r)  => r.status === "wrong_time");
    const hasShort     = validResults.some((r)  => r.status === "short");
    const anyOnTime    = validResults.some((r)  => r.status === "on_time");

    let overallStatus;
    if (allOnTime)    overallStatus = "on_time";
    else if (allMissed) overallStatus = "missed";
    else if (hasWrongTime && !anyOnTime && !hasShort) overallStatus = "wrong_time";
    else if (hasShort && !anyOnTime && !hasWrongTime) overallStatus = "short";
    else overallStatus = "partial";

    // Bangun keterangan ringkas untuk kolom tabel
    let detail = "";
    const hourDiff = totalActualHours - totalSchedHours;
    if (overallStatus === "on_time") {
      detail = `✓ Sesuai`;
    } else if (overallStatus === "wrong_time") {
      detail = `⚠ Tidak sesuai jadwal${totalActualGmv > 0 ? " (ada GMV)" : ""}`;
      // Tampilkan detail jam dari sesi pertama yang wrong_time
      const wt = validResults.find((r) => r.status === "wrong_time");
      if (wt) detail += `\n${wt.detail}`;
    } else if (overallStatus === "short") {
      detail = `⏱ Live ${totalActualHours.toFixed(1)}j dari ${totalSchedHours.toFixed(1)}j terjadwal`;
    } else if (overallStatus === "partial") {
      detail = `~ Sebagian sesuai`;
      if (totalActualHours > 0 && Math.abs(hourDiff) >= 0.5) {
        detail += `\nLive ${totalActualHours.toFixed(1)}j dari ${totalSchedHours.toFixed(1)}j`;
      }
      const wt = validResults.find((r) => r.status === "wrong_time");
      if (wt) detail += `\n${wt.detail}`;
    } else {
      detail = `✗ Tidak live`;
    }

    return { status: overallStatus, sessions: sessionResults, totalActualGmv, totalSchedHours, totalActualHours, detail };
  }, [liveSessions]);

  const saveAccountsAndBenchmarks = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      setAccounts(accountDraft);
      setBenchmarks(benchmarkDraft);
      await persist(CFG_KEY, { accounts: accountDraft, benchmarks: benchmarkDraft });
      setSaving(false);
      showToast("success", "Nama akun & benchmark berhasil disimpan.");
    } catch (e) {
      setSaving(false);
      showToast("error", `Gagal menyimpan: ${e.message || "cek koneksi / izin akun"}.`);
    }
  };
  const fillFullShopNames = () => {
    setAccountDraft((prev) => prev.map((a) => ({ ...a, name: FULL_SHOP_NAMES[a.id] || a.name })));
  };

  /* ---------- handlers: rekap tahunan & hapus data ---------- */
  const yearsWithData = useMemo(() => {
    const ys = new Set();
    Object.keys(entries).forEach((d) => ys.add(d.slice(0, 4)));
    Object.keys(targets).forEach((m) => ys.add(m.slice(0, 4)));
    ys.add(String(new Date().getFullYear()));
    return Array.from(ys).sort().reverse();
  }, [entries, targets]);

  const exportYearlyRecap = async (year) => {
    if (!isAdmin) return;
    const summaryRows = [];
    for (let m = 1; m <= 12; m++) {
      const ymStr = `${year}-${pad(m)}`;
      const dim = daysInMonthOf(ymStr);
      const datesInMonth = Array.from({ length: dim }, (_, i) => `${ymStr}-${pad(i + 1)}`);
      let monthTotalGmv = 0, monthTotalTarget = 0;
      accounts.forEach((acc) => {
        const target = targets[ymStr]?.[acc.id] || 0;
        const gmv = sumField(entries, datesInMonth, acc.id, "gmv");
        monthTotalGmv += gmv; monthTotalTarget += target;
        summaryRows.push({
          Bulan: monthLabel(ymStr), Akun: acc.name, Platform: acc.platform === "shopee" ? "Shopee" : "TikTok Shop",
          Target: target, "GMV Realisasi": gmv, "% Tercapai": target ? Math.round((gmv / target) * 1000) / 10 : "",
        });
      });
      summaryRows.push({
        Bulan: monthLabel(ymStr), Akun: "TOTAL SEMUA AKUN", Platform: "",
        Target: monthTotalTarget, "GMV Realisasi": monthTotalGmv, "% Tercapai": monthTotalTarget ? Math.round((monthTotalGmv / monthTotalTarget) * 1000) / 10 : "",
      });
    }

    const dailyRows = [];
    Object.keys(entries).filter((d) => d.startsWith(`${year}-`)).sort().forEach((date) => {
      accounts.forEach((acc) => {
        const e = entries[date]?.[acc.id];
        if (!e) return;
        dailyRows.push({
          Tanggal: date, Akun: acc.name, Platform: acc.platform === "shopee" ? "Shopee" : "TikTok Shop",
          GMV: e.gmv ?? "", Video: e.video ?? "", "Video Affiliate": e.videoAffiliate ?? "",
          "Live Penjual": e.livePenjual ?? "", "Live Affiliate": e.liveAffiliate ?? "", "Kartu Produk": e.kartuProduk ?? "",
          Orders: e.orders ?? "", Visitors: e.visitors ?? "", "Ad Spend": e.adSpend ?? "", "Ad Revenue": e.adRevenue ?? "",
        });
      });
    });

    const revisionRows = revisions.filter((r) => r.date.startsWith(`${year}-`)).map((r) => ({
      "Tanggal Data": r.date, Akun: r.accountName,
      "Waktu Revisi": new Date(r.timestamp).toLocaleString("id-ID"),
      Jenis: r.isRestore ? "Pemulihan" : "Revisi",
      Perubahan: r.diffs.map((d) => `${d.label}: ${fmtFieldVal(d.field, d.oldVal)} -> ${fmtFieldVal(d.field, d.newVal)}`).join("; "),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Ringkasan Tahunan");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyRows), "Detail Harian");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(revisionRows.length ? revisionRows : [{ Catatan: "Tidak ada revisi tercatat di tahun ini" }]), "Riwayat Revisi");

    try {
      XLSX.writeFile(wb, `Rekap-GMV-${year}.xlsx`);
      const updatedExported = { ...exportedYears, [year]: Date.now() };
      setExportedYears(updatedExported);
      await persist(EXPORTED_YEARS_KEY, updatedExported);
      showToast("success", `Rekap ${year} berhasil diexport.`);
    } catch (e) {
      showToast("error", `Export gagal: ${e.message || "coba lagi"}.`);
    }
  };

  const clearYearEntries = async (year) => {
    if (!isAdmin) return;
    const exported = exportedYears[year];
    const warningPrefix = exported
      ? `Tahun ${year} sudah pernah diexport ke Excel (${new Date(exported).toLocaleString("id-ID")}).`
      : `PERINGATAN: Tahun ${year} BELUM PERNAH diexport ke Excel — data yang dihapus tidak akan ada cadangannya kalau lanjut.`;
    if (!window.confirm(`${warningPrefix}\n\nHapus SEMUA data input (harian) untuk seluruh tahun ${year}? Target bulanan dan riwayat revisi tahun ini tidak ikut terhapus. Tindakan ini tidak bisa dibatalkan.`)) return;
    setSaving(true);
    const prevEntries = entries;
    const next = { ...entries };
    const toDelete = [];
    Object.keys(next).forEach((d) => {
      if (d.startsWith(`${year}-`)) {
        Object.keys(next[d]).forEach((accId) => toDelete.push({ accId, date: d }));
        delete next[d];
      }
    });
    setEntries(next);
    try {
      await Promise.all(toDelete.map((t) => deleteEntryDay(t.accId, t.date)));
      setSaving(false);
      showToast("success", `Data tahun ${year} berhasil dihapus.`);
    } catch (e) {
      setSaving(false);
      setEntries(prevEntries);
      showToast("error", `Gagal menghapus: ${e.message || "cek koneksi / izin akun"}.`);
    }
  };

  const clearMonthEntries = async () => {
    if (!isAdmin) return;
    if (!window.confirm(`Hapus semua data input untuk ${monthLabel(selectedMonth)}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setSaving(true);
    const prevEntries = entries;
    const next = { ...entries };
    const toDelete = [];
    Object.keys(next).forEach((d) => {
      if (d.startsWith(selectedMonth)) {
        Object.keys(next[d]).forEach((accId) => toDelete.push({ accId, date: d }));
        delete next[d];
      }
    });
    setEntries(next);
    try {
      await Promise.all(toDelete.map((t) => deleteEntryDay(t.accId, t.date)));
      setSaving(false);
      showToast("success", `Data ${monthLabel(selectedMonth)} berhasil dihapus.`);
    } catch (e) {
      setSaving(false);
      setEntries(prevEntries);
      showToast("error", `Gagal menghapus: ${e.message || "cek koneksi / izin akun"}.`);
    }
  };

  const migrateLegacyData = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Ini membaca data lama (sebelum sistem multi-akun) dan menyalinnya ke struktur baru per-akun. Aman dijalankan berkali-kali — data yang sudah ada di struktur baru akan ditimpa dengan versi yang sama (tidak akan dobel). Lanjutkan?")) return;
    setSaving(true);
    try {
      const [oldEntries, oldTargets, oldRevisions] = await Promise.all([
        safeGet("gmv-dashboard-entries-v1", null),
        safeGet("gmv-dashboard-targets-v1", null),
        safeGet("gmv-dashboard-revisions-v1", null),
      ]);

      if (oldEntries) {
        const writes = [];
        Object.entries(oldEntries).forEach(([date, dayData]) => {
          Object.entries(dayData).forEach(([accId, row]) => writes.push(saveEntryDay(accId, date, row)));
        });
        await Promise.all(writes);
      }
      if (oldTargets) {
        const writes = [];
        Object.entries(oldTargets).forEach(([ymStr, accMap]) => {
          Object.entries(accMap).forEach(([accId, value]) => writes.push(saveTargetMonth(accId, ymStr, value)));
        });
        await Promise.all(writes);
      }
      if (oldRevisions && Array.isArray(oldRevisions)) {
        await Promise.all(oldRevisions.map((r) => addRevisionRecord(r)));
      }

      const accountIds = accounts.map((a) => a.id);
      const [ent, tgt, rev] = await Promise.all([fetchAllEntries(accountIds), fetchAllTargets(accountIds), fetchAllRevisions()]);
      setEntries(ent); setTargets(tgt); setRevisions(rev);
      window.alert("Migrasi selesai. Data lama sudah tersalin ke struktur baru.");
      showToast("success", "Migrasi data lama berhasil.");
    } catch (e) {
      window.alert("Migrasi gagal: " + e.message);
      showToast("error", `Migrasi gagal: ${e.message || "cek koneksi / izin akun"}.`);
    }
    setSaving(false);
  };

  const importJune2026 = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Ini akan menimpa nama akun, target Juni 2026, dan data GMV harian 1\u201317 Juni 2026 dengan data dari Google Sheets EC PLAN. Data lain (bulan lain, hari 18+) tidak akan terhapus. Lanjutkan?")) return;
    setSaving(true);
    try {
      const newAccounts = accounts.map((a) => ({ ...a, name: IMPORT_2026_06.names[a.id] || a.name }));
      setAccounts(newAccounts);
      setAccountDraft(newAccounts);
      await safeSet(CFG_KEY, { accounts: newAccounts, benchmarks });

      const newTargets = { ...targets, "2026-06": { ...(targets["2026-06"] || {}), ...IMPORT_2026_06.targets } };
      setTargets(newTargets);
      await Promise.all(Object.entries(IMPORT_2026_06.targets).map(([accId, value]) => saveTargetMonth(accId, "2026-06", value)));

      const newEntries = { ...entries };
      const entryWrites = [];
      Object.entries(IMPORT_2026_06.daily).forEach(([date, vals]) => {
        newEntries[date] = { ...newEntries[date] };
        Object.entries(vals).forEach(([accId, gmv]) => {
          const row = { ...newEntries[date][accId], gmv };
          newEntries[date][accId] = row;
          entryWrites.push({ accId, date, row });
        });
      });
      setEntries(newEntries);
      await Promise.all(entryWrites.map((w) => saveEntryDay(w.accId, w.date, w.row)));

      setSaving(false);
      setSelectedMonth("2026-06");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
      showToast("success", "Import data Juni 2026 berhasil.");
    } catch (e) {
      setSaving(false);
      showToast("error", `Import gagal: ${e.message || "cek koneksi / izin akun"}.`);
    }
  };

  const monthOptions = useMemo(() => genMonthOptions(entries, targets, liveSessions), [entries, targets, liveSessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" style={{ background: PALETTE.bg }}>
        <Loader2 className="animate-spin" size={28} style={{ color: PALETTE.teal }} />
      </div>
    );
  }

  return (
    <div style={{ background: PALETTE.bg, fontFamily: "'Plus Jakarta Sans', sans-serif", color: PALETTE.ink, minHeight: "100%", position: "relative", overflow: "hidden" }} className="p-4 sm:p-6">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');`}</style>

      {/* ambient glow blobs — suasana "hidup" di latar, tidak mengganggu keterbacaan konten */}
      <div className="pointer-events-none absolute" style={{ top: -120, right: -100, width: 440, height: 440, borderRadius: "9999px", background: `radial-gradient(circle, ${PALETTE.brand}2e 0%, transparent 70%)`, filter: "blur(20px)" }} />
      <div className="pointer-events-none absolute" style={{ top: 280, left: -140, width: 400, height: 400, borderRadius: "9999px", background: `radial-gradient(circle, ${PALETTE.brand2}26 0%, transparent 70%)`, filter: "blur(20px)" }} />
      <div className="pointer-events-none absolute" style={{ bottom: -160, right: 120, width: 360, height: 360, borderRadius: "9999px", background: `radial-gradient(circle, ${PALETTE.ochre}22 0%, transparent 70%)`, filter: "blur(20px)" }} />

      <div style={{ position: "relative", zIndex: 1 }}>

      {/* toast notifikasi sukses/gagal — fixed di atas, selalu kelihatan di mana pun posisi scroll */}
      {toast && (
        <div
          className="fixed left-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg"
          style={{
            top: 16, transform: "translateX(-50%)", maxWidth: "min(92vw, 420px)",
            background: toast.type === "success" ? PALETTE.tealDeep : PALETTE.coralDeep,
            color: "#fff", boxShadow: glow(toast.type === "success" ? PALETTE.teal : PALETTE.coral, 0.35),
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} className="shrink-0" /> : <XCircle size={18} className="shrink-0" />}
          <span className="text-sm font-medium leading-snug">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-1 shrink-0 opacity-80 hover:opacity-100" style={{ fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {!storageOk && (
        <div className="mb-4 px-3 py-2 rounded text-xs" style={{ background: PALETTE.coralSoft, color: PALETTE.coral }}>
          Penyimpanan tidak tersedia di sesi ini — perubahan tidak akan tersimpan permanen.
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-0.5" style={{ color: PALETTE.brand }}>Console Performa Toko</div>
          <h1 className="text-xl sm:text-2xl font-extrabold" style={{ fontFamily: "'Sora', sans-serif", ...gradientText(PALETTE.brand, PALETTE.brand2) }}>GMV Tracker — 6 TikTok Shop + Shopee</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {saving && <span className="text-xs flex items-center gap-1" style={{ color: PALETTE.inkSoft }}><Loader2 size={12} className="animate-spin" />Menyimpan…</span>}

          {/* toggle mode periode — cuma relevan untuk tab Ringkasan dan Sumber GMV */}
          {(tab === "overview" || tab === "sumber" || tab === "iklan") && (
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: PALETTE.line }}>
              {[["month", "Bulanan"], ["day", "Harian"], ["custom", "Custom"]].map(([mode, label]) => (
                <button key={mode} onClick={() => {
                  setPeriodMode(mode);
                  if (mode === "day") {
                    setSelectedDate(todayStr());
                    setSelectedMonth(todayStr().slice(0, 7));
                  } else if (mode === "custom") {
                    setCustomStartDate(todayStr());
                    setCustomEndDate(todayStr());
                  }
                }}
                  className="text-xs px-3 py-1.5 font-semibold transition-all"
                  style={{ background: periodMode === mode ? `linear-gradient(135deg, ${PALETTE.brand}, ${PALETTE.brand2})` : PALETTE.panel, color: periodMode === mode ? "#fff" : PALETTE.inkSoft }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* selector periode: month picker / date picker / custom range sesuai mode */}
          {!(tab === "overview" || tab === "sumber" || tab === "iklan") || periodMode === "month" ? (
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border outline-none" style={{ borderColor: PALETTE.line, background: PALETTE.panel, boxShadow: cardShadow }}>
              {monthOptions.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}{m === todayYM() ? " (Bulan Ini)" : ""}</option>
              ))}
            </select>
          ) : periodMode === "day" ? (
            <input type="date" value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setSelectedMonth(e.target.value.slice(0, 7)); }}
              className="text-sm px-3 py-1.5 rounded-lg border outline-none" style={{ borderColor: PALETTE.line, background: PALETTE.panel, boxShadow: cardShadow }} />
          ) : (
            <DateRangePicker
              startDate={customStartDate}
              endDate={customEndDate}
              accentColor={PALETTE.brand}
              onApply={(s, e) => { setCustomStartDate(s); setCustomEndDate(e); }}
            />
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1.5 mb-5 p-1 rounded-xl flex-wrap" style={{ background: PALETTE.panelAlt, width: "fit-content" }}>
        {[["overview", "Ringkasan"], ["input", "Input Data"], ["sumber", "Sumber GMV"], ["iklan", "Performa Iklan"], ["live", "Live Tracker"], ["jadwal", "Jadwal Live"], ["settings", "Target & Akun"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5"
            style={tab === key
              ? (key === "live"
                  ? { background: `linear-gradient(135deg, ${LIVE_ACCENT}, ${LIVE_ACCENT_DEEP})`, color: "#fff", boxShadow: glow(LIVE_ACCENT, 0.28) }
                  : key === "jadwal"
                  ? { background: `linear-gradient(135deg, ${SCHED_ACCENT}, ${SCHED_DEEP})`, color: "#fff", boxShadow: glow(SCHED_ACCENT, 0.28) }
                  : { background: `linear-gradient(135deg, ${PALETTE.brand}, ${PALETTE.brand2})`, color: "#fff", boxShadow: glow(PALETTE.brand, 0.28) })
              : { background: "transparent", color: PALETTE.inkSoft }}>
            {key === "live" && <Radio size={14} />}
            {key === "jadwal" && <Calendar size={14} />}
            {label}
          </button>
        ))}
      </div>

      {/* ===================== OVERVIEW ===================== */}
      {tab === "overview" && (
        <div className="space-y-5">
          {overview.totalTarget === 0 && (
            <Card><div className="flex items-center gap-2 text-sm" style={{ color: PALETTE.inkSoft }}>
              <Info size={16} />Belum ada target yang diset untuk {periodLabel}. Atur di tab <b className="mx-1">Target & Akun</b> agar progress & status bisa dihitung.
            </div></Card>
          )}

          {/* hero stats */}
          {periodMode === "day" || periodMode === "custom" ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card accent={PALETTE.brand} className="flex flex-col justify-between">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>{periodMode === "day" ? "GMV Hari Ini" : "GMV Periode Ini"}</div>
                <div className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", ...gradientText(PALETTE.brand, PALETTE.brand2) }}>{fmtCompactRp(overview.totalMtd)}</div>
                <div className="text-xs mt-1" style={{ color: PALETTE.inkSoft }}>{periodMode === "day" ? new Date(selectedDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" }) : periodLabel}</div>
              </Card>
              <Card accent={PALETTE.ochre} className="flex flex-col justify-between">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>{periodMode === "day" ? "GMV Kemarin" : "GMV Periode Sebelumnya"}</div>
                <div className="text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(overview.lastMonthMtd)}</div>
                <div className="text-xs mt-1" style={{ color: PALETTE.inkSoft }}>{periodMode === "day" ? new Date(ymd(addDays(new Date(selectedDate), -1))).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" }) : `${viewDates.length} hari sebelum ${periodLabel}`}</div>
              </Card>
              <Card accent={overview.mtdVsLastMonth !== null && overview.mtdVsLastMonth >= 0 ? PALETTE.teal : PALETTE.coral} className="flex flex-col justify-between">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>{periodMode === "day" ? "Hari Ini vs Kemarin" : "Periode Ini vs Sebelumnya"}</div>
                <DeltaBadge value={overview.mtdVsLastMonth} size="text-2xl" />
                <div className="text-xs mt-1" style={{ color: PALETTE.inkSoft }}>{overview.mtdVsLastMonth === null ? "Belum ada data pembanding" : overview.mtdVsLastMonth >= 0 ? "Lebih baik" : "Di bawah periode sebelumnya"}</div>
              </Card>
              <Card accent={PALETTE.plum} className="flex flex-col justify-between">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Total Orderan</div>
                <div className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{overview.hasOrdersData ? fmtNum(overview.totalOrders) : "—"}</div>
                <div className="text-xs mt-1" style={{ color: PALETTE.inkSoft }}>{overview.hasOrdersData && overview.lastMonthOrders > 0 ? `sebelumnya: ${fmtNum(overview.lastMonthOrders)}` : "order pada periode ini"}</div>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card accent={PALETTE.brand} className="flex flex-col justify-between">
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>GMV Bulan Ini ({monthMeta.elapsed} hari)</div>
              <div className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", ...gradientText(PALETTE.brand, PALETTE.brand2) }}>{fmtCompactRp(overview.totalMtd)}</div>
              <div className="text-xs mt-1" style={{ color: PALETTE.inkSoft }}>dari target {fmtCompactRp(overview.totalTarget)}</div>
            </Card>
            <Card accent={PALETTE.ochre} className="flex flex-col justify-between">
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Time Gone</div>
              <div className="text-2xl font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(overview.timeGonePercent)}%</div>
              <div className="text-xs mt-1" style={{ color: PALETTE.inkSoft }}>{monthMeta.elapsed} dari {monthMeta.dim} hari berjalan</div>
            </Card>
            <Card accent={STATUS_META[overview.totalStatus]?.color} className="flex flex-col items-center justify-center text-center">
              <Dial percent={overview.pencapaianPercentOverall} color={STATUS_META[overview.totalStatus]?.color} label="Tercapai dari Target" />
              {overview.paceDiff !== null && (
                <div className="text-[11px] mt-2" style={{ color: overview.paceDiff >= 0 ? PALETTE.teal : PALETTE.coral }}>
                  {overview.paceDiff >= 0 ? "+" : ""}{overview.paceDiff.toFixed(1)} poin vs Time Gone — {overview.paceDiff >= 0 ? "lebih cepat dari jadwal" : "lebih lambat dari jadwal"}
                </div>
              )}
            </Card>
            <Card accent={PALETTE.plum} className="flex flex-col justify-between">
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Proyeksi Akhir Bulan</div>
              <div className="text-2xl font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(overview.totalProjected)}</div>
              <div className="mt-2"><StatusPill status={overview.totalStatus} /></div>
            </Card>
            <Card className="flex flex-col justify-between">
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Rata-rata Harian</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(overview.avgPace)}</span>
                <span className="text-xs" style={{ color: PALETTE.inkSoft }}>aktual/hari</span>
              </div>
              {overview.requiredRate !== null && (
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-lg font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: overview.requiredRate > overview.avgPace ? PALETTE.coral : PALETTE.teal }}>{fmtCompactRp(overview.requiredRate)}</span>
                  <span className="text-xs" style={{ color: PALETTE.inkSoft }}>perlu/hari ({overview.remaining} hari sisa)</span>
                </div>
              )}
            </Card>
            <Card accent={PALETTE.coral} className="flex flex-col justify-between">
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Pencapaian Hari Ini <span className="normal-case font-normal" style={{ color: PALETTE.inkFaint }}>({todayStr()})</span></div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{overview.pencapaianHariIniTotal !== null ? `${Math.round(overview.pencapaianHariIniTotal)}%` : "—"}</span>
                <span className="text-xs" style={{ color: PALETTE.inkSoft }}>dari target harian</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-xs" style={{ color: PALETTE.inkSoft }}>vs kemarin ({overview.pencapaianKemarinTotal !== null ? `${Math.round(overview.pencapaianKemarinTotal)}%` : "—"}):</span>
                <PointDeltaBadge value={overview.achievementDiffPtsTotal} />
              </div>
            </Card>
          </div>
          )} {/* end mode bulanan grid */}

          {/* card perbandingan periode sebelumnya — khusus mode bulanan (mode hari/custom sudah
              tercakup di hero stats 4-kartu di atas, jadi tidak perlu duplikat info) */}
          {periodMode === "month" && (
          <Card accent={PALETTE.plum} className="sm:col-span-2 lg:col-span-3 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>
                  GMV Bulan Lalu{" "}
                  <span className="normal-case font-normal">({monthLabel(overview.lastMonthYM)})</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(overview.lastMonthMtd)}</span>
                  <span className="text-xs" style={{ color: PALETTE.inkSoft }}>dari target {fmtCompactRp(overview.lastMonthTarget)}</span>
                </div>
                {overview.lastMonthPct !== null && (
                  <div className="text-xs mt-0.5" style={{ color: PALETTE.inkSoft }}>Pencapaian: <b style={{ color: PALETTE.ink }}>{Math.round(overview.lastMonthPct)}%</b> dari target</div>
                )}
              </div>
              <div className="h-px sm:h-12 sm:w-px w-full" style={{ background: PALETTE.line }} />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>GMV Bulan Ini vs Bulan Lalu</div>
                <div className="flex items-baseline gap-2">
                  <DeltaBadge value={overview.mtdVsLastMonth} size="text-xl" />
                  <span className="text-xs" style={{ color: PALETTE.inkSoft }}>{fmtCompactRp(overview.totalMtd)} vs {fmtCompactRp(overview.lastMonthMtd)}</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: PALETTE.inkSoft }}>
                  {overview.mtdVsLastMonth === null ? "Belum ada data bulan lalu" : overview.mtdVsLastMonth >= 0 ? "Lebih baik dari periode sebelumnya" : "Di bawah periode sebelumnya"}
                </div>
              </div>
              <div className="h-px sm:h-12 sm:w-px w-full" style={{ background: PALETTE.line }} />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Total Orderan Bulan Ini</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {overview.hasOrdersData ? fmtNum(overview.totalOrders) : "—"}
                  </span>
                  <span className="text-xs" style={{ color: PALETTE.inkSoft }}>order</span>
                </div>
                {overview.hasOrdersData && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs" style={{ color: PALETTE.inkSoft }}>vs bulan lalu ({fmtNum(overview.lastMonthOrders)}):</span>
                    <DeltaBadge value={overview.ordersVsLast} size="text-xs" />
                  </div>
                )}
                {!overview.hasOrdersData && (
                  <div className="text-xs mt-0.5" style={{ color: PALETTE.inkFaint }}>Isi field "Orders" di Form Harian</div>
                )}
              </div>
            </Card>
          )}

          {/* leaderboard ranking pencapaian toko — disembunyikan khusus mode custom */}
          {periodMode !== "custom" && (
          <Card>
            <SectionTitle eyebrow={`${periodLabel} \u2022 Urut % Target ${periodMode !== "month" ? "Proporsional" : ""}`} title="Ranking Pencapaian Toko" />
            <div className="space-y-2.5">
              {(periodMode !== "month" ? [...overview.perAccount].sort((a, b) => {
                // mode hari/custom: ranking berdasarkan GMV periode ini vs target proporsional
                // (target bulanan ÷ jumlah hari sebulan × jumlah hari di periode yang dipilih)
                const dim = monthMeta.dim || 30;
                const aGmv = sumField(entries, viewDates, a.id, "gmv");
                const bGmv = sumField(entries, viewDates, b.id, "gmv");
                const aPeriodTarget = a.target > 0 ? (a.target / dim) * viewDates.length : 0;
                const bPeriodTarget = b.target > 0 ? (b.target / dim) * viewDates.length : 0;
                const aPct = aPeriodTarget > 0 ? aGmv / aPeriodTarget : 0;
                const bPct = bPeriodTarget > 0 ? bGmv / bPeriodTarget : 0;
                if ((aPeriodTarget > 0) !== (bPeriodTarget > 0)) return aPeriodTarget > 0 ? -1 : 1;
                if (bPct !== aPct) return bPct - aPct;
                return bGmv - aGmv;
              }) : ranking).map((acc, idx) => {
                const [bandFrom, bandTo] = rankBandColors(idx);
                const dim = monthMeta.dim || 30;
                const periodGmv = periodMode !== "month" ? sumField(entries, viewDates, acc.id, "gmv") : null;
                const periodTarget = acc.target > 0 ? (acc.target / dim) * viewDates.length : 0;
                const periodPct = periodTarget > 0 && periodGmv !== null ? (periodGmv / periodTarget) * 100 : null;
                const hasTarget = acc.target > 0;
                return (
                  <div key={acc.id} className="flex items-stretch rounded-xl overflow-hidden" style={{ boxShadow: cardShadow }}>
                    <div className="flex items-center gap-2 px-3 py-3 shrink-0 w-32 sm:w-44" style={{ background: PALETTE.panel, borderTop: `1px solid ${PALETTE.line}`, borderBottom: `1px solid ${PALETTE.line}`, borderLeft: `1px solid ${PALETTE.line}` }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: acc.color }} />
                      <span className="text-xs sm:text-sm font-bold truncate">{acc.name}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-3 px-4 py-3" style={{ background: `linear-gradient(110deg, ${bandFrom}, ${bandTo})` }}>
                      <div className="flex items-center gap-2 shrink-0">
                        {idx === 0 ? <Trophy size={22} className="text-white drop-shadow" /> : idx <= 2 ? <Medal size={20} className="text-white/90" /> : null}
                        <span className="text-white/85 text-[10px] sm:text-xs font-bold uppercase tracking-wide">Rank</span>
                        <span className="text-white font-black text-2xl sm:text-3xl leading-none" style={{ fontFamily: "'Sora', sans-serif", textShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>{idx + 1}</span>
                      </div>
                      <div className="text-right">
                        {periodMode !== "month" ? (
                          <>
                            <div className="text-white font-extrabold text-lg sm:text-xl leading-none" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{periodPct !== null ? `${Math.round(periodPct)}%` : fmtCompactRp(periodGmv)}</div>
                            <div className="text-white/80 text-[10px] sm:text-[11px] mt-0.5">
                              {fmtCompactRp(periodGmv)} / {periodTarget > 0 ? fmtCompactRp(periodTarget) : "—"}
                            </div>
                          </>
                        ) : hasTarget ? (
                          <>
                            <div className="text-white font-extrabold text-lg sm:text-xl leading-none" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(acc.pctTarget)}%</div>
                            <div className="text-white/80 text-[10px] sm:text-[11px] mt-0.5">{fmtCompactRp(acc.mtd)} / {fmtCompactRp(acc.target)}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-white font-extrabold text-lg sm:text-xl leading-none" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(acc.mtd)}</div>
                            <div className="text-white/80 text-[10px] sm:text-[11px] mt-0.5">Target belum diset</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-[11px] mt-3" style={{ color: PALETTE.inkFaint }}>
              {periodMode !== "month" ? `Ranking berdasarkan % GMV periode ini vs target proporsional (target bulanan ÷ ${monthMeta.dim} hari × ${viewDates.length} hari di periode ini). Toko tanpa target diurutkan berdasarkan GMV mentah.` : "Diurutkan dari % pencapaian target MTD tertinggi. Toko tanpa target disusun di bawah berdasarkan GMV mentah."}
            </div>
          </Card>
          )}

          {/* day-over-day */}
          <Card>
            <SectionTitle eyebrow={periodMode === "month" ? "Update Hari Ini" : `Data untuk ${new Date(overview.refDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`} title="Perbandingan Harian" />
            <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>
              {periodMode === "month"
                ? <>"Hari Ini" di bawah ini merujuk ke <b>{todayLabelLong()}</b> (H-1 dari tanggal kalender asli) — data marketplace baru final keesokan harinya, jadi "Kemarin" = {new Date(addDays(effectiveToday(), -1)).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} dan seterusnya bergeser satu hari.</>
                : <>Tabel di bawah ini mengikuti tanggal yang kamu pilih di atas: <b>{new Date(overview.refDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</b> — "Kemarin" = sehari sebelum tanggal itu, "Minggu Lalu" = 7 hari sebelumnya.</>}
            </div>
            <div className="flex flex-wrap gap-6 mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>GMV Hari Ini (Semua Akun)</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{overview.todayTotal !== null ? fmtCompactRp(overview.todayTotal) : "Belum diinput"}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>vs Kemarin</div>
                <DeltaBadge value={overview.dDoDTotal} size="text-base" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>vs Hari yang Sama Minggu Lalu</div>
                <DeltaBadge value={overview.dWoWTotal} size="text-base" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="text-left" style={{ color: PALETTE.inkSoft }}>
                    <th className="font-medium py-1.5 pr-3">Akun</th>
                    <th className="font-medium py-1.5 pr-3">Hari Ini</th>
                    <th className="font-medium py-1.5 pr-3">vs Kemarin</th>
                    <th className="font-medium py-1.5 pr-3">vs Minggu Lalu</th>
                    <th className="font-medium py-1.5 pr-3">Pencapaian Hari Ini</th>
                    <th className="font-medium py-1.5 pr-3">MTD</th>
                    <th className="font-medium py-1.5 pr-3">% Target</th>
                    <th className="font-medium py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.perAccount.map((a) => (
                    <tr key={a.id} className="border-t" style={{ borderColor: PALETTE.line }}>
                      <td className="py-2 pr-3"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: a.color }} />{a.name}<PlatformTag platform={a.platform} /></div></td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.todayGmv !== undefined ? fmtCompactRp(a.todayGmv) : "—"}</td>
                      <td className="py-2 pr-3"><DeltaBadge value={a.dDoD} /></td>
                      <td className="py-2 pr-3"><DeltaBadge value={a.dWoW} /></td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.pencapaianHariIni !== null ? `${Math.round(a.pencapaianHariIni)}%` : "—"}</span>
                          <PointDeltaBadge value={a.achievementDiffPts} />
                        </div>
                      </td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(a.mtd)}</td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.pctTarget !== null ? `${Math.round(a.pctTarget)}%` : "—"}</td>
                      <td className="py-2"><StatusPill status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* rating */}
          <Card accent={PALETTE.brand2}>
            <SectionTitle eyebrow={periodMode === "month" ? "Update Hari Ini" : new Date(overview.refDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} title="Rating Toko" />
            <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>Angka snapshot (bukan akumulasi harian) — yang dibandingkan adalah nilai hari ini vs persis nilai kemarin.</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[360px]">
                <thead>
                  <tr className="text-left" style={{ color: PALETTE.inkSoft }}>
                    <th className="font-medium py-1.5 pr-3">Akun</th>
                    <th className="font-medium py-1.5 pr-3">Rating Hari Ini</th>
                    <th className="font-medium py-1.5">vs Kemarin</th>
                  </tr>
                </thead>
                <tbody>
                  {growthMetrics.map((a) => (
                    <tr key={a.id} className="border-t" style={{ borderColor: PALETTE.line }}>
                      <td className="py-2 pr-3"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: a.color }} />{a.name}<PlatformTag platform={a.platform} /></div></td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.todayRating !== undefined ? `★ ${fmtRating(a.todayRating)}` : "—"}</td>
                      <td className="py-2"><SignedDeltaBadge value={a.dRating} decimals={1} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* followers */}
          <Card accent={PALETTE.plum}>
            <SectionTitle eyebrow={periodMode === "month" ? "Update Hari Ini" : new Date(overview.refDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} title="Followers Toko" />
            <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>Angka snapshot (bukan akumulasi harian) — yang dibandingkan adalah nilai hari ini vs persis nilai kemarin.</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[360px]">
                <thead>
                  <tr className="text-left" style={{ color: PALETTE.inkSoft }}>
                    <th className="font-medium py-1.5 pr-3">Akun</th>
                    <th className="font-medium py-1.5 pr-3">Followers Hari Ini</th>
                    <th className="font-medium py-1.5">vs Kemarin</th>
                  </tr>
                </thead>
                <tbody>
                  {growthMetrics.map((a) => (
                    <tr key={a.id} className="border-t" style={{ borderColor: PALETTE.line }}>
                      <td className="py-2 pr-3"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: a.color }} />{a.name}<PlatformTag platform={a.platform} /></div></td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.todayFollowers !== undefined ? fmtNum(a.todayFollowers) : "—"}</td>
                      <td className="py-2"><SignedDeltaBadge value={a.dFollowers} decimals={0} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* trend chart — hanya mode bulanan */}
          {periodMode === "month" && (
          <Card>
            <SectionTitle eyebrow={periodLabel} title="Tren GMV Harian" />
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overview.chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={PALETTE.line} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: PALETTE.inkSoft }} axisLine={{ stroke: PALETTE.line }} tickLine={false} />
                  <YAxis tickFormatter={fmtCompactRp} tick={{ fontSize: 11, fill: PALETTE.inkSoft }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip formatter={(v, name) => [fmtRp(v), name]} labelFormatter={(d) => `Tanggal ${d}`} contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${PALETTE.line}` }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} onClick={(o) => setHiddenAccounts((prev) => { const n = new Set(prev); n.has(o.dataKey) ? n.delete(o.dataKey) : n.add(o.dataKey); return n; })} />
                  {overview.targetPace > 0 && <ReferenceLine y={overview.targetPace} stroke={PALETTE.ochre} strokeDasharray="4 4" label={{ value: "Target/hari", position: "insideTopRight", fontSize: 10, fill: PALETTE.ochre }} />}
                  {accounts.map((a) => (
                    <Line key={a.id} dataKey={a.id} name={a.name} stroke={a.color} strokeWidth={1.5} dot={false} hide={hiddenAccounts.has(a.id)} connectNulls />
                  ))}
                  <Line dataKey="total" name="Total" stroke={PALETTE.ink} strokeWidth={2.5} dot={{ r: 2.5, fill: PALETTE.ink }} hide={hiddenAccounts.has("total")} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-[11px]" style={{ color: PALETTE.inkSoft }}>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: PALETTE.plum }} />Tanggal kembar</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: PALETTE.ochre }} />Periode gajian (25–5)</span>
              <span>Klik nama di legend untuk tampilkan/sembunyikan garis</span>
            </div>
          </Card>
          )}

          {/* insights */}
          <Card>
            <SectionTitle eyebrow="Auto-generated" title="Area yang Perlu Ditingkatkan" />
            {insights.length === 0 ? (
              <div className="text-sm py-4 text-center" style={{ color: PALETTE.inkSoft }}>Belum cukup data untuk analisis. Input GMV beberapa hari berturut-turut dulu di tab Input Data.</div>
            ) : (
              <div className="space-y-2">
                {insights.map((flag, i) => {
                  const meta = SEVERITY_META[flag.severity];
                  const Icon = meta.icon;
                  return (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded" style={{ background: meta.bg }}>
                      <Icon size={15} style={{ color: meta.color, marginTop: 2 }} />
                      <div className="text-sm flex-1">
                        <span className="font-semibold mr-1.5 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide" style={{ background: PALETTE.panel, color: meta.color }}>{flag.category}</span>
                        <span style={{ color: PALETTE.ink }}>{flag.message}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ===================== INPUT DATA ===================== */}
      {tab === "input" && (
        <div className="space-y-5">
          <div className="flex gap-1">
            {[["form", "Form Harian"], ["paste", "Tempel Data"]].map(([key, label]) => (
              <button key={key} onClick={() => setInputMode(key)}
                className="px-3.5 py-1.5 text-sm font-medium rounded"
                style={{ background: inputMode === key ? PALETTE.ink : PALETTE.panel, color: inputMode === key ? PALETTE.panel : PALETTE.inkSoft, border: `1px solid ${inputMode === key ? PALETTE.ink : PALETTE.line}` }}>
                {label}
              </button>
            ))}
          </div>

          {inputMode === "form" && (
            <Card>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar size={16} style={{ color: PALETTE.inkSoft }} />
                  <input type="date" value={inputDate} onChange={(e) => setInputDate(e.target.value)} className="text-sm px-2.5 py-1.5 rounded border outline-none" style={{ borderColor: PALETTE.line }} />
                  {isTwinDate(inputDate) && <span className="text-[11px] px-2 py-1 rounded font-medium" style={{ background: PALETTE.plumSoft, color: PALETTE.plum }}>Tanggal Kembar</span>}
                  {isPaydayWindow(inputDate) && <span className="text-[11px] px-2 py-1 rounded font-medium" style={{ background: PALETTE.ochreSoft, color: PALETTE.ochre }}>Periode Gajian</span>}
                  {entries[inputDate] && Object.keys(entries[inputDate]).length > 0 && (
                    <span className="text-[11px] px-2 py-1 rounded font-medium" style={{ background: PALETTE.coralSoft, color: PALETTE.coral }}>Sudah Pernah Diisi — perubahan akan tercatat sebagai revisi</span>
                  )}
                </div>
                {savedFlash && <span className="text-xs flex items-center gap-1" style={{ color: PALETTE.teal }}><CheckCircle2 size={13} />Tersimpan</span>}
              </div>

              {/* Ringkasan total GMV dari draft yang sedang diisi — update realtime tiap kali angka berubah */}
              {(() => {
                const tiktokAccs = accounts.filter((a) => a.platform === "tiktok");
                const shopeeAccs = accounts.filter((a) => a.platform === "shopee");
                const calcGmv = (acc) => {
                  const row = draft[acc.id] || {};
                  const fields = sourceFieldsFor(acc.platform);
                  const anySource = fields.some(([f]) => row[f] !== undefined);
                  return anySource ? fields.reduce((s, [f]) => s + (row[f] || 0), 0) : (row.gmv || 0);
                };
                const totalTiktok = tiktokAccs.reduce((s, a) => s + calcGmv(a), 0);
                const totalShopee = shopeeAccs.reduce((s, a) => s + calcGmv(a), 0);
                const totalAll = totalTiktok + totalShopee;
                const hasAnyData = accounts.some((a) => {
                  const row = draft[a.id] || {};
                  const fields = sourceFieldsFor(a.platform);
                  return fields.some(([f]) => row[f] !== undefined) || row.gmv !== undefined;
                });
                if (!hasAnyData) return null;
                return (
                  <div className="flex flex-wrap gap-3 mb-3 p-3 rounded-xl" style={{ background: PALETTE.panelAlt }}>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: PALETTE.inkSoft }}>Total Semua Toko</div>
                      <div className="text-lg font-extrabold" style={{ fontFamily: "'JetBrains Mono', monospace", ...gradientText(PALETTE.brand, PALETTE.brand2) }}>{fmtRp(totalAll)}</div>
                    </div>
                    <div className="w-px" style={{ background: PALETTE.line }} />
                    <div>
                      <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: PALETTE.inkSoft }}>Total TikTok Shop (6 toko)</div>
                      <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: PALETTE.plum }}>{fmtRp(totalTiktok)}</div>
                    </div>
                    <div className="w-px" style={{ background: PALETTE.line }} />
                    <div>
                      <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: PALETTE.inkSoft }}>Shopee</div>
                      <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: PALETTE.coral }}>{fmtRp(totalShopee)}</div>
                    </div>
                  </div>
                );
              })()}

              <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>Isi breakdown sumber GMV di "Detail" — total dihitung otomatis (TikTok Shop dan Shopee punya kategori sumber yang berbeda). Kosongkan kalau belum ada datanya hari ini — bisa dilengkapi nanti.</div>
              <div className="space-y-2">
                {accounts.map((acc) => {
                  const expanded = expandedRows.has(acc.id);
                  const row = draft[acc.id] || {};
                  const fields = sourceFieldsFor(acc.platform);
                  const anySource = fields.some(([f]) => row[f] !== undefined);
                  const computedGmv = anySource ? fields.reduce((s, [f]) => s + (row[f] || 0), 0) : row.gmv;
                  const canEdit = isAdmin || acc.id === myAccountId;
                  return (
                    <div key={acc.id} className="rounded border" style={{ borderColor: PALETTE.line, opacity: canEdit ? 1 : 0.65 }}>
                      <div className="flex items-center gap-3 p-2.5 flex-wrap">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: acc.color }} />
                        <span className="text-sm font-medium w-36 shrink-0">{acc.name}</span>
                        <PlatformTag platform={acc.platform} />
                        {!canEdit && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: PALETTE.panelAlt, color: PALETTE.inkFaint }}>Read-only</span>}
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-[10px] uppercase tracking-wide" style={{ color: PALETTE.inkSoft }}>Total (auto)</span>
                          <span className="text-sm font-semibold w-40 text-right" style={{ fontFamily: "'JetBrains Mono', monospace", color: computedGmv !== undefined ? PALETTE.ink : PALETTE.inkFaint }}>
                            {computedGmv !== undefined ? fmtRp(computedGmv) : "Belum diisi"}
                          </span>
                        </div>
                        <button onClick={() => toggleExpand(acc.id)} className="text-xs flex items-center gap-0.5 px-1.5 py-1 rounded" style={{ color: PALETTE.inkSoft }}>
                          Detail {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                      {expanded && (
                        <div className="p-2.5 pt-0 space-y-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: PALETTE.plum }}>Sumber GMV (total di atas otomatis dijumlah dari sini)</div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              {fields.map(([field, label]) => (
                                <div key={field}>
                                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>{label}</label>
                                  <input type="text" inputMode="numeric" value={row[field] !== undefined ? fmtNum(row[field]) : ""} disabled={!canEdit}
                                    onChange={(e) => updateDraftField(acc.id, field, e.target.value === "" ? undefined : parseNum(e.target.value))}
                                    className="text-sm px-2 py-1.5 rounded border outline-none w-full disabled:bg-transparent disabled:cursor-not-allowed" style={{ borderColor: PALETTE.line, fontFamily: "'JetBrains Mono', monospace" }} />
                                </div>
                              ))}
                            </div>
                            {!anySource && row.gmv !== undefined && (
                              <div className="text-[11px] mt-1.5" style={{ color: PALETTE.ochre }}>
                                Tanggal ini masih pakai GMV total lama ({fmtRp(row.gmv)}) tanpa breakdown. Begitu salah satu sumber di atas diisi, total otomatis berubah jadi jumlah breakdown — pastikan isi semua sumber yang relevan agar totalnya tidak berkurang.
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: PALETTE.inkSoft }}>Metrik Lain</div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {[
                                ["orders", "Orders", "int"], ["visitors", "Visitors", "int"],
                                ["adSpend", "Ad Spend (Rp)", "int"], ["adRevenue", "Ad Revenue (Rp)", "int"],
                                ["rating", "Rating Toko (0-5)", "decimal"], ["followers", "Followers", "int"],
                              ].map(([field, label, type]) => (
                                <div key={field}>
                                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>{label}</label>
                                  <input type="text" inputMode={type === "decimal" ? "decimal" : "numeric"} disabled={!canEdit}
                                    placeholder={type === "decimal" ? "4,5" : undefined}
                                    value={row[field] !== undefined ? (type === "decimal" ? String(row[field]).replace(".", ",") : fmtNum(row[field])) : ""}
                                    onChange={(e) => updateDraftField(acc.id, field, e.target.value === "" ? undefined : (type === "decimal" ? e.target.value : parseNum(e.target.value)))}
                                    className="text-sm px-2 py-1.5 rounded border outline-none w-full disabled:bg-transparent disabled:cursor-not-allowed" style={{ borderColor: PALETTE.line, fontFamily: "'JetBrains Mono', monospace" }} />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={saveDraft} disabled={saving} className={`mt-4 ${btnClass} flex items-center gap-1.5`} style={{ ...btnPrimaryStyle(PALETTE.brand, PALETTE.brandDeep), opacity: saving ? 0.7 : 1, cursor: saving ? "wait" : "pointer" }}>
                {saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Menyimpan…" : `Simpan Data ${inputDate}`}
              </button>
            </Card>
          )}

          {inputMode === "paste" && (
            <Card>
              <div className="text-xs mb-2" style={{ color: PALETTE.inkSoft }}>
                Format per baris (pisahkan kolom dengan koma atau tab — bisa langsung paste dari Excel/Sheet):
              </div>
              <div className="text-xs mb-3 px-2.5 py-2 rounded" style={{ background: PALETTE.panelAlt, fontFamily: "'JetBrains Mono', monospace" }}>
                Tanggal, NamaAkun, GMV, Orders, Visitors, AdSpend, AdRevenue, Video, VideoAffiliate, LivePenjual, LiveAffiliate, KartuProduk, Rating, Followers, SpHalamanProduk, SpLivePenjual, SpVideoPenjual, SpAffiliate<br />
                2026-06-18, Lovie Dovey, , , , , , 479149, 12398110, 665920, 4779426, 16703514, 4.8, 125400<br />
                2026-06-18, Twie Beauty, , , , , , , , , , , 4.9, 8200, 3200000, 1500000, 900000, 600000
              </div>
              <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>Tanggal: YYYY-MM-DD atau DD/MM/YYYY. Semua kolom setelah GMV opsional. 5 kolom breakdown TikTok Shop (Video s/d Kartu Produk) atau 4 kolom breakdown Shopee (4 kolom terakhir) — isi salah satu sesuai platform akunnya, GMV otomatis dihitung dari breakdown dan kolom GMV boleh dikosongkan. Rating diisi skala 0-5 (boleh desimal), Followers angka bulat.</div>
              <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6}
                placeholder="Tempel data di sini…" className="w-full text-sm px-3 py-2 rounded border outline-none" style={{ borderColor: PALETTE.line, fontFamily: "'JetBrains Mono', monospace" }} />
              <button onClick={processPaste} disabled={!pasteText.trim()} className={`mt-3 ${btnClass} flex items-center gap-1.5`} style={{ background: pasteText.trim() ? `linear-gradient(135deg, ${PALETTE.ink}, #000)` : PALETTE.panelAlt, color: pasteText.trim() ? "#fff" : PALETTE.inkFaint, boxShadow: pasteText.trim() ? cardShadow : "none" }}>
                <ClipboardPaste size={14} />Proses & Pratinjau
              </button>

              {pastePreview && (
                <div className="mt-4">
                  <div className="text-xs mb-2" style={{ color: PALETTE.inkSoft }}>
                    {pastePreview.filter((r) => r.ok).length} baris valid, {pastePreview.filter((r) => !r.ok).length} baris bermasalah.
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[560px]">
                      <tbody>
                        {pastePreview.map((r, i) => {
                          const willOverwrite = r.ok && entries[r.date]?.[r.accountId];
                          return (
                            <tr key={i} className="border-t" style={{ borderColor: PALETTE.line }}>
                              <td className="py-1.5 pr-2">{r.ok ? <CheckCircle2 size={14} style={{ color: PALETTE.teal }} /> : <AlertTriangle size={14} style={{ color: PALETTE.coral }} />}</td>
                              <td className="py-1.5 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{r.raw}</td>
                              {!r.ok && <td className="py-1.5" style={{ color: PALETTE.coral }}>{r.error}</td>}
                              {r.ok && willOverwrite && <td className="py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: PALETTE.coralSoft, color: PALETTE.coral }}>Akan menimpa data lama (tercatat sebagai revisi)</span></td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={commitPaste} disabled={!pastePreview.some((r) => r.ok) || saving} className={`mt-3 ${btnClass} flex items-center gap-1.5`} style={{ ...btnPrimaryStyle(PALETTE.brand, PALETTE.brandDeep), opacity: saving ? 0.7 : 1, cursor: saving ? "wait" : "pointer" }}>
                    {saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Menyimpan…" : `Simpan ${pastePreview.filter((r) => r.ok).length} Baris Valid`}
                  </button>
                </div>
              )}
            </Card>
          )}

          <Card>
            <SectionTitle eyebrow={`${revisions.length} tercatat`} title="Riwayat Revisi" />
            {revisions.length === 0 ? (
              <div className="text-sm py-3" style={{ color: PALETTE.inkSoft }}>Belum ada revisi. Kalau kamu mengubah data yang sudah pernah disimpan (lewat Form Harian atau Tempel Data), perubahannya akan tercatat di sini lengkap dengan nilai lama vs baru, dan bisa dipulihkan kalau ternyata revisinya keliru.</div>
            ) : (
              <div className="space-y-2">
                {(showAllRevisions ? revisions : revisions.slice(0, 8)).map((rev) => (
                  <div key={rev.id} className="p-2.5 rounded" style={{ background: PALETTE.panelAlt }}>
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                      <div className="text-sm">
                        <span className="font-semibold">{rev.accountName}</span>
                        <span style={{ color: PALETTE.inkSoft }}> · {rev.date} · {new Date(rev.timestamp).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        {rev.isRestore && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: PALETTE.tealSoft, color: PALETTE.teal }}>Pemulihan</span>}
                      </div>
                      {(isAdmin || rev.accountId === myAccountId) && (
                        <button onClick={() => restoreRevision(rev)} className="text-xs px-2.5 py-1 rounded border" style={{ borderColor: PALETTE.line, color: PALETTE.inkSoft }}>Pulihkan ke Nilai Sebelumnya</button>
                      )}
                    </div>
                    <div className="text-xs space-y-0.5">
                      {rev.diffs.map((d) => (
                        <div key={d.field} style={{ color: PALETTE.ink }}>
                          <span style={{ color: PALETTE.inkSoft }}>{d.label}:</span>{" "}
                          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtFieldVal(d.field, d.oldVal)}</span>
                          {" → "}
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{fmtFieldVal(d.field, d.newVal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {revisions.length > 8 && (
                  <button onClick={() => setShowAllRevisions((v) => !v)} className="text-xs px-2.5 py-1.5 rounded" style={{ color: PALETTE.inkSoft }}>
                    {showAllRevisions ? "Tampilkan lebih sedikit" : `Tampilkan semua (${revisions.length})`}
                  </button>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ===================== SUMBER GMV ===================== */}
      {tab === "sumber" && (
        <div className="space-y-5">
          <Card>
            <SectionTitle eyebrow={periodLabel} title="Sumber GMV — Live, Video & Kartu Produk" />
            <div className="text-xs" style={{ color: PALETTE.inkSoft }}>
              TikTok Shop dan Shopee punya kategori sumber GMV yang berbeda, jadi ditampilkan terpisah: TikTok Shop di bawah (gabungan & per toko), Shopee di bagian paling bawah dengan kategorinya sendiri (GMV Halaman Produk, Live Penjual, Video Penjual, Affiliate).
            </div>
            {sourceBreakdown.totalDaysGmvOnly > 0 && (
              <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg text-xs" style={{ background: PALETTE.ochreSoft, color: PALETTE.ochreDeep }}>
                <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>{sourceBreakdown.totalDaysGmvOnly} hari-akun di bulan ini cuma punya GMV total tanpa breakdown sumber (misalnya data hasil import) — angka di bawah ini cuma menghitung hari yang breakdown-nya sudah diisi, jadi totalnya bisa lebih kecil dari GMV bulanan sesungguhnya.</span>
              </div>
            )}
          </Card>

          {/* Donut gabungan semua toko */}
          <Card accent={PALETTE.brand}>
            <SectionTitle eyebrow="Gabungan 6 Toko" title="Semua Toko — Mix Sumber GMV" />
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <SourceDonut sums={sourceBreakdown.combined} size={200} centerLabel="Total Breakdown" />
              <div className="flex-1 w-full space-y-2">
                {GMV_SOURCE_FIELDS.map(([f]) => {
                  const meta = SOURCE_FIELD_META[f];
                  const value = sourceBreakdown.combined[f] || 0;
                  const pct = sourceBreakdown.combinedBreakdownTotal > 0 ? (value / sourceBreakdown.combinedBreakdownTotal) * 100 : 0;
                  return (
                    <div key={f} className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: meta.color }} />
                      <span className="text-sm w-32 shrink-0">{meta.label}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: PALETTE.panelAlt }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                      </div>
                      <span className="text-xs w-12 text-right" style={{ fontFamily: "'JetBrains Mono', monospace", color: PALETTE.inkSoft }}>{pct.toFixed(0)}%</span>
                      <span className="text-xs w-20 text-right hidden sm:inline" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Channel mix antar akun */}
          <Card>
            <SectionTitle eyebrow="Perbandingan" title="Mix Sumber per Toko" />
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sourceBreakdown.perAccount.map((a) => ({ name: a.name, ...a.sums }))}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={PALETTE.line} horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtCompactRp} tick={{ fontSize: 10, fill: PALETTE.inkSoft }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={86} tick={{ fontSize: 11, fill: PALETTE.ink }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v, n) => [fmtRp(v), SOURCE_FIELD_META[n]?.label || n]} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${PALETTE.line}` }} />
                  {GMV_SOURCE_FIELDS.map(([f]) => (
                    <Bar key={f} dataKey={f} stackId="mix" fill={SOURCE_FIELD_META[f].color} radius={f === "kartuProduk" ? [0, 4, 4, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {GMV_SOURCE_FIELDS.map(([f]) => (
                <span key={f} className="flex items-center gap-1.5 text-[11px]" style={{ color: PALETTE.inkSoft }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: SOURCE_FIELD_META[f].color }} />{SOURCE_FIELD_META[f].label}
                </span>
              ))}
            </div>
          </Card>

          {/* Grid donut per akun */}
          <Card>
            <SectionTitle eyebrow="Per Toko" title="Mix Sumber GMV — TikTok Shop" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {sourceBreakdown.perAccount.map((acc) => (
                <div key={acc.id} className="flex flex-col items-center p-3 rounded-lg" style={{ background: PALETTE.panelAlt }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: acc.color }} />
                    <span className="text-xs font-semibold">{acc.name}</span>
                  </div>
                  <SourceDonut sums={acc.sums} size={128} centerLabel={`${acc.daysWithBreakdown}h diisi`} />
                  {acc.daysGmvOnly > 0 && (
                    <span className="text-[10px] mt-2 text-center" style={{ color: PALETTE.ochreDeep }}>{acc.daysGmvOnly} hari tanpa breakdown</span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Shopee — breakdown sumbernya sendiri (beda kategori dari TikTok Shop) */}
          <Card accent={PALETTE.coral}>
            <SectionTitle eyebrow="Mix Sumber GMV" title="Shopee" />
            {sourceBreakdown.perShopee.length === 0 ? (
              <div className="text-sm py-3" style={{ color: PALETTE.inkSoft }}>Belum ada akun Shopee.</div>
            ) : sourceBreakdown.perShopee.map((acc) => (
              <div key={acc.id} className="flex flex-col sm:flex-row items-center gap-6">
                <div className="flex items-center gap-2 sm:hidden">
                  <PlatformTag platform="shopee" />
                  <span className="text-sm font-medium">{acc.name}</span>
                </div>
                <SourceDonut sums={acc.sums} size={180} centerLabel="Total Breakdown" fields={SHOPEE_SOURCE_FIELDS} meta={SHOPEE_SOURCE_FIELD_META} />
                <div className="flex-1 w-full space-y-2">
                  <div className="hidden sm:flex items-center gap-2 mb-1">
                    <PlatformTag platform="shopee" />
                    <span className="text-sm font-medium">{acc.name}</span>
                  </div>
                  {SHOPEE_SOURCE_FIELDS.map(([f]) => {
                    const meta = SHOPEE_SOURCE_FIELD_META[f];
                    const value = acc.sums[f] || 0;
                    const pct = acc.breakdownTotal > 0 ? (value / acc.breakdownTotal) * 100 : 0;
                    return (
                      <div key={f} className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: meta.color }} />
                        <span className="text-sm w-36 shrink-0">{meta.label}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: PALETTE.panelAlt }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                        </div>
                        <span className="text-xs w-12 text-right" style={{ fontFamily: "'JetBrains Mono', monospace", color: PALETTE.inkSoft }}>{pct.toFixed(0)}%</span>
                        <span className="text-xs w-20 text-right hidden sm:inline" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(value)}</span>
                      </div>
                    );
                  })}
                  {acc.daysGmvOnly > 0 && (
                    <div className="text-[11px] pt-1" style={{ color: PALETTE.ochreDeep }}>{acc.daysGmvOnly} hari di bulan ini cuma punya GMV total tanpa breakdown sumber.</div>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ===================== PERFORMA IKLAN ===================== */}
      {tab === "iklan" && (
        <div className="space-y-5">
          <Card>
            <SectionTitle eyebrow={periodLabel} title="Performa Iklan — ROAS & CPA" />
            <div className="text-xs" style={{ color: PALETTE.inkSoft }}>
              ROAS = Ad Revenue ÷ Ad Spend. CPA = Ad Spend ÷ Orders (estimasi — Orders di sini total order harian, bukan order yang murni teratribusi ke iklan, karena datanya tidak dipisah sebegitu detail). Dihitung dari field Ad Spend/Ad Revenue/Orders opsional yang sudah kamu isi di Form Harian.
            </div>
            {adPerformance.totalDaysWithAdData === 0 && (
              <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg text-xs" style={{ background: PALETTE.ochreSoft, color: PALETTE.ochreDeep }}>
                <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>Belum ada data Ad Spend yang diisi untuk {periodLabel}. Isi field "Ad Spend (Rp)" dan "Ad Revenue (Rp)" di Form Harian (bagian Detail → Metrik Lain) supaya tab ini terisi.</span>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card accent={PALETTE.coral}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Total Ad Spend</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(adPerformance.totalSpend)}</div>
            </Card>
            <Card accent={PALETTE.teal}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Ad Revenue</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(adPerformance.totalRevenue)}</div>
            </Card>
            <Card accent={PALETTE.brand}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>GMV Total (Iklan+Non Iklan)</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", ...gradientText(PALETTE.brand, PALETTE.brand2) }}>{fmtCompactRp(adPerformance.totalGmvAllStores)}</div>
              <div className="text-[11px] mt-1" style={{ color: PALETTE.inkSoft }}>
                {adPerformance.adRevenueShare !== null ? `Iklan: ${adPerformance.adRevenueShare.toFixed(1)}% dari GMV` : "Belum ada data iklan"}
              </div>
            </Card>
            <Card accent={PALETTE.brand}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>ROAS Gabungan</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: adPerformance.overallRoas === null ? PALETTE.inkFaint : adPerformance.overallRoas < 1 ? PALETTE.coral : PALETTE.teal }}>
                {adPerformance.overallRoas !== null ? adPerformance.overallRoas.toFixed(2) : "—"}
              </div>
              {benchmarks.targetROAS > 0 && <div className="text-[11px] mt-1" style={{ color: PALETTE.inkSoft }}>Target: {benchmarks.targetROAS}</div>}
            </Card>
            <Card accent={PALETTE.plum}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Biaya/Pesanan (CPA)</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{adPerformance.overallCpa !== null ? fmtCompactRp(adPerformance.overallCpa) : "—"}</div>
              <div className="text-[11px] mt-1" style={{ color: PALETTE.inkSoft }}>dari {fmtNum(adPerformance.totalOrders)} orders</div>
            </Card>
            <Card accent={adPerformance.overallRoi !== null && adPerformance.overallRoi >= 0 ? PALETTE.teal : PALETTE.coral}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>ROI</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: adPerformance.overallRoi === null ? PALETTE.inkFaint : adPerformance.overallRoi >= 0 ? PALETTE.teal : PALETTE.coral }}>
                {adPerformance.overallRoi !== null ? `${adPerformance.overallRoi.toFixed(1)}%` : "—"}
              </div>
              <div className="text-[11px] mt-1" style={{ color: PALETTE.inkSoft }}>(Revenue − Spend) / Spend</div>
            </Card>
            <Card accent={PALETTE.ochre}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Budget/Hari (Gabungan)</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {adPerformance.totalBudgetPerHari > 0 ? fmtCompactRp(adPerformance.totalBudgetPerHari) : "—"}
              </div>
              <div className="text-[11px] mt-1" style={{ color: PALETTE.inkSoft }}>Atur di bawah ↓</div>
            </Card>
          </div>

          {/* trend ROAS */}
          <Card>
            <SectionTitle eyebrow={periodLabel} title="Tren ROAS Harian" />
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={adPerformance.chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={PALETTE.line} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: PALETTE.inkSoft }} axisLine={{ stroke: PALETTE.line }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: PALETTE.inkSoft }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip formatter={(v, name) => [v !== null ? Number(v).toFixed(2) : "—", name]} labelFormatter={(d) => `Tanggal ${d}`} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${PALETTE.line}` }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {benchmarks.targetROAS > 0 && <ReferenceLine y={benchmarks.targetROAS} stroke={PALETTE.ochre} strokeDasharray="4 4" label={{ value: "Target ROAS", position: "insideTopRight", fontSize: 10, fill: PALETTE.ochre }} />}
                  <ReferenceLine y={1} stroke={PALETTE.coral} strokeDasharray="2 2" label={{ value: "Balik modal", position: "insideBottomRight", fontSize: 10, fill: PALETTE.coral }} />
                  {accounts.map((acc) => (
                    <Line key={acc.id} dataKey={acc.id} name={acc.name} stroke={acc.color} strokeWidth={1.5} dot={false} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* detail per akun + input budget/hari */}
          <Card>
            <SectionTitle eyebrow={periodLabel} title="Detail & Budget per Akun" />
            <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>
              ROI = (Ad Revenue − Ad Spend) ÷ Ad Spend × 100%. Biaya/Pesanan = Ad Spend ÷ Orders. Budget/Hari diisi manual di kolom kanan — disimpan per bulan sebagai acuan harian.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead>
                  <tr className="text-left" style={{ color: PALETTE.inkSoft }}>
                    <th className="font-medium py-1.5 pr-3">Akun</th>
                    <th className="font-medium py-1.5 pr-3">Ad Spend</th>
                    <th className="font-medium py-1.5 pr-3">Ad Revenue</th>
                    <th className="font-medium py-1.5 pr-3">GMV Total Toko</th>
                    <th className="font-medium py-1.5 pr-3">ROAS</th>
                    <th className="font-medium py-1.5 pr-3">ROI</th>
                    <th className="font-medium py-1.5 pr-3">Biaya/Pesanan</th>
                    <th className="font-medium py-1.5 pr-3">ROAS Hari Ini</th>
                    <th className="font-medium py-1.5 pr-3">vs Kemarin</th>
                    {isAdmin && <th className="font-medium py-1.5">Budget/Hari (Rp)</th>}
                  </tr>
                </thead>
                <tbody>
                  {adPerformance.perAccount.map((a) => (
                    <tr key={a.id} className="border-t" style={{ borderColor: PALETTE.line }}>
                      <td className="py-2 pr-3"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: a.color }} />{a.name}<PlatformTag platform={a.platform} /></div></td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(a.spend)}</td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(a.revenue)}</td>
                      <td className="py-2 pr-3 font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", ...gradientText(PALETTE.brand, PALETTE.brand2) }}>{fmtCompactRp(a.gmvTotal)}</td>
                      <td className="py-2 pr-3 font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: a.roas === null ? PALETTE.inkFaint : a.roas < 1 ? PALETTE.coral : PALETTE.teal }}>{a.roas !== null ? a.roas.toFixed(2) : "—"}</td>
                      <td className="py-2 pr-3 font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: a.roi === null ? PALETTE.inkFaint : a.roi >= 0 ? PALETTE.teal : PALETTE.coral }}>{a.roi !== null ? `${a.roi.toFixed(1)}%` : "—"}</td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.cpa !== null ? fmtCompactRp(a.cpa) : "—"}</td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.todayRoas !== null ? a.todayRoas.toFixed(2) : "—"}</td>
                      <td className="py-2 pr-3"><SignedDeltaBadge value={a.dRoas} decimals={2} /></td>
                      {isAdmin && (
                        <td className="py-2">
                          <input type="text" inputMode="numeric"
                            value={adBudgetDraft[a.id] !== undefined ? fmtNum(adBudgetDraft[a.id]) : ""}
                            onChange={(e) => setAdBudgetDraft((p) => ({ ...p, [a.id]: parseNum(e.target.value) }))}
                            placeholder="0"
                            className="text-sm px-2 py-1 rounded border outline-none w-28 text-right"
                            style={{ borderColor: PALETTE.line, fontFamily: "'JetBrains Mono', monospace" }} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <button onClick={saveAdBudgets} disabled={saving} className={`mt-3 ${btnClass} flex items-center gap-1.5`} style={{ ...btnPrimaryStyle(PALETTE.ochre, PALETTE.ochreDeep), opacity: saving ? 0.7 : 1 }}>
                {saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Menyimpan…" : `Simpan Budget/Hari ${monthLabel(selectedMonth)}`}
              </button>
            )}
            <div className="text-[11px] mt-3" style={{ color: PALETTE.inkFaint }}>Kolom "ROAS Hari Ini" & "vs Kemarin" memakai definisi "Hari Ini" yang sama seperti di tab Ringkasan (H-1 dari tanggal kalender asli). Budget/Hari disimpan per bulan — ganti bulan di selector atas untuk atur budget bulan lain.</div>
          </Card>
        </div>
      )}

      {/* ===================== LIVE TRACKER ===================== */}
      {/* Fitur ini SENGAJA dipisah total dari "Input Data" GMV — beda state, beda koleksi
          Firestore (liveSessions, bukan entries), beda warna identitas (rose, bukan violet)
          — supaya tidak ada yang ketuker isi form GMV harian dengan form sesi Live. */}
      {tab === "live" && (
        <div className="space-y-5">
          <Card accent={LIVE_ACCENT}>
            <div className="flex items-center gap-2 mb-1">
              <Radio size={18} style={{ color: LIVE_ACCENT }} />
              <SectionTitle eyebrow="Bukan Input Data GMV — form terpisah" title="Live Tracker" />
            </div>
            <div className="text-xs" style={{ color: PALETTE.inkSoft }}>
              Catat performa tiap sesi live: host, jam mulai/selesai, orders, GMV langsung dari live, total viewers, CO%, CTR%, dan GPM. Satu tanggal boleh punya beberapa sesi (host beda, jam beda) — tiap submit jadi catatan terpisah, bukan menimpa data lain.
            </div>
          </Card>

          {/* form input sesi live — identitas visual rose, beda dari form Input Data GMV (violet) */}
          <Card className="border-2" style={{ borderColor: LIVE_ACCENT_SOFT }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: LIVE_ACCENT_SOFT }}>
                <Radio size={14} style={{ color: LIVE_ACCENT }} />
              </span>
              <h3 className="text-sm font-bold" style={{ color: LIVE_ACCENT_DEEP }}>Catat Sesi Live Baru</h3>
              {liveSavedFlash && <span className="text-xs flex items-center gap-1 ml-auto" style={{ color: PALETTE.teal }}><CheckCircle2 size={13} />Tersimpan</span>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Nama Toko</label>
                <select value={liveDraft.accountId} onChange={(e) => updateLiveDraftField("accountId", e.target.value)}
                  className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: LIVE_ACCENT_SOFT }}>
                  <option value="">Pilih toko…</option>
                  {accounts.filter((a) => isAdmin || a.id === myAccountId).length > 0 && (
                    <optgroup label="Toko GMV">
                      {accounts.filter((a) => isAdmin || a.id === myAccountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </optgroup>
                  )}
                  {liveOnlyAccounts.length > 0 && (
                    <optgroup label="Toko Khusus Live (tanpa GMV)">
                      {liveOnlyAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Platform</label>
                <div className="text-sm px-2.5 py-1.5 rounded border" style={{ borderColor: LIVE_ACCENT_SOFT, background: PALETTE.panelAlt, color: PALETTE.inkSoft }}>
                  {liveAccountOptions.find((a) => a.id === liveDraft.accountId)?.platform === "shopee" ? "Shopee" : liveAccountOptions.find((a) => a.id === liveDraft.accountId) ? "TikTok Shop" : "—"}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Date</label>
                <input type="date" value={liveDraft.date} onChange={(e) => updateLiveDraftField("date", e.target.value)}
                  className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: LIVE_ACCENT_SOFT }} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Nama HOST</label>
                <select value={liveDraft.hostName} onChange={(e) => updateLiveDraftField("hostName", e.target.value)}
                  className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: LIVE_ACCENT_SOFT }}>
                  <option value="">Pilih host…</option>
                  {hostNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>START Live</label>
                <input type="time" value={liveDraft.startTime} onChange={(e) => updateLiveDraftField("startTime", e.target.value)}
                  className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: LIVE_ACCENT_SOFT, fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>END Live</label>
                <input type="time" value={liveDraft.endTime} onChange={(e) => updateLiveDraftField("endTime", e.target.value)}
                  className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: LIVE_ACCENT_SOFT, fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
              <div className="col-span-2 sm:col-span-2">
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Live Hours (otomatis)</label>
                <div className="text-sm px-2.5 py-1.5 rounded border flex items-center gap-1.5" style={{ borderColor: LIVE_ACCENT_SOFT, background: PALETTE.panelAlt, fontFamily: "'JetBrains Mono', monospace", color: LIVE_ACCENT_DEEP }}>
                  <Clock size={13} />{fmtHours(calcLiveHours(liveDraft.startTime, liveDraft.endTime))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Orders</label>
                <input type="text" inputMode="numeric" value={liveDraft.orders !== "" ? fmtNum(liveDraft.orders) : ""} onChange={(e) => updateLiveDraftField("orders", e.target.value === "" ? "" : parseNum(e.target.value))}
                  className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: LIVE_ACCENT_SOFT, fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Direct GMV (Rp)</label>
                <input type="text" inputMode="numeric" value={liveDraft.directGmv !== "" ? fmtNum(liveDraft.directGmv) : ""} onChange={(e) => updateLiveDraftField("directGmv", e.target.value === "" ? "" : parseNum(e.target.value))}
                  className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: LIVE_ACCENT_SOFT, fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Total Viewers</label>
                <input type="text" inputMode="numeric" value={liveDraft.totalViewers !== "" ? fmtNum(liveDraft.totalViewers) : ""} onChange={(e) => updateLiveDraftField("totalViewers", e.target.value === "" ? "" : parseNum(e.target.value))}
                  className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: LIVE_ACCENT_SOFT, fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>CO (%)</label>
                <input type="text" inputMode="decimal" placeholder="contoh: 3,2" value={liveDraft.co} onChange={(e) => updateLiveDraftField("co", e.target.value)}
                  className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: LIVE_ACCENT_SOFT, fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>CTR (%)</label>
                <input type="text" inputMode="decimal" placeholder="contoh: 5,1" value={liveDraft.ctr} onChange={(e) => updateLiveDraftField("ctr", e.target.value)}
                  className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: LIVE_ACCENT_SOFT, fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>GPM</label>
                <input type="text" inputMode="numeric" placeholder="GMV per 1000 viewer" value={liveDraft.gpm !== "" ? fmtNum(liveDraft.gpm) : ""} onChange={(e) => updateLiveDraftField("gpm", e.target.value === "" ? "" : parseNum(e.target.value))}
                  className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: LIVE_ACCENT_SOFT, fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
            </div>
            <div className="text-[11px] mb-3" style={{ color: PALETTE.inkFaint }}>CO%, CTR%, dan GPM diisi langsung dari angka yang tampil di TikTok Shop/Shopee Live Analytics — tidak dihitung otomatis oleh sistem karena butuh data impression/klik yang tidak tercatat di sini.</div>

            <button onClick={saveLiveSessionEntry} disabled={saving} className={`${btnClass} flex items-center gap-1.5`} style={{ background: `linear-gradient(135deg, ${LIVE_ACCENT}, ${LIVE_ACCENT_DEEP})`, color: "#fff", boxShadow: glow(LIVE_ACCENT, 0.3), opacity: saving ? 0.7 : 1 }}>
              {saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Menyimpan…" : "Simpan Sesi Live"}<Radio size={14} />
            </button>
          </Card>

          {/* panel kelola daftar host — admin only, dipakai bersama di Live Tracker dan Jadwal */}
          {isAdmin && (
            <Card>
              <SectionTitle eyebrow="Berlaku juga di tab Jadwal Live" title="Kelola Daftar Host" />
              <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>
                Nama-nama di sini adalah daftar pilihan yang terkunci di dropdown "Nama HOST" form Live Tracker dan form input Jadwal. Pengguna non-admin tidak bisa mengetik nama bebas — harus pilih dari sini. Admin bisa tambah nama baru jika ada host baru.
              </div>
              <div className="flex items-end gap-2 flex-wrap mb-3 p-3 rounded-xl" style={{ background: PALETTE.panelAlt }}>
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Nama Host Baru</label>
                  <input type="text" value={newHostNameInput} onChange={(e) => setNewHostNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addHostName()} placeholder="contoh: Maya"
                    className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: PALETTE.line }} />
                </div>
                <button onClick={addHostName} className={`${btnClass} flex items-center gap-1.5`} style={btnPrimaryStyle(PALETTE.brand, PALETTE.brandDeep)}>
                  <PlusCircle size={14} />Tambah
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {hostNames.map((n) => (
                  <div key={n} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: PALETTE.panelAlt, border: `1px solid ${PALETTE.line}` }}>
                    <span>{n}</span>
                    <button onClick={() => removeHostName(n)} style={{ color: LIVE_ACCENT, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {isAdmin && (
            <Card>
              <SectionTitle eyebrow="Khusus Live Tracker — tidak ikut tracking GMV" title="Kelola Toko Live-Only" />
              <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>Toko di sini cuma muncul sebagai pilihan di form Live Tracker — tidak akan muncul di Input Data, Target, Sumber GMV, atau Performa Iklan.</div>
              <div className="flex items-end gap-2 flex-wrap mb-4 p-3 rounded-xl" style={{ background: PALETTE.panelAlt }}>
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Nama Toko Baru</label>
                  <input type="text" value={newLiveAccountName} onChange={(e) => setNewLiveAccountName(e.target.value)} placeholder="contoh: Pompurin"
                    className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: LIVE_ACCENT_SOFT, background: PALETTE.panel }} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Platform</label>
                  <select value={newLiveAccountPlatform} onChange={(e) => setNewLiveAccountPlatform(e.target.value)}
                    className="text-sm px-2.5 py-1.5 rounded border outline-none" style={{ borderColor: LIVE_ACCENT_SOFT, background: PALETTE.panel }}>
                    <option value="shopee">Shopee</option>
                    <option value="tiktok">TikTok Shop</option>
                  </select>
                </div>
                <button onClick={addLiveOnlyAccount} disabled={saving} className={`${btnClass} flex items-center gap-1.5`} style={{ background: `linear-gradient(135deg, ${LIVE_ACCENT}, ${LIVE_ACCENT_DEEP})`, color: "#fff", opacity: saving ? 0.7 : 1 }}>
                  <PlusCircle size={14} />Tambah Toko
                </button>
              </div>
              {liveOnlyAccounts.length === 0 ? (
                <div className="text-sm py-2" style={{ color: PALETTE.inkFaint }}>Belum ada toko khusus Live.</div>
              ) : (
                <div className="space-y-1.5">
                  {liveOnlyAccounts.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: PALETTE.panelAlt }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
                      <span className="text-sm font-medium flex-1">{a.name}</span>
                      <PlatformTag platform={a.platform} />
                      <button onClick={() => removeLiveOnlyAccount(a.id)} className="p-1 rounded hover:opacity-70" style={{ color: PALETTE.coral }} title="Hapus toko ini">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* filter laporan: bulan/custom, toko, host + export */}
          <Card>
            <SectionTitle title="Filter Laporan" />
            <div className="flex items-end gap-2 flex-wrap mb-3">
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Periode</label>
                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: PALETTE.line }}>
                  {[["month", "Bulanan"], ["custom", "Custom"]].map(([mode, label]) => (
                    <button key={mode} onClick={() => {
                      setLiveFilterMode(mode);
                      if (mode === "custom") { setLiveFilterStart(todayStr()); setLiveFilterEnd(todayStr()); }
                    }}
                      className="text-xs px-3 py-1.5 font-semibold transition-all"
                      style={{ background: liveFilterMode === mode ? `linear-gradient(135deg, ${LIVE_ACCENT}, ${LIVE_ACCENT_DEEP})` : PALETTE.panel, color: liveFilterMode === mode ? "#fff" : PALETTE.inkSoft }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                {liveFilterMode === "month" ? (
                  <>
                    <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Bulan</label>
                    <select value={liveFilterMonth} onChange={(e) => setLiveFilterMonth(e.target.value)}
                      className="text-sm px-3 py-1.5 rounded-lg border outline-none" style={{ borderColor: PALETTE.line, background: PALETTE.panel }}>
                      {monthOptions.map((m) => <option key={m} value={m}>{monthLabel(m)}{m === todayYM() ? " (Bulan Ini)" : ""}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Rentang Tanggal</label>
                    <DateRangePicker
                      startDate={liveFilterStart}
                      endDate={liveFilterEnd}
                      accentColor={LIVE_ACCENT}
                      onApply={(s, e) => { setLiveFilterStart(s); setLiveFilterEnd(e); }}
                    />
                  </>
                )}
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Toko</label>
                <select value={liveFilterAccount} onChange={(e) => setLiveFilterAccount(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg border outline-none" style={{ borderColor: PALETTE.line, background: PALETTE.panel }}>
                  <option value="all">Semua Toko</option>
                  {liveAccountOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Nama Host</label>
                <select value={liveFilterHost} onChange={(e) => setLiveFilterHost(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg border outline-none" style={{ borderColor: PALETTE.line, background: PALETTE.panel }}>
                  <option value="all">Semua Host</option>
                  {liveHostOptions.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <button onClick={exportLiveReport} className={`${btnClass} flex items-center gap-1.5`} style={btnPrimaryStyle(LIVE_ACCENT, LIVE_ACCENT_DEEP)}>
                <FileSpreadsheet size={14} />Export Laporan (.xlsx)
              </button>
            </div>
            <div className="text-[11px]" style={{ color: PALETTE.inkFaint }}>Laporan mengikuti filter Periode + Toko + Host di atas — kosongkan ke "Semua" untuk laporan menyeluruh, atau pilih spesifik untuk laporan per-toko atau per-host. Mode Custom bisa pilih rentang tanggal bebas, tidak terbatas satu bulan kalender.</div>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card accent={LIVE_ACCENT}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Total Sesi Live</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{liveStats.totalSessions}</div>
            </Card>
            <Card accent={PALETTE.brand}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Direct GMV</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(liveStats.totalGmv)}</div>
            </Card>
            <Card accent={PALETTE.teal}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Total Orders</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtNum(liveStats.totalOrders)}</div>
            </Card>
            <Card accent={PALETTE.ochre}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Total Jam Live</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtHours(liveStats.totalHours)}</div>
            </Card>
            <Card accent={PALETTE.plum}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Rata-rata CO%</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{liveStats.avgCo !== null ? `${liveStats.avgCo.toFixed(1)}%` : "—"}</div>
            </Card>
            <Card accent={PALETTE.coral}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Rata-rata GPM</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{liveStats.avgGpm !== null ? fmtCompactRp(liveStats.avgGpm) : "—"}</div>
            </Card>
          </div>

          {/* ranking host */}
          {liveStats.hostRanking.length > 0 && (
            <Card>
              <SectionTitle eyebrow={`${livePeriodLabel} \u2022 Urut Direct GMV`} title="Ranking Host" />
              <div className="space-y-2.5">
                {liveStats.hostRanking.map((h, idx) => {
                  const [bandFrom, bandTo] = rankBandColors(idx);
                  return (
                    <div key={h.hostName} className="flex items-stretch rounded-xl overflow-hidden" style={{ boxShadow: cardShadow }}>
                      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0 w-36 sm:w-48" style={{ background: PALETTE.panel, borderTop: `1px solid ${PALETTE.line}`, borderBottom: `1px solid ${PALETTE.line}`, borderLeft: `1px solid ${PALETTE.line}` }}>
                        <Radio size={14} style={{ color: LIVE_ACCENT }} className="shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold truncate">{h.hostName}</div>
                          <div className="text-[10px] truncate" style={{ color: PALETTE.inkSoft }} title={h.accountName}>{h.accountName}</div>
                        </div>
                      </div>
                      <div className="flex-1 flex items-center justify-between gap-3 px-4 py-2.5" style={{ background: `linear-gradient(110deg, ${bandFrom}, ${bandTo})` }}>
                        <div className="flex items-center gap-2 shrink-0">
                          {idx === 0 ? <Trophy size={20} className="text-white drop-shadow" /> : idx <= 2 ? <Medal size={18} className="text-white/90" /> : null}
                          <span className="text-white font-black text-xl sm:text-2xl leading-none" style={{ fontFamily: "'Sora', sans-serif" }}>{idx + 1}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-extrabold text-base sm:text-lg leading-none" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(h.gmv)}</div>
                          <div className="text-white/80 text-[10px] mt-0.5">{h.sessions} sesi \u2022 {fmtNum(h.orders)} orders \u2022 {fmtHours(h.hours)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* daftar sesi live */}
          <Card>
            <SectionTitle eyebrow={livePeriodLabel} title="Daftar Sesi Live" />
            {liveSessionsForMonth.length === 0 ? (
              <div className="text-sm py-6 text-center" style={{ color: PALETTE.inkFaint }}>Belum ada sesi live tercatat di {livePeriodLabel}.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1100px]">
                  <thead>
                    <tr className="text-left" style={{ color: PALETTE.inkSoft }}>
                      <th className="font-medium py-1.5 pr-3">Date</th>
                      <th className="font-medium py-1.5 pr-3">Toko</th>
                      <th className="font-medium py-1.5 pr-3">HOST</th>
                      <th className="font-medium py-1.5 pr-3">Start</th>
                      <th className="font-medium py-1.5 pr-3">End</th>
                      <th className="font-medium py-1.5 pr-3">Live Hours</th>
                      <th className="font-medium py-1.5 pr-3">Orders</th>
                      <th className="font-medium py-1.5 pr-3">Direct GMV</th>
                      <th className="font-medium py-1.5 pr-3">Viewers</th>
                      <th className="font-medium py-1.5 pr-3">CO%</th>
                      <th className="font-medium py-1.5 pr-3">CTR%</th>
                      <th className="font-medium py-1.5 pr-3">GPM</th>
                      <th className="font-medium py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveSessionsForMonth.map((s) => {
                      const canEdit = true; // semua yang login boleh kelola data Live Tracker (beda dari GMV yang dibatasi per-toko)
                      const hrs = calcLiveHours(s.startTime, s.endTime);
                      return (
                        <tr key={s.id} className="border-t" style={{ borderColor: PALETTE.line }}>
                          <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.date}</td>
                          <td className="py-2 pr-3"><div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: liveAccountOptions.find((a) => a.id === s.accountId)?.color || PALETTE.inkFaint }} />{s.accountName}<PlatformTag platform={s.platform} /></div></td>
                          <td className="py-2 pr-3 font-medium">{s.hostName}</td>
                          <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.startTime || "—"}</td>
                          <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.endTime || "—"}</td>
                          <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace", color: LIVE_ACCENT_DEEP }}>{fmtHours(hrs)}</td>
                          <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.orders !== null ? fmtNum(s.orders) : "—"}</td>
                          <td className="py-2 pr-3 font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.directGmv !== null ? fmtRp(s.directGmv) : "—"}</td>
                          <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.totalViewers !== null ? fmtNum(s.totalViewers) : "—"}</td>
                          <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.co !== null && s.co !== undefined ? `${fmtRating(s.co)}%` : "—"}</td>
                          <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.ctr !== null && s.ctr !== undefined ? `${fmtRating(s.ctr)}%` : "—"}</td>
                          <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.gpm !== null ? fmtNum(s.gpm) : "—"}</td>
                          <td className="py-2">
                            {canEdit && (
                              <button onClick={() => removeLiveSession(s)} className="p-1 rounded hover:opacity-70" style={{ color: PALETTE.coral }} title="Hapus sesi ini">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ===================== JADWAL LIVE ===================== */}
      {tab === "jadwal" && (() => {
        const wk = schedWeekKey;
        const wData = schedData[wk] || { slots: {}, off: {} };

        const fmtWeekLabel = () => {
          const s = schedWeekDays[0], e = schedWeekDays[6];
          const M = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
          return `${s.getDate()} ${M[s.getMonth()]} – ${e.getDate()} ${M[e.getMonth()]} ${e.getFullYear()}`;
        };

        // Status compliance per hari per host
        const recapData = schedWeekDays.map((d) => {
          const dk = ymd(d);
          const daySlots = wData.slots?.[dk] || {};
          const dayOff = wData.off?.[dk] || [];
          return {
            date: d, dk,
            hosts: schedHosts.map((h) => {
              const isOff = dayOff.includes(h.id);
              // Kumpulkan SEMUA assignment host ini di semua room pada hari itu
              // (satu host bisa live di room yang sama/berbeda di jam yang berbeda)
              const allAssignments = [];
              Object.values(daySlots).forEach((roomData) => {
                const list = Array.isArray(roomData) ? roomData : (roomData?.hostId ? [roomData] : []);
                list.filter((asn) => asn.hostId === h.id).forEach((asn) => allAssignments.push(asn));
              });
              if (isOff) return { host: h, status: "off", slot: null, compliance: null };
              if (!allAssignments.length) return { host: h, status: "unscheduled", slot: null, compliance: null };
              // Gabungkan semua starts dari semua assignment, dengan session durations yang sesuai
              const allStarts = allAssignments.flatMap((asn) => asn.starts || []);
              const allDurations = allAssignments.flatMap(() => [...h.sessions]);
              const compliance = checkSchedCompliance(h.name, dk, allStarts, allDurations);
              return { host: h, status: compliance?.status || "scheduled", slot: allAssignments[0], compliance };
            }),
          };
        });

        const statusColor = {
          on_time: SCHED_ACCENT,
          partial: "#F59E0B",
          wrong_time: "#D97706", // amber — ada live tapi tidak sesuai jadwal
          short: "#7C3AED",     // ungu — live tapi kurang jam
          missed: LIVE_ACCENT,
          absent: LIVE_ACCENT,
          off: PALETTE.inkFaint,
          unscheduled: PALETTE.inkFaint,
          scheduled: PALETTE.inkSoft
        };
        // Label dan detail kini diambil langsung dari compliance.detail

        return (
          <div className="space-y-5">
            {/* header navigasi minggu */}
            <Card accent={SCHED_ACCENT}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Calendar size={18} style={{ color: SCHED_ACCENT }} />
                  <span className="text-sm font-bold" style={{ color: PALETTE.ink }}>Jadwal Live Mingguan</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: PALETTE.line }}>
                    {(isAdmin ? [["view","👁 View"],["edit","✏️ Edit"]] : [["view","👁 View"]]).map(([m,l]) => (
                      <button key={m} onClick={() => setSchedMode(m)} className="text-xs px-3 py-1.5 font-semibold transition-all"
                        style={{ background: schedMode === m ? `linear-gradient(135deg,${SCHED_ACCENT},${SCHED_DEEP})` : PALETTE.panel, color: schedMode === m ? "#fff" : PALETTE.inkSoft }}>{l}</button>
                    ))}
                  </div>
                  <button onClick={() => setSchedRecapView((v) => !v)} className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
                    style={{ borderColor: schedRecapView ? SCHED_ACCENT : PALETTE.line, background: schedRecapView ? SCHED_SOFT : PALETTE.panel, color: schedRecapView ? SCHED_DEEP : PALETTE.inkSoft }}>
                    📊 Rekap Mingguan
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => setSchedWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate()-7); return d; })} className="px-2 py-1 rounded text-sm" style={{ background: PALETTE.panelAlt }}>‹</button>
                <span className="text-sm font-semibold flex-1 text-center" style={{ color: PALETTE.ink }}>{fmtWeekLabel()}</span>
                <button onClick={() => setSchedWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate()+7); return d; })} className="px-2 py-1 rounded text-sm" style={{ background: PALETTE.panelAlt }}>›</button>
              </div>
            </Card>

            {/* grid jadwal */}
            {/* grid jadwal */}
            {!schedRecapView && (
              <Card>
                <div style={{ maxHeight: "75vh", overflowY: "auto", overflowX: "auto", position: "relative" }}>
                  <div style={{ display: "grid", gridTemplateColumns: `88px repeat(${7 * SCHEDULE_ROOMS.length}, minmax(75px,1fr))`, minWidth: 980 }}>
                    {/* corner — sticky kiri DAN atas */}
                    <div style={{ gridRow:"1/3", padding:"4px 2px", fontSize:9, color:PALETTE.inkSoft, textAlign:"center", borderRight:`2px solid ${PALETTE.line}`, borderBottom:`1px solid ${PALETTE.line}`, display:"flex", alignItems:"center", justifyContent:"center", background:PALETTE.panelAlt, position:"sticky", left:0, top:0, zIndex:40 }}>Jam</div>
                    {/* day headers — sticky atas, border kiri tebal sebagai pemisah antar hari */}
                    {schedWeekDays.map((d, di) => {
                      const dk = ymd(d), isToday = dk === todayStr(), dayOff = wData.off?.[dk] || [];
                      return (
                        <div key={di} style={{ gridColumn:`${2+di*SCHEDULE_ROOMS.length}/${2+di*SCHEDULE_ROOMS.length+SCHEDULE_ROOMS.length}`, padding:"6px 4px", fontSize:11, fontWeight:700, textAlign:"center", color:isToday?SCHED_ACCENT:PALETTE.ink, background:isToday?SCHED_SOFT:PALETTE.panelAlt, borderRight:`1px solid ${PALETTE.line}`, borderBottom:`1px solid ${PALETTE.line}`, borderLeft:`2px solid ${isToday?SCHED_ACCENT:PALETTE.ink}`, position:"sticky", top:0, zIndex:30, height:44 }}>
                          <div>{SCHED_DAYS_SHORT[d.getDay()]} {d.getDate()}/{d.getMonth()+1}</div>
                          {dayOff.length > 0 && <div style={{ fontSize:8, color:LIVE_ACCENT }}>OFF: {dayOff.map(id=>schedHosts.find(h=>h.id===id)?.name||id).join(", ")}</div>}
                          {schedMode === "edit" && (
                            <div style={{ marginTop:2, display:"flex", flexWrap:"wrap", justifyContent:"center", gap:2 }}>
                              {schedHosts.map((h) => (
                                <button key={h.id} onClick={() => toggleSchedOff(d, h.id)}
                                  style={{ fontSize:7, padding:"1px 4px", borderRadius:3, border:`1px solid ${dayOff.includes(h.id)?LIVE_ACCENT:"#ddd"}`, background:dayOff.includes(h.id)?"#FFE4E9":"#fff", color:dayOff.includes(h.id)?LIVE_ACCENT:PALETTE.inkSoft, cursor:"pointer" }}>
                                  {h.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* room sub-headers — sticky top:44px, border kiri tebal untuk kolom R1A tiap hari */}
                    {schedWeekDays.map((d, di) =>
                      SCHEDULE_ROOMS.map((room, ri) => (
                        <div key={`rh-${di}-${ri}`} style={{ fontSize:9, padding:"3px 2px", textAlign:"center", color:PALETTE.inkSoft, borderRight:`1px solid ${PALETTE.line}`, borderBottom:`1px solid ${PALETTE.line}`, borderLeft: ri===0 ? `2px solid ${PALETTE.line}` : "none", background:PALETTE.panelAlt, position:"sticky", top:44, zIndex:25, height:24, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {room.replace("Ruang ","R")}
                        </div>
                      ))
                    )}
                    {/* hour rows — label jam pakai range 08:00-09:00 */}
                    {Array.from({ length: 24 }, (_, hr) => (
                      <React.Fragment key={hr}>
                        <div style={{ fontSize:9, textAlign:"center", color:PALETTE.inkSoft, borderRight:`2px solid ${PALETTE.line}`, borderBottom:`1px solid ${PALETTE.line}`, padding:"2px 3px", display:"flex", alignItems:"center", justifyContent:"center", background:PALETTE.panelAlt, whiteSpace:"nowrap", position:"sticky", left:0, zIndex:15, fontWeight: hr >= 8 && hr <= 22 ? 500 : 400 }}>
                          {String(hr).padStart(2,"0")}:00–{String(hr+1).padStart(2,"00")}:00
                        </div>
                        {schedWeekDays.map((d, di) => {
                          const dk = ymd(d), daySlots = wData.slots?.[dk] || {}, dayOff = wData.off?.[dk] || [];
                          return SCHEDULE_ROOMS.map((room, ri) => {
                            const rawEntry = daySlots[room];
                            const assignments = Array.isArray(rawEntry) ? rawEntry : (rawEntry?.hostId ? [rawEntry] : []);
                            const activeList = assignments.map((asn) => {
                              const h = schedHosts.find((x) => x.id === asn.hostId);
                              if (!h || dayOff.includes(h.id) || !asn.starts) return null;
                              let active = false, isStart = false;
                              h.sessions.forEach((dur, si) => {
                                const st = asn.starts[si];
                                if (st != null && hr >= st && hr < st+dur) active = true;
                                if (st === hr) isStart = true;
                              });
                              return active ? { h, asn, isStart } : null;
                            }).filter(Boolean);
                            return (
                              <div key={`cell-${di}-${ri}-${hr}`}
                                style={{ borderRight:`1px solid ${PALETTE.line}`, borderBottom:`1px solid ${PALETTE.line}`, borderLeft: ri===0 ? `2px solid ${PALETTE.line}` : "none", minHeight:24, cursor:schedMode==="edit"?"pointer":"default", position:"relative" }}
                                onClick={() => { if (schedMode!=="edit") return; setSchedEditCtx({date:d,room}); setSchedSesiStarts([]); setShowSchedSidebar(true); }}>
                                {activeList.map(({ h, asn, isStart }, ai) => (
                                  <div key={asn.id||ai} style={{ background:h.bg, borderLeft:`2px solid ${h.color}`, padding:"1px 3px", fontSize:8, lineHeight:1.4, fontWeight:600, color:h.color, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                                    {isStart ? `${h.name}${asn.toko ? ` · ${asn.toko}` : ""}` : h.name}
                                  </div>
                                ))}
                                {activeList.length===0 && schedMode==="edit" && (
                                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", fontSize:9, opacity:0.1, color:PALETTE.inkSoft }}>+</div>
                                )}
                              </div>
                            );
                          });
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* SIDEBAR EDIT — multiple host per room */}
                {showSchedSidebar && schedEditCtx && (() => {
                  const { date, room } = schedEditCtx;
                  const dk = ymd(date);
                  const dayOff = wData.off?.[dk] || [];
                  const rawEntry = wData.slots?.[dk]?.[room];
                  const assignments = Array.isArray(rawEntry) ? rawEntry : (rawEntry?.hostId ? [rawEntry] : []);
                  const selHost = schedHosts.find((h) => h.id === schedEditCtx.hostId);
                  // Semua host yang tidak OFF bisa dipilih — boleh masuk ruangan yang sama
                  // di jam berbeda dengan toko berbeda (multiple assignment per host per room)
                  const availableHosts = schedHosts.filter((h) => !dayOff.includes(h.id));
                  return (
                    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(28,21,35,0.45)" }}>
                      <div style={{ background:PALETTE.panel, border:`1px solid ${PALETTE.line}`, borderRadius:12, padding:20, width:"min(96vw,440px)", maxHeight:"90vh", overflowY:"auto" }}>
                        <h3 style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>{SCHED_DAYS_SHORT[date.getDay()]} {date.getDate()}/{date.getMonth()+1} — {room}</h3>
                        <div style={{ fontSize:11, color:PALETTE.inkSoft, marginBottom:12 }}>Satu ruangan bisa diisi beberapa host di jam berbeda</div>

                        {/* daftar yang sudah ada */}
                        {assignments.length > 0 && (
                          <div style={{ marginBottom:12 }}>
                            <div style={{ fontSize:10, fontWeight:600, color:PALETTE.inkSoft, marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Sudah terjadwal di ruangan ini:</div>
                            {assignments.map((asn) => {
                              const h = schedHosts.find((x) => x.id === asn.hostId);
                              if (!h) return null;
                              const jamLabel = h.sessions.map((dur, si) => {
                                const st = asn.starts?.[si];
                                return st != null ? `${String(st).padStart(2,"0")}:00–${String(st+dur).padStart(2,"00")}:00` : "—";
                              }).join(", ");
                              return (
                                <div key={asn.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", borderRadius:8, background:h.bg, border:`1px solid ${h.color}`, marginBottom:4 }}>
                                  <span style={{ width:8, height:8, borderRadius:"50%", background:h.color, flexShrink:0 }} />
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:11, fontWeight:700, color:h.color }}>{h.name}</div>
                                    <div style={{ fontSize:9, color:PALETTE.inkSoft }}>{asn.toko||"—"} · {jamLabel}</div>
                                  </div>
                                  <button onClick={() => removeSchedAssignment(date, room, asn.id)}
                                    style={{ fontSize:10, color:LIVE_ACCENT, background:"none", border:`1px solid ${LIVE_ACCENT}`, borderRadius:4, padding:"2px 8px", cursor:"pointer", flexShrink:0 }}>Hapus</button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* form tambah host baru */}
                        <div style={{ background:PALETTE.panelAlt, borderRadius:10, padding:12 }}>
                          <div style={{ fontSize:10, fontWeight:700, color:SCHED_ACCENT, marginBottom:8 }}>+ Tambah Host ke Ruangan Ini</div>
                          <div style={{ fontSize:10, color:PALETTE.inkSoft, marginBottom:4 }}>Host</div>
                          <select value={schedEditCtx.hostId||""} onChange={(e) => { setSchedEditCtx((c) => ({...c, hostId:e.target.value})); setSchedSesiStarts([]); }}
                            style={{ width:"100%", border:`1px solid ${PALETTE.line}`, borderRadius:6, padding:"5px 7px", fontSize:12, marginBottom:8 }}>
                            <option value="">— Pilih host —</option>
                            {availableHosts.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.sessions.join("+")} jam)</option>)}
                          </select>
                          {availableHosts.length===0 && <div style={{ fontSize:9, color:PALETTE.inkFaint, marginBottom:8 }}>Semua host sedang OFF hari ini.</div>}
                          {availableHosts.length>0 && assignments.some(a=>a.hostId===schedEditCtx.hostId) && schedEditCtx.hostId && (
                            <div style={{ fontSize:9, color:"#D97706", marginBottom:4 }}>⚠ Host ini sudah ada di ruangan ini — pastikan jam sesinya berbeda.</div>
                          )}
                          <div style={{ fontSize:10, color:PALETTE.inkSoft, marginBottom:2 }}>Toko</div>
                          <div style={{ fontSize:8.5, color:PALETTE.inkFaint, marginBottom:4 }}>Toko baru? Tambah di Live Tracker → Kelola Toko Live-Only</div>
                          <select id="scedTokoSel" style={{ width:"100%", border:`1px solid ${PALETTE.line}`, borderRadius:6, padding:"5px 7px", fontSize:12, marginBottom:8 }}>
                            <option value="">— Pilih toko —</option>
                            {liveAccountOptions.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                          </select>
                          {selHost && (
                            <div>
                              <div style={{ fontSize:10, color:PALETTE.inkSoft, marginBottom:6 }}>Pilih jam mulai — {selHost.sessions.length} sesi ({selHost.sessions.join("+")} jam)</div>
                              {selHost.sessions.map((dur, si) => {
                                const cur = schedSesiStarts[si]??null;
                                return (
                                  <div key={si} style={{ background:"#fff", borderRadius:8, padding:8, marginBottom:6, border:`1px solid ${PALETTE.line}` }}>
                                    <div style={{ fontSize:10, fontWeight:600, marginBottom:4, color:selHost.color }}>
                                      Sesi {si+1} · {dur}j {cur!=null?`→ ${String(cur).padStart(2,"0")}:00–${String(cur+dur).padStart(2,"00")}:00`:""}
                                    </div>
                                    <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:3 }}>
                                      {Array.from({length:25-dur},(_,hr)=>(
                                        <button key={hr} onClick={()=>setSchedSesiStarts(prev=>{const n=[...prev];n[si]=hr;return n;})}
                                          style={{ padding:"3px 1px", borderRadius:4, border:`1px solid ${cur===hr?selHost.color:"#ddd"}`, fontSize:9, cursor:"pointer", textAlign:"center", background:cur===hr?selHost.color:"#f8f8f6", color:cur===hr?"#fff":"#555" }}>
                                          {String(hr).padStart(2,"0")}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div style={{ display:"flex", gap:8, marginTop:10 }}>
                            <button onClick={()=>{setShowSchedSidebar(false);setSchedEditCtx(null);}}
                              style={{ flex:1, padding:"7px 0", borderRadius:8, border:`1px solid ${PALETTE.line}`, background:PALETTE.panel, color:PALETTE.inkSoft, fontSize:12, cursor:"pointer" }}>Tutup</button>
                            <button onClick={async()=>{
                              const hostId=schedEditCtx.hostId;
                              const toko=document.getElementById("scedTokoSel")?.value||"";
                              if(!hostId){showToast("error","Pilih host dulu.");return;}
                              await addSchedAssignment(date,room,{hostId,toko,starts:[...schedSesiStarts]});
                              setSchedEditCtx(c=>({...c,hostId:""})); setSchedSesiStarts([]);
                              showToast("success","Host ditambahkan ke ruangan.");
                            }} style={{ flex:2, padding:"7px 0", borderRadius:8, border:"none", background:SCHED_ACCENT, color:"#fff", fontSize:12, cursor:"pointer", fontWeight:700 }}>
                              + Tambah ke Ruangan
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* legend */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                  {schedHosts.map((h) => (
                    <div key={h.id} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:PALETTE.inkSoft }}>
                      <div style={{ width:10, height:10, borderRadius:3, background:h.bg, border:`1px solid ${h.color}` }} />
                      <span style={{ color:h.color, fontWeight:600 }}>{h.name}</span>
                      <span>({h.sessions.join("+")}j)</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            )}

            {/* rekap mingguan */}
            {schedRecapView && (
              <Card>
                <SectionTitle eyebrow={fmtWeekLabel()} title="Rekap Kehadiran Live" />
                <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>
                  Perbandingan jadwal yang sudah diset vs data Live Tracker aktual. "Sesuai" = host live pada hari yang sama dengan waktu yang overlapping dengan jadwal.
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 640 }}>
                    <thead>
                      <tr style={{ color: PALETTE.inkSoft }}>
                        <th className="font-medium py-1.5 pr-3 text-left">Host</th>
                        {schedWeekDays.map((d, i) => (
                          <th key={i} className="font-medium py-1.5 px-2 text-center" style={{ fontSize: 11 }}>
                            {SCHED_DAYS_SHORT[d.getDay()]}<br />{d.getDate()}/{d.getMonth()+1}
                          </th>
                        ))}
                        <th className="font-medium py-1.5 px-2 text-center">Total Hari</th>
                        <th className="font-medium py-1.5 px-2 text-center">Total GMV Live</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedHosts.map((h) => {
                        let totalOnTime = 0, totalWrongTime = 0, totalShort = 0, totalMissed = 0, totalScheduled = 0, totalGmv = 0;
                        const dayCells = recapData.map((day) => {
                          const hd = day.hosts.find((x) => x.host.id === h.id);
                          if (!hd) return null;
                          if (hd.status === "unscheduled") return { status: "unscheduled" };
                          if (hd.status === "off") return { status: "off" };
                          totalScheduled++;
                          if (hd.status === "on_time") totalOnTime++;
                          else if (hd.status === "wrong_time") totalWrongTime++;
                          else if (hd.status === "short") totalShort++;
                          else if (hd.status === "missed" || hd.status === "absent") totalMissed++;
                          if (hd.compliance?.totalActualGmv) totalGmv += hd.compliance.totalActualGmv;
                          return hd;
                        });
                        return (
                          <tr key={h.id} className="border-t" style={{ borderColor: PALETTE.line }}>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-1.5">
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: h.color, display: "inline-block" }} />
                                <span className="font-semibold text-xs">{h.name}</span>
                              </div>
                              <div style={{ fontSize: 9, color: PALETTE.inkSoft }}>{h.sessions.join("+")}j/hari</div>
                            </td>
                            {dayCells.map((cell, ci) => {
                              if (!cell || cell.status === "unscheduled") return (
                                <td key={ci} className="py-2 px-2 text-center" style={{ fontSize: 10, color: PALETTE.inkFaint }}>—</td>
                              );
                              if (cell.status === "off") return (
                                <td key={ci} className="py-2 px-2 text-center" style={{ fontSize: 10, color: PALETTE.inkFaint }}>OFF</td>
                              );
                              const sc = statusColor[cell.status] || PALETTE.inkSoft;
                              const detailLines = (cell.compliance?.detail || cell.status).split("\n");
                              return (
                                <td key={ci} className="py-2 px-1 text-center" style={{ verticalAlign: "top" }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: sc, whiteSpace: "nowrap" }}>{detailLines[0]}</div>
                                  {detailLines.slice(1).map((line, li) => (
                                    <div key={li} style={{ fontSize: 8.5, color: PALETTE.inkSoft, marginTop: 1, whiteSpace: "nowrap" }}>{line}</div>
                                  ))}
                                  {cell.compliance?.totalActualGmv > 0 && (
                                    <div style={{ fontSize: 9, color: PALETTE.inkSoft, marginTop: 1 }}>{fmtCompactRp(cell.compliance.totalActualGmv)}</div>
                                  )}
                                  {cell.slot?.toko && <div style={{ fontSize: 8, color: PALETTE.inkFaint, marginTop: 1 }}>{cell.slot.toko}</div>}
                                </td>
                              );
                            })}
                            <td className="py-2 px-2 text-center" style={{ verticalAlign: "top" }}>
                              {totalScheduled > 0 ? (
                                <div style={{ fontSize: 10 }}>
                                  {totalOnTime > 0 && <div style={{ color: SCHED_ACCENT, fontWeight: 700 }}>✓ {totalOnTime} sesuai</div>}
                                  {totalWrongTime > 0 && <div style={{ color: "#D97706", fontWeight: 600 }}>⚠ {totalWrongTime} tdk sesuai</div>}
                                  {totalShort > 0 && <div style={{ color: "#7C3AED", fontWeight: 600 }}>⏱ {totalShort} kurang jam</div>}
                                  {totalMissed > 0 && <div style={{ color: LIVE_ACCENT, fontWeight: 600 }}>✗ {totalMissed} tdk live</div>}
                                </div>
                              ) : <div style={{ fontSize: 10, color: PALETTE.inkFaint }}>—</div>}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: PALETTE.ink }}>{totalGmv > 0 ? fmtCompactRp(totalGmv) : "—"}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* kelola host jadwal */}
            {isAdmin && (
              <Card>
                <SectionTitle title="Kelola Host Jadwal" eyebrow="Hanya admin" />
                <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>
                  Tambahkan host ke grid jadwal minggu ini dengan mengatur pola sesi dan warna. Nama dipilih dari daftar host bersama (sama dengan Live Tracker). Untuk tambah nama baru, kelola di tab <b>Live Tracker → Kelola Daftar Host</b>.
                </div>
                <div className="flex items-end gap-2 flex-wrap mb-4 p-3 rounded-xl" style={{ background: PALETTE.panelAlt }}>
                  <div style={{ flex: "1 1 140px" }}>
                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4, color: PALETTE.inkSoft }}>Nama Host</label>
                    <select value={schedNewName} onChange={(e) => setSchedNewName(e.target.value)}
                      className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: SCHED_SOFT }}>
                      <option value="">Pilih nama host…</option>
                      {hostNames.filter((n) => !schedHosts.some((h) => h.name === n)).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: "1 1 100px" }}>
                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4, color: PALETTE.inkSoft }}>Sesi (jam, pisahkan koma)</label>
                    <input type="text" value={schedNewSessions} onChange={(e) => setSchedNewSessions(e.target.value)} placeholder="2,2"
                      className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: SCHED_SOFT }} />
                    <div style={{ fontSize: 9, color: PALETTE.inkFaint, marginTop: 2 }}>contoh: 2,2 = 2 sesi masing-masing 2 jam</div>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4, color: PALETTE.inkSoft }}>Warna</label>
                    <input type="color" value={schedNewColor} onChange={(e) => setSchedNewColor(e.target.value)}
                      style={{ width: 36, height: 34, border: `1px solid ${PALETTE.line}`, borderRadius: 6, cursor: "pointer", padding: 2 }} />
                  </div>
                  <button onClick={addSchedHost} className={`${btnClass} flex items-center gap-1.5`}
                    style={{ background: `linear-gradient(135deg,${SCHED_ACCENT},${SCHED_DEEP})`, color: "#fff" }}>
                    <PlusCircle size={14} />Tambah Host
                  </button>
                </div>
                {schedHosts.length === 0 ? (
                  <div style={{ fontSize: 13, color: PALETTE.inkFaint, padding: "8px 0" }}>Belum ada host. Tambahkan host dulu sebelum mengisi jadwal.</div>
                ) : (
                  <div className="space-y-2">
                    {schedHosts.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: PALETTE.panelAlt }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: h.color, flexShrink: 0 }} />
                        <span className="text-sm font-semibold flex-1">{h.name}</span>
                        <span style={{ fontSize: 11, color: PALETTE.inkSoft }}>Sesi: {h.sessions.join(" + ")} jam</span>
                        <button onClick={() => removeSchedHost(h.id)} style={{ color: LIVE_ACCENT, background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        );
      })()}

      {/* ===================== TARGET & AKUN ===================== */}
      {tab === "settings" && (
        <div className="space-y-5">
          {isAdmin && (
            <Card accent={PALETTE.ochre}>
              <SectionTitle eyebrow="Sekali Jalan" title="Migrasi Data Lama" />
              <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>
                Sebelum sistem login per-toko ini ada, data tersimpan dalam format lama (satu blok gabungan). Klik tombol ini <b>sekali saja</b> supaya GMV, target, dan riwayat revisi yang sudah pernah diinput (termasuk data Juni 1–18) ikut pindah ke struktur baru per-akun. Aman diklik berkali-kali kalau ragu — tidak akan menduplikasi data.
              </div>
              <button onClick={migrateLegacyData} className={btnClass} style={btnPrimaryStyle(PALETTE.ochre, PALETTE.ochreDeep)}>Migrasikan Data Lama Sekarang</button>
            </Card>
          )}

          {isAdmin && (
            <Card>
              <SectionTitle title="Import dari Google Sheets" />
              <div className="text-sm mb-1">Sumber: <span className="font-medium">EC PLAN</span> (Google Sheets), tab Juni 2026.</div>
              <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>
                Berisi nama 7 akun asli, target Juni 2026, dan GMV harian 1–17 Juni. Klik untuk isi otomatis ke dashboard ini — tidak akan menghapus data bulan lain atau hari 18 ke atas. Ini import sekali jalan (snapshot), bukan sinkron otomatis terus-menerus.
              </div>
              <button onClick={importJune2026} className={btnClass} style={btnPrimaryStyle(PALETTE.plum, PALETTE.plumDeep)}>Import Data Juni 2026</button>
            </Card>
          )}

          <Card>
            <SectionTitle eyebrow={periodLabel} title="Target GMV Bulanan" right={
              isAdmin && <button onClick={copyFromLastMonth} className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded border" style={{ borderColor: PALETTE.line, color: PALETTE.inkSoft }}><Copy size={12} />Salin dari bulan lalu</button>
            } />
            {!isAdmin && <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>Target semua toko kelihatan di sini, tapi kamu cuma bisa ubah target tokomu sendiri.</div>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[460px]">
                <thead><tr className="text-left" style={{ color: PALETTE.inkSoft }}><th className="font-medium py-1.5">Akun</th><th className="font-medium py-1.5">Target GMV (Rp)</th></tr></thead>
                <tbody>
                  {accounts.map((acc) => {
                    const canEdit = isAdmin || acc.id === myAccountId;
                    return (
                      <tr key={acc.id} className="border-t" style={{ borderColor: PALETTE.line }}>
                        <td className="py-2"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: acc.color }} />{acc.name}<PlatformTag platform={acc.platform} /></div></td>
                        <td className="py-2">
                          {canEdit ? (
                            <input type="text" inputMode="numeric" value={targetDraft[acc.id] !== undefined ? fmtNum(targetDraft[acc.id]) : ""}
                              onChange={(e) => setTargetDraft((p) => ({ ...p, [acc.id]: parseNum(e.target.value) }))}
                              className="text-sm px-2.5 py-1.5 rounded border outline-none w-44 text-right" style={{ borderColor: PALETTE.line, fontFamily: "'JetBrains Mono', monospace" }} />
                          ) : (
                            <span className="text-sm" style={{ fontFamily: "'JetBrains Mono', monospace", color: PALETTE.inkSoft }}>{fmtRp(targetDraft[acc.id] || 0)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t" style={{ borderColor: PALETTE.line }}>
                    <td className="py-2 font-semibold">Total Gabungan</td>
                    <td className="py-2 font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(accounts.reduce((s, a) => s + (targetDraft[a.id] || 0), 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button onClick={saveTargets} disabled={saving} className={`mt-4 ${btnClass} flex items-center gap-1.5`} style={{ ...btnPrimaryStyle(PALETTE.brand, PALETTE.brandDeep), opacity: saving ? 0.7 : 1, cursor: saving ? "wait" : "pointer" }}>
              {saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Menyimpan…" : `Simpan Target ${monthLabel(selectedMonth)}`}
            </button>
          </Card>

          {isAdmin && (
            <Card>
              <SectionTitle title="Nama Akun & Benchmark" right={
                <button onClick={fillFullShopNames} className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded border" style={{ borderColor: PALETTE.line, color: PALETTE.inkSoft }}><Copy size={12} />Isi Nama Lengkap Toko</button>
              } />
              <div className="text-[11px] mb-3" style={{ color: PALETTE.inkFaint }}>Daftar di bawah ini khusus toko yang ditrack GMV harian-nya (Input Data, Target, Sumber GMV, Performa Iklan). Untuk toko yang cuma perlu dijadwalkan live-nya tanpa tracking GMV, tambahkan di tab <b>Live Tracker</b> langsung.</div>

              <div className="space-y-2 mb-4">
                {accountDraft.map((acc, idx) => (
                  <div key={acc.id} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: acc.color }} />
                    <PlatformTag platform={acc.platform} />
                    <input type="text" value={acc.name} onChange={(e) => setAccountDraft((prev) => prev.map((a, i) => (i === idx ? { ...a, name: e.target.value } : a)))}
                      className="text-sm px-2.5 py-1.5 rounded border outline-none flex-1 max-w-xs" style={{ borderColor: PALETTE.line }} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Target ROAS Minimum (opsional)</label>
                  <input type="text" inputMode="numeric" value={benchmarkDraft.targetROAS || ""} onChange={(e) => setBenchmarkDraft((p) => ({ ...p, targetROAS: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 }))}
                    className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: PALETTE.line, fontFamily: "'JetBrains Mono', monospace" }} placeholder="contoh: 5" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: PALETTE.inkSoft }}>Target Conversion Rate Minimum % (opsional)</label>
                  <input type="text" inputMode="numeric" value={benchmarkDraft.targetCR || ""} onChange={(e) => setBenchmarkDraft((p) => ({ ...p, targetCR: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 }))}
                    className="text-sm px-2.5 py-1.5 rounded border outline-none w-full" style={{ borderColor: PALETTE.line, fontFamily: "'JetBrains Mono', monospace" }} placeholder="contoh: 3" />
                </div>
              </div>
              <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>Benchmark ini dipakai analisis "Area yang Perlu Ditingkatkan" di tab Ringkasan — kosongkan jika belum punya angka acuan, sistem tetap akan menganalisis berdasarkan tren naik/turun.</div>
              <button onClick={saveAccountsAndBenchmarks} disabled={saving} className={`${btnClass} flex items-center gap-1.5`} style={{ ...btnPrimaryStyle(PALETTE.brand, PALETTE.brandDeep), opacity: saving ? 0.7 : 1, cursor: saving ? "wait" : "pointer" }}>
                {saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Menyimpan…" : "Simpan Perubahan"}
              </button>
            </Card>
          )}

          {isAdmin && (
            <Card>
              <SectionTitle eyebrow="Kebijakan Retensi Data" title="Rekap Tahunan (Excel)" />
              <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>
                Dashboard ini <b>tidak pernah menghapus data secara otomatis</b> — riwayat revisi dan data harian tersimpan permanen sampai ada yang menghapusnya secara manual di bawah. Catatan teknis: tidak ada proses terjadwal yang berjalan sendiri tiap tahun (artifact ini cuma aktif kalau ada yang membuka tab-nya) — jadi export rekap di bawah ini perlu di-klik manual, idealnya di akhir tahun atau kapan pun sebelum kamu memutuskan untuk menghapus data tahun tertentu.
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={recapYear} onChange={(e) => setRecapYear(e.target.value)} className="text-sm px-3 py-1.5 rounded border outline-none" style={{ borderColor: PALETTE.line }}>
                  {yearsWithData.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={() => exportYearlyRecap(recapYear)} className={`${btnClass} flex items-center gap-1.5`} style={btnPrimaryStyle(PALETTE.plum, PALETTE.plumDeep)}>
                  <FileSpreadsheet size={14} />Export Rekap {recapYear} (.xlsx)
                </button>
                {exportedYears[recapYear] && (
                  <span className="text-xs flex items-center gap-1" style={{ color: PALETTE.teal }}>
                    <CheckCircle2 size={13} />Terakhir diexport {new Date(exportedYears[recapYear]).toLocaleString("id-ID")}
                  </span>
                )}
              </div>
              <div className="text-[11px] mt-2" style={{ color: PALETTE.inkSoft }}>File berisi 3 sheet: Ringkasan Tahunan (target vs realisasi per akun per bulan), Detail Harian (semua transaksi termasuk breakdown sumber GMV), dan Riwayat Revisi (jejak semua perubahan data tahun tersebut).</div>
            </Card>
          )}

          {isAdmin && (
            <Card>
              <SectionTitle title="Zona Berbahaya" />
              <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>Penghapusan hanya terjadi kalau kamu klik tombol ini secara eksplisit — tidak ada penghapusan otomatis dalam kondisi apa pun. Disarankan export rekap Excel tahun terkait dulu sebelum menghapus.</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={clearMonthEntries} className="text-sm flex items-center gap-1.5 px-3 py-2 rounded border" style={{ borderColor: PALETTE.coral, color: PALETTE.coral }}>
                  <Trash2 size={14} />Hapus Data Bulan {monthLabel(selectedMonth)}
                </button>
                <button onClick={() => clearYearEntries(recapYear)} className="text-sm flex items-center gap-1.5 px-3 py-2 rounded border" style={{ borderColor: PALETTE.coral, color: PALETTE.coral }}>
                  <Trash2 size={14} />Hapus Semua Data Tahun {recapYear}
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      <div className="text-[11px] mt-6 text-center" style={{ color: PALETTE.inkFaint }}>
        Login sebagai {isAdmin ? "Admin (akses penuh ke semua toko)" : "akun toko — kamu bisa lihat semua toko, tapi cuma bisa mengubah data tokomu sendiri"}. Tidak ada penghapusan otomatis; data hanya hilang lewat aksi manual eksplisit oleh Admin.
      </div>
    </div>
  </div>
  );
}
