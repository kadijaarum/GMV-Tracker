import {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
  collection, query, where, getDocs, documentId, orderBy,
} from "firebase/firestore";
import { firebaseConfig, app } from "./firebaseConfig.js";

export const db = getFirestore(app);

// Firestore MENOLAK field bernilai `undefined` di mana pun (termasuk di dalam array/object
// bersarang) — setDoc() akan throw error. Semua data yang ditulis ke Firestore dilewatkan
// fungsi ini dulu supaya undefined otomatis jadi null (yang aman disimpan).
function sanitize(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    Object.entries(value).forEach(([k, v]) => { out[k] = sanitize(v); });
    return out;
  }
  return value;
}

// Dipakai untuk data yang tetap satu blok per jenis (config nama akun/benchmark,
// catatan tahun yang sudah diexport) — keduanya admin-only-write lewat security rules,
// jadi aman tetap satu dokumen.
const BLOB_COLLECTION = "dashboard_storage";

/**
 * Polyfill window.storage (API generik get/set/delete/list) untuk data yang TIDAK perlu
 * dibatasi per-akun: config (nama 7 akun, benchmark) dan exportedYears (catatan rekap Excel).
 * Dashboard memanggil ini lewat helper safeGet/safeSet yang sudah ada.
 */
export default function installStorageAdapter() {
  window.storage = {
    async get(key) {
      const ref = doc(db, BLOB_COLLECTION, key);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error(`Key not found: ${key}`);
      const data = snap.data();
      return { key, value: data.value, shared: true };
    },
    async set(key, value) {
      const ref = doc(db, BLOB_COLLECTION, key);
      await setDoc(ref, sanitize({ value, updatedAt: Date.now() }));
      return { key, value, shared: true };
    },
    async delete(key) {
      const ref = doc(db, BLOB_COLLECTION, key);
      await deleteDoc(ref);
      return { key, deleted: true, shared: true };
    },
    async list(prefix) {
      const col = collection(db, BLOB_COLLECTION);
      const q = prefix
        ? query(col, where(documentId(), ">=", prefix), where(documentId(), "<", prefix + "\uf8ff"))
        : query(col);
      const snap = await getDocs(q);
      return { keys: snap.docs.map((d) => d.id), prefix, shared: true };
    },
  };
}

/* ============================================================
   ENTRIES — entries/{accountId}/days/{date}
   Dipecah per-akun (bukan satu blob) supaya security rules bisa
   menolak tulisan ke akun orang lain, bukan cuma disembunyikan di UI.
   ============================================================ */

// Ambil semua entries semua akun, digabung jadi bentuk { [date]: { [accountId]: data } }
// — bentuk yang sama persis seperti yang dipakai komponen dashboard selama ini.
export async function fetchAllEntries(accountIds) {
  const merged = {};
  await Promise.all(accountIds.map(async (accountId) => {
    const col = collection(db, "entries", accountId, "days");
    const snap = await getDocs(col);
    snap.forEach((d) => {
      const date = d.id;
      if (!merged[date]) merged[date] = {};
      merged[date][accountId] = d.data();
    });
  }));
  return merged;
}

export async function saveEntryDay(accountId, date, dayData) {
  const ref = doc(db, "entries", accountId, "days", date);
  await setDoc(ref, sanitize(dayData));
}

export async function deleteEntryDay(accountId, date) {
  const ref = doc(db, "entries", accountId, "days", date);
  await deleteDoc(ref);
}

/* ============================================================
   TARGETS — targets/{accountId}/months/{yearMonth}
   ============================================================ */

export async function fetchAllTargets(accountIds) {
  const merged = {};
  await Promise.all(accountIds.map(async (accountId) => {
    const col = collection(db, "targets", accountId, "months");
    const snap = await getDocs(col);
    snap.forEach((d) => {
      const ymStr = d.id;
      if (!merged[ymStr]) merged[ymStr] = {};
      merged[ymStr][accountId] = d.data().value;
    });
  }));
  return merged;
}

