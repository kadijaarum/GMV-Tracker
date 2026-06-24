import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import {
  ArrowUp, ArrowDown, Minus, AlertTriangle, CheckCircle2, Info,
  ClipboardPaste, ChevronDown, ChevronRight, Calendar, Trash2, Copy,
  Loader2, ShoppingBag, Music2, PlusCircle, FileSpreadsheet, Download, XCircle, Trophy, Medal,
} from "lucide-react";
import * as XLSX from "xlsx";
import { fetchAllEntries, saveEntryDay, deleteEntryDay, fetchAllTargets, saveTargetMonth, fetchAllRevisions, addRevisionRecord } from "./storageAdapter.js";

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

const ACCOUNT_COLORS = ["#7C3AED", "#EC4899", "#F59E0B", "#10B981", "#06B6D4", "#F43F5E", "#6366F1"];

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

function genMonthOptions(entries, targets) {
  const now = new Date(); const opts = new Set();
  for (let off = 1; off >= -36; off--) opts.add(ym(new Date(now.getFullYear(), now.getMonth() + off, 1)));
  // Pastikan bulan mana pun yang sudah punya data tetap bisa dipilih, walau lebih lama dari 36 bulan.
  Object.keys(entries || {}).forEach((d) => opts.add(d.slice(0, 7)));
  Object.keys(targets || {}).forEach((m) => opts.add(m));
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
  const [periodMode, setPeriodMode] = useState("month"); // "month" | "day"
  const [selectedDate, setSelectedDate] = useState(todayStr());

  // viewDates: daftar tanggal yang dipakai oleh SEMUA useMemo (overview, sourceBreakdown, dll).
  // Mode "month" = semua hari di selectedMonth (seperti sebelumnya).
  // Mode "day"   = cuma satu tanggal (selectedDate), dan selectedMonth ikut disesuaikan.

  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);
  const [benchmarks, setBenchmarks] = useState({ targetROAS: 0, targetCR: 0 });
  const [targets, setTargets] = useState({});
  const [entries, setEntries] = useState({});
  const [revisions, setRevisions] = useState([]);
  const [showAllRevisions, setShowAllRevisions] = useState(false);
  const [exportedYears, setExportedYears] = useState({});
  const [recapYear, setRecapYear] = useState(String(new Date().getFullYear()));

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
  const [accountDraft, setAccountDraft] = useState(DEFAULT_ACCOUNTS);
  const [benchmarkDraft, setBenchmarkDraft] = useState({ targetROAS: 0, targetCR: 0 });

  // ---- load on mount ----
  useEffect(() => {
    (async () => {
      const ok = typeof window !== "undefined" && !!window.storage;
      setStorageOk(ok);
      const [cfg, expYears] = await Promise.all([
        safeGet(CFG_KEY, null),
        safeGet(EXPORTED_YEARS_KEY, {}),
      ]);
      const finalCfg = cfg || { accounts: DEFAULT_ACCOUNTS, benchmarks: { targetROAS: 0, targetCR: 0 } };
      setAccounts(finalCfg.accounts);
      setBenchmarks(finalCfg.benchmarks);
      setAccountDraft(finalCfg.accounts);
      setBenchmarkDraft(finalCfg.benchmarks);
      setExportedYears(expYears);
      if (!cfg && ok) await safeSet(CFG_KEY, finalCfg);

      const accountIds = finalCfg.accounts.map((a) => a.id);
      try {
        const [ent, tgt, rev] = await Promise.all([
          fetchAllEntries(accountIds),
          fetchAllTargets(accountIds),
          fetchAllRevisions(),
        ]);
        setEntries(ent);
        setTargets(tgt);
        setRevisions(rev);
      } catch (e) {
        console.error("Gagal memuat data per-akun:", e);
      }
      setLoading(false);
    })();
  }, []);

  // ---- sync drafts when month or data changes ----
  useEffect(() => { setTargetDraft(targets[selectedMonth] || {}); }, [selectedMonth, targets]);
  useEffect(() => { setDraft(entries[inputDate] ? { ...entries[inputDate] } : {}); }, [inputDate, entries]);

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
  const viewDates = useMemo(
    () => periodMode === "day" ? [selectedDate] : monthDates,
    [periodMode, selectedDate, monthDates]
  );

  // selectedMonth ikut berubah kalau mode hari (supaya bulan yang ditampilkan tetap sesuai)
  const effectiveMonth = periodMode === "day" ? selectedDate.slice(0, 7) : selectedMonth;
  const periodLabel = periodMode === "day"
    ? new Date(selectedDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : monthLabel(selectedMonth);

  const overview = useMemo(() => {
    const { dim, elapsed, remaining, isPast, isCurrent } = monthMeta;
    const monthTargets = targets[selectedMonth] || {};
    const totalTarget = accounts.reduce((s, a) => s + (monthTargets[a.id] || 0), 0);
    const timeGonePercent = dim > 0 ? Math.min((elapsed / dim) * 100, 100) : 0;

    // Pencapaian hari ini selalu merujuk ke tanggal hari ini sungguhan & target bulan berjalan
    // sungguhan (bukan bulan yang sedang dibrowse), supaya tetap akurat walau selectedMonth beda.
    const curYM = todayYM();
    const curDim = daysInMonthOf(curYM);
    const curMonthTargets = targets[curYM] || {};

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
      const todayGmv = entries[todayStr()]?.[acc.id]?.gmv;
      const yestGmv = entries[ymd(addDays(effectiveToday(), -1))]?.[acc.id]?.gmv;
      const lastWeekGmv = entries[ymd(addDays(effectiveToday(), -7))]?.[acc.id]?.gmv;
      const dDoD = todayGmv !== undefined && yestGmv ? ((todayGmv - yestGmv) / yestGmv) * 100 : null;
      const dWoW = todayGmv !== undefined && lastWeekGmv ? ((todayGmv - lastWeekGmv) / lastWeekGmv) * 100 : null;

      const dailyTargetToday = curMonthTargets[acc.id] ? curMonthTargets[acc.id] / curDim : 0;
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

    const todayTotal = accounts.reduce((s, a) => s + (entries[todayStr()]?.[a.id]?.gmv || 0), 0);
    const yestTotal = accounts.reduce((s, a) => s + (entries[ymd(addDays(effectiveToday(), -1))]?.[a.id]?.gmv || 0), 0);
    const lastWeekTotal = accounts.reduce((s, a) => s + (entries[ymd(addDays(effectiveToday(), -7))]?.[a.id]?.gmv || 0), 0);
    const hasToday = accounts.some((a) => entries[todayStr()]?.[a.id]?.gmv !== undefined);
    const hasYest = accounts.some((a) => entries[ymd(addDays(effectiveToday(), -1))]?.[a.id]?.gmv !== undefined);
    const hasLastWeek = accounts.some((a) => entries[ymd(addDays(effectiveToday(), -7))]?.[a.id]?.gmv !== undefined);
    const dDoDTotal = hasToday && hasYest && yestTotal ? ((todayTotal - yestTotal) / yestTotal) * 100 : null;
    const dWoWTotal = hasToday && hasLastWeek && lastWeekTotal ? ((todayTotal - lastWeekTotal) / lastWeekTotal) * 100 : null;

    const curTotalTarget = accounts.reduce((s, a) => s + (curMonthTargets[a.id] || 0), 0);
    const dailyTargetTodayTotal = curTotalTarget > 0 ? curTotalTarget / curDim : 0;
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

    // Perbandingan dengan periode sebelumnya: mode bulan = bulan lalu, mode hari = hari sebelumnya
    const [selY, selM] = selectedMonth.split("-").map(Number);
    const lastMonthYM = ym(new Date(selY, selM - 2, 1));
    let lastMonthDates, lastMonthMtd, lastMonthTarget, lastMonthPct;
    if (periodMode === "day") {
      const prevDate = ymd(addDays(new Date(viewDates[0]), -1));
      lastMonthDates = [prevDate];
      lastMonthMtd = accounts.reduce((s, a) => s + (entries[prevDate]?.[a.id]?.gmv || 0), 0);
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
    };
  }, [accounts, targets, entries, selectedMonth, monthMeta, viewDates, periodMode]);

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

    const perAccount = accounts.map((acc) => {
      const spend = sumField(entries, allDatesInMonth, acc.id, "adSpend");
      const revenue = sumField(entries, allDatesInMonth, acc.id, "adRevenue");
      const orders = sumField(entries, allDatesInMonth, acc.id, "orders");
      const roas = spend > 0 ? revenue / spend : null;
      const cpa = orders > 0 ? spend / orders : null;
      const daysWithAdData = allDatesInMonth.filter((d) => entries[d]?.[acc.id]?.adSpend !== undefined).length;

      const td = todayStr();
      const yd = ymd(addDays(effectiveToday(), -1));
      const todaySpend = entries[td]?.[acc.id]?.adSpend, todayRevenue = entries[td]?.[acc.id]?.adRevenue;
      const yestSpend = entries[yd]?.[acc.id]?.adSpend, yestRevenue = entries[yd]?.[acc.id]?.adRevenue;
      const todayRoas = todaySpend > 0 ? todayRevenue / todaySpend : null;
      const yestRoas = yestSpend > 0 ? yestRevenue / yestSpend : null;
      const dRoas = (todayRoas !== null && yestRoas !== null) ? todayRoas - yestRoas : null;

      return { ...acc, spend, revenue, orders, roas, cpa, daysWithAdData, todayRoas, yestRoas, dRoas };
    });

    const totalSpend = perAccount.reduce((s, a) => s + a.spend, 0);
    const totalRevenue = perAccount.reduce((s, a) => s + a.revenue, 0);
    const totalOrders = perAccount.reduce((s, a) => s + a.orders, 0);
    const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : null;
    const overallCpa = totalOrders > 0 ? totalSpend / totalOrders : null;
    const totalDaysWithAdData = perAccount.reduce((s, a) => s + a.daysWithAdData, 0);

    const chartData = allDatesInMonth.map((date) => {
      const d = new Date(date);
      const row = { date, day: d.getDate() };
      accounts.forEach((acc) => {
        const sp = entries[date]?.[acc.id]?.adSpend, rev = entries[date]?.[acc.id]?.adRevenue;
        row[acc.id] = (sp !== undefined && sp > 0 && rev !== undefined) ? rev / sp : null;
      });
      return row;
    });

    return { perAccount, totalSpend, totalRevenue, totalOrders, overallRoas, overallCpa, totalDaysWithAdData, chartData };
  }, [accounts, entries, viewDates, periodMode]);

  const adRanking = useMemo(() => {
    return [...adPerformance.perAccount].sort((a, b) => {
      const aHas = a.roas !== null, bHas = b.roas !== null;
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (aHas && bHas && b.roas !== a.roas) return b.roas - a.roas;
      return b.spend - a.spend;
    });
  }, [adPerformance.perAccount]);

  // Rating & Followers adalah metrik "snapshot" (bukan akumulasi harian seperti GMV) — yang
  // dibandingkan adalah nilai hari ini vs persis nilai kemarin, konsisten dengan definisi
  // "Hari Ini"/"Kemarin" dashboard ini (effectiveToday, H-1 dari tanggal kalender asli).
  const growthMetrics = useMemo(() => {
    const td = todayStr();
    const yd = ymd(addDays(effectiveToday(), -1));
    return accounts.map((acc) => {
      const todayRating = entries[td]?.[acc.id]?.rating;
      const yestRating = entries[yd]?.[acc.id]?.rating;
      const dRating = (todayRating !== undefined && yestRating !== undefined) ? todayRating - yestRating : null;
      const todayFollowers = entries[td]?.[acc.id]?.followers;
      const yestFollowers = entries[yd]?.[acc.id]?.followers;
      const dFollowers = (todayFollowers !== undefined && yestFollowers !== undefined) ? todayFollowers - yestFollowers : null;
      return { ...acc, todayRating, yestRating, dRating, todayFollowers, yestFollowers, dFollowers };
    });
  }, [accounts, entries]);

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

  const monthOptions = useMemo(() => genMonthOptions(entries, targets), [entries, targets]);

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
              {[["month", "Bulanan"], ["day", "Harian"]].map(([mode, label]) => (
                <button key={mode} onClick={() => {
                  setPeriodMode(mode);
                  if (mode === "day") {
                    setSelectedDate(todayStr());
                    setSelectedMonth(todayStr().slice(0, 7));
                  }
                }}
                  className="text-xs px-3 py-1.5 font-semibold transition-all"
                  style={{ background: periodMode === mode ? `linear-gradient(135deg, ${PALETTE.brand}, ${PALETTE.brand2})` : PALETTE.panel, color: periodMode === mode ? "#fff" : PALETTE.inkSoft }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* selector periode: month picker atau date picker sesuai mode */}
          {periodMode === "month" || !(tab === "overview" || tab === "sumber" || tab === "iklan") ? (
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border outline-none" style={{ borderColor: PALETTE.line, background: PALETTE.panel, boxShadow: cardShadow }}>
              {monthOptions.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}{m === todayYM() ? " (Bulan Ini)" : ""}</option>
              ))}
            </select>
          ) : (
            <input type="date" value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setSelectedMonth(e.target.value.slice(0, 7)); }}
              className="text-sm px-3 py-1.5 rounded-lg border outline-none" style={{ borderColor: PALETTE.line, background: PALETTE.panel, boxShadow: cardShadow }} />
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1.5 mb-5 p-1 rounded-xl flex-wrap" style={{ background: PALETTE.panelAlt, width: "fit-content" }}>
        {[["overview", "Ringkasan"], ["input", "Input Data"], ["sumber", "Sumber GMV"], ["iklan", "Performa Iklan"], ["settings", "Target & Akun"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200"
            style={tab === key
              ? { background: `linear-gradient(135deg, ${PALETTE.brand}, ${PALETTE.brand2})`, color: "#fff", boxShadow: glow(PALETTE.brand, 0.28) }
              : { background: "transparent", color: PALETTE.inkSoft }}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card accent={PALETTE.brand} className="flex flex-col justify-between">
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>GMV Bulan Ini ({monthMeta.elapsed} hari)</div>
              <div className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", ...gradientText(PALETTE.brand, PALETTE.brand2) }}>{fmtCompactRp(overview.totalMtd)}</div>
              <div className="text-xs mt-1" style={{ color: PALETTE.inkSoft }}>dari target {fmtCompactRp(overview.totalTarget)}</div>
            </Card>
            {periodMode === "month" && (
              <Card accent={PALETTE.ochre} className="flex flex-col justify-between">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Time Gone</div>
                <div className="text-2xl font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(overview.timeGonePercent)}%</div>
                <div className="text-xs mt-1" style={{ color: PALETTE.inkSoft }}>{monthMeta.elapsed} dari {monthMeta.dim} hari berjalan</div>
              </Card>
            )}
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

            {/* card perbandingan bulan lalu / hari sebelumnya */}
            <Card accent={PALETTE.plum} className="sm:col-span-2 lg:col-span-3 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>
                  {periodMode === "day" ? "GMV Hari Sebelumnya" : "GMV Bulan Lalu"}{" "}
                  <span className="normal-case font-normal">({monthLabel(overview.lastMonthYM)})</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(overview.lastMonthMtd)}</span>
                  {periodMode === "month" && <span className="text-xs" style={{ color: PALETTE.inkSoft }}>dari target {fmtCompactRp(overview.lastMonthTarget)}</span>}
                </div>
                {overview.lastMonthPct !== null && periodMode === "month" && (
                  <div className="text-xs mt-0.5" style={{ color: PALETTE.inkSoft }}>Pencapaian: <b style={{ color: PALETTE.ink }}>{Math.round(overview.lastMonthPct)}%</b> dari target</div>
                )}
              </div>
              <div className="h-px sm:h-12 sm:w-px w-full" style={{ background: PALETTE.line }} />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>
                  {periodMode === "day" ? "GMV Hari Ini vs Hari Sebelumnya" : "GMV Bulan Ini vs Bulan Lalu"}
                </div>
                <div className="flex items-baseline gap-2">
                  <DeltaBadge value={overview.mtdVsLastMonth} size="text-xl" />
                  <span className="text-xs" style={{ color: PALETTE.inkSoft }}>{fmtCompactRp(overview.totalMtd)} vs {fmtCompactRp(overview.lastMonthMtd)}</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: PALETTE.inkSoft }}>
                  {overview.mtdVsLastMonth === null ? `Belum ada data ${periodMode === "day" ? "hari sebelumnya" : "bulan lalu"}` : overview.mtdVsLastMonth >= 0 ? "Lebih baik dari periode sebelumnya" : "Di bawah periode sebelumnya"}
                </div>
              </div>
              <div className="h-px sm:h-12 sm:w-px w-full" style={{ background: PALETTE.line }} />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>
                  Total Orderan {periodMode === "day" ? "Hari Ini" : "Bulan Ini"}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {overview.hasOrdersData ? fmtNum(overview.totalOrders) : "—"}
                  </span>
                  <span className="text-xs" style={{ color: PALETTE.inkSoft }}>order</span>
                </div>
                {overview.hasOrdersData && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs" style={{ color: PALETTE.inkSoft }}>vs {periodMode === "day" ? "kemarin" : "bulan lalu"} ({fmtNum(overview.lastMonthOrders)}):</span>
                    <DeltaBadge value={overview.ordersVsLast} size="text-xs" />
                  </div>
                )}
                {!overview.hasOrdersData && (
                  <div className="text-xs mt-0.5" style={{ color: PALETTE.inkFaint }}>Isi field "Orders" di Form Harian</div>
                )}
              </div>
            </Card>
          </div>

          {/* leaderboard ranking pencapaian toko */}
          <Card>
            <SectionTitle eyebrow={`${periodLabel} \u2022 Urut % Target`} title="Ranking Pencapaian Toko" />
            <div className="space-y-2.5">
              {ranking.map((acc, idx) => {
                const [bandFrom, bandTo] = rankBandColors(idx);
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
                        {hasTarget ? (
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
            <div className="text-[11px] mt-3" style={{ color: PALETTE.inkFaint }}>Diurutkan dari % pencapaian target MTD tertinggi. Toko tanpa target disusun di bawah berdasarkan GMV mentah.</div>
          </Card>

          {/* day-over-day */}
          <Card>
            <SectionTitle eyebrow="Update Hari Ini" title="Perbandingan Harian" />
            <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>"Hari Ini" di bawah ini merujuk ke <b>{todayLabelLong()}</b> (H-1 dari tanggal kalender asli) — data marketplace baru final keesokan harinya, jadi "Kemarin" = {new Date(addDays(effectiveToday(), -1)).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} dan seterusnya bergeser satu hari.</div>
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
            <SectionTitle eyebrow="Update Hari Ini" title="Rating Toko" />
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
            <SectionTitle eyebrow="Update Hari Ini" title="Followers Toko" />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card accent={PALETTE.coral}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Total Ad Spend</div>
              <div className="text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(adPerformance.totalSpend)}</div>
            </Card>
            <Card accent={PALETTE.teal}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>Total Ad Revenue</div>
              <div className="text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(adPerformance.totalRevenue)}</div>
            </Card>
            <Card accent={PALETTE.brand}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>ROAS Gabungan</div>
              <div className="text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: adPerformance.overallRoas === null ? PALETTE.inkFaint : adPerformance.overallRoas < 1 ? PALETTE.coral : PALETTE.teal }}>
                {adPerformance.overallRoas !== null ? adPerformance.overallRoas.toFixed(2) : "—"}
              </div>
              {benchmarks.targetROAS > 0 && <div className="text-[11px] mt-1" style={{ color: PALETTE.inkSoft }}>Target: {benchmarks.targetROAS}</div>}
            </Card>
            <Card accent={PALETTE.plum}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: PALETTE.inkSoft }}>CPA Gabungan</div>
              <div className="text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{adPerformance.overallCpa !== null ? fmtCompactRp(adPerformance.overallCpa) : "—"}</div>
              <div className="text-[11px] mt-1" style={{ color: PALETTE.inkSoft }}>dari {fmtNum(adPerformance.totalOrders)} orders</div>
            </Card>
          </div>

          {/* leaderboard ROAS */}
          <Card>
            <SectionTitle eyebrow={`${periodLabel} \u2022 Urut ROAS`} title="Ranking ROAS Toko" />
            <div className="space-y-2.5">
              {adRanking.map((acc, idx) => {
                const [bandFrom, bandTo] = rankBandColors(idx);
                const hasRoas = acc.roas !== null;
                const isLosing = hasRoas && acc.roas < 1;
                return (
                  <div key={acc.id} className="flex items-stretch rounded-xl overflow-hidden" style={{ boxShadow: cardShadow }}>
                    <div className="flex items-center gap-2 px-3 py-3 shrink-0 w-32 sm:w-44" style={{ background: PALETTE.panel, borderTop: `1px solid ${PALETTE.line}`, borderBottom: `1px solid ${PALETTE.line}`, borderLeft: `1px solid ${PALETTE.line}` }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: acc.color }} />
                      <span className="text-xs sm:text-sm font-bold truncate">{acc.name}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-3 px-4 py-3" style={{ background: isLosing ? `linear-gradient(110deg, ${PALETTE.coralDeep}, ${PALETTE.coral})` : `linear-gradient(110deg, ${bandFrom}, ${bandTo})` }}>
                      <div className="flex items-center gap-2 shrink-0">
                        {idx === 0 && !isLosing ? <Trophy size={22} className="text-white drop-shadow" /> : idx <= 2 && !isLosing ? <Medal size={20} className="text-white/90" /> : null}
                        <span className="text-white/85 text-[10px] sm:text-xs font-bold uppercase tracking-wide">Rank</span>
                        <span className="text-white font-black text-2xl sm:text-3xl leading-none" style={{ fontFamily: "'Sora', sans-serif", textShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>{idx + 1}</span>
                        {isLosing && <span className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.25)" }}>RUGI</span>}
                      </div>
                      <div className="text-right">
                        <div className="text-white font-extrabold text-lg sm:text-xl leading-none" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{hasRoas ? acc.roas.toFixed(2) : "—"}</div>
                        <div className="text-white/80 text-[10px] sm:text-[11px] mt-0.5">{hasRoas ? `${fmtCompactRp(acc.revenue)} / ${fmtCompactRp(acc.spend)}` : "Belum ada data iklan"}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

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

          {/* detail per akun */}
          <Card>
            <SectionTitle eyebrow="Update Hari Ini" title="Detail per Akun" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-left" style={{ color: PALETTE.inkSoft }}>
                    <th className="font-medium py-1.5 pr-3">Akun</th>
                    <th className="font-medium py-1.5 pr-3">Ad Spend</th>
                    <th className="font-medium py-1.5 pr-3">Ad Revenue</th>
                    <th className="font-medium py-1.5 pr-3">ROAS</th>
                    <th className="font-medium py-1.5 pr-3">ROAS Hari Ini</th>
                    <th className="font-medium py-1.5 pr-3">vs Kemarin</th>
                    <th className="font-medium py-1.5">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {adPerformance.perAccount.map((a) => (
                    <tr key={a.id} className="border-t" style={{ borderColor: PALETTE.line }}>
                      <td className="py-2 pr-3"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: a.color }} />{a.name}<PlatformTag platform={a.platform} /></div></td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(a.spend)}</td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtCompactRp(a.revenue)}</td>
                      <td className="py-2 pr-3 font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: a.roas === null ? PALETTE.inkFaint : a.roas < 1 ? PALETTE.coral : PALETTE.teal }}>{a.roas !== null ? a.roas.toFixed(2) : "—"}</td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.todayRoas !== null ? a.todayRoas.toFixed(2) : "—"}</td>
                      <td className="py-2 pr-3"><SignedDeltaBadge value={a.dRoas} decimals={2} /></td>
                      <td className="py-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.cpa !== null ? fmtCompactRp(a.cpa) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] mt-3" style={{ color: PALETTE.inkFaint }}>Kolom "ROAS Hari Ini" & "vs Kemarin" memakai definisi "Hari Ini" yang sama seperti di tab Ringkasan (H-1 dari tanggal kalender asli).</div>
          </Card>
        </div>
      )}

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