export async function saveTargetMonth(accountId, yearMonth, value) {
  const ref = doc(db, "targets", accountId, "months", yearMonth);
  await setDoc(ref, sanitize({ value }));
}

/* ============================================================
   REVISIONS — koleksi top-level, append-only.
   Akun toko cuma boleh CREATE (bukan update/delete) dan accountId di
   dalam record harus sama dengan akun yang login (ditegakkan di rules).
   ============================================================ */

export async function fetchAllRevisions() {
  const col = collection(db, "revisions");
  const q = query(col, orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addRevisionRecord(record) {
  const ref = doc(collection(db, "revisions"), record.id);
  await setDoc(ref, sanitize(record));
}

/* ============================================================
   LIVE SESSIONS — liveSessions/{accountId}/sessions/{sessionId}
   Dipecah per-akun (sama seperti entries) supaya security rules bisa
   menegakkan batasan akses per toko. Beda dari entries: satu tanggal
   bisa punya BANYAK sesi live (host beda-beda, jam beda-beda), jadi
   sessionId di-generate sendiri (bukan dikunci ke tanggal).
   ============================================================ */

export async function fetchAllLiveSessions(accountIds) {
  const all = [];
  await Promise.all(accountIds.map(async (accountId) => {
    const col = collection(db, "liveSessions", accountId, "sessions");
    const snap = await getDocs(col);
    snap.forEach((d) => { all.push({ id: d.id, accountId, ...d.data() }); });
  }));
  return all;
}

export async function saveLiveSession(accountId, sessionId, sessionData) {
  const ref = doc(db, "liveSessions", accountId, "sessions", sessionId);
  await setDoc(ref, sanitize(sessionData));
}

export async function deleteLiveSession(accountId, sessionId) {
  const ref = doc(db, "liveSessions", accountId, "sessions", sessionId);
  await deleteDoc(ref);
}


/* ============================================================
   USER MANAGEMENT — userMappings/{username}
   Admin membuat user baru lewat UI. Mapping username → email + config
   disimpan di Firestore. Firebase Auth user dibuat via REST API
   (tidak sign out current admin session).
   ============================================================ */

import { firebaseConfig } from "./firebaseConfig.js";

export async function createFirebaseAuthUser(email, password) {
  // REST API: membuat Firebase Auth user TANPA mengubah sesi login yang sedang aktif.
  // Admin tetap login sebagai dirinya sendiri setelah memanggil ini.
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    }
  );
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message || "Gagal membuat user Firebase");
  return data.localId; // UID user baru
}

export async function fetchUserMappings() {
  const col = collection(db, "userMappings");
  const snap = await getDocs(col);
  return snap.docs.map((d) => ({ username: d.id, ...d.data() }));
}

export async function fetchUserMapping(username) {
  const ref = doc(db, "userMappings", username);
  const snap = await getDoc(ref);
  return snap.exists() ? { username, ...snap.data() } : null;
}

export async function saveUserMapping(username, data) {
  const ref = doc(db, "userMappings", username);
  await setDoc(ref, sanitize(data));
}

export async function deleteUserMapping(username) {
  const ref = doc(db, "userMappings", username);
  await deleteDoc(ref);
}

export async function deleteFirebaseUserMapping(uid) {
  // Hapus userRoles saja (Auth user tidak bisa dihapus client-side tanpa Admin SDK)
  const ref = doc(db, "userRoles", uid);
  await deleteDoc(ref);
}
/* ============================================================
   ROLE — userRoles/{uid} → { accountId: "tt1" | ... | "admin" }
   Dokumen ini dibuat MANUAL oleh admin lewat Firestore Console
   (bukan lewat aplikasi), jadi tidak ada masalah ayam-telur soal siapa
   yang berhak membuatnya pertama kali.
   ============================================================ */

export async function fetchMyRole(uid) {
  const ref = doc(db, "userRoles", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data().accountId || null;
}
