import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { app } from "./firebaseConfig.js";
import installStorageAdapter, { fetchMyRole } from "./storageAdapter.js";
import GMVDashboard from "./GMVDashboard.jsx";

installStorageAdapter();

const auth = getAuth(app);

// Username yang diketik di form login (huruf kecil) -> email teknis di Firebase Auth + label
// tampilan. Email ini BUKAN email asli siapa pun, cuma identitas teknis di balik layar.
// Kalau mau ganti/tambah toko, sesuaikan juga di Firebase Console (Authentication > Users)
// dan buat dokumen userRoles yang baru (lihat README).
const STORE_LOGINS = {
  pretty: { email: "pretty@cosmetic.com", label: "Pretty Cosmetic" },
  lovie: { email: "lovie@dovey.com", label: "Lovie Dovey" },
  flowie: { email: "flowie@cosmetic.com", label: "Flowie Cosmetic" },
  our: { email: "our@beauty.com", label: "Our Beauty Space" },
  celline: { email: "celline@cosmetic.com", label: "Celline Cosmetic" },
  kiwie: { email: "kiwie@beauty.com", label: "Kiwie Cosmetic" },
  twie: { email: "twie@beauty.com", label: "Twie Beauty (Shopee)" },
  admin: { email: "surabaya@online.com", label: "Admin" },
};

const ACCOUNT_ID_LABELS = {
  tt1: "Pretty Cosmetic", tt2: "Lovie Dovey", tt3: "Flowie Cosmetic", tt4: "Our Beauty Space",
  tt5: "Celline Cosmetic", tt6: "Kiwie Cosmetic", shopee: "Twie Beauty (Shopee)", admin: "Admin",
};

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = sedang cek, null = belum login
  const [myAccountId, setMyAccountId] = useState(null); // accountId dari userRoles, null = belum dimuat
  const [roleError, setRoleError] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setRoleError("");
      setMyAccountId(null);
      if (u) {
        try {
          const role = await fetchMyRole(u.uid);
          if (!role) {
            setRoleError("Akun ini sudah berhasil login, tapi belum ada peran (accountId) yang diset di Firestore (koleksi userRoles). Hubungi admin untuk men-setup ini — lihat README bagian 'Tambah Akun Toko'.");
            await signOut(auth);
          } else {
            setMyAccountId(role);
          }
        } catch (e) {
          setRoleError("Gagal membaca peran akun dari Firestore. Cek lagi Firestore Rules sudah ter-publish dengan benar.");
          await signOut(auth);
        }
      }
    });
    return unsub;
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoggingIn(true);
    const entry = STORE_LOGINS[username.trim().toLowerCase()];
    if (!entry) {
      setError(`Username "${username}" tidak dikenali. Coba: ${Object.keys(STORE_LOGINS).join(", ")}.`);
      setLoggingIn(false);
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, entry.email, password);
    } catch (err) {
      setError(`Login gagal — kode: ${err.code || "tidak diketahui"}. ${err.code === "auth/too-many-requests" ? "Terlalu banyak percobaan gagal, tunggu beberapa menit lalu coba lagi." : err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" ? "Password salah." : err.code === "auth/user-not-found" ? "Email ini belum terdaftar di Firebase Authentication." : "Detail: " + (err.message || "-")}`);
    }
    setLoggingIn(false);
  };

  if (user === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#75716A" }}>
        Memuat…
      </div>
    );
  }

  if (!user || !myAccountId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#FAF8FF", fontFamily: "sans-serif" }}>
        <form onSubmit={handleLogin} style={{ background: "#fff", padding: 32, borderRadius: 14, border: "1px solid #E8E1F5", width: 340, boxShadow: "0 8px 30px -8px rgba(124,58,237,0.18)" }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, color: "#1A1523" }}>GMV Tracker</h1>
          <p style={{ fontSize: 13, color: "#6B6478", marginBottom: 18 }}>Login dengan akun toko kamu.</p>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6478", display: "block", marginBottom: 4 }}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="contoh: pretty"
            autoFocus
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #E8E1F5", borderRadius: 8, marginBottom: 12, fontSize: 14 }}
          />
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6478", display: "block", marginBottom: 4 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #E8E1F5", borderRadius: 8, marginBottom: 12, fontSize: 14 }}
          />
          {(error || roleError) && <div style={{ color: "#BE123C", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>{error || roleError}</div>}
          <button
            type="submit"
            disabled={loggingIn}
            style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, #7C3AED, #EC4899)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: loggingIn ? 0.7 : 1 }}
          >
            {loggingIn ? "Masuk…" : "Masuk"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", background: "#FAF8FF" }}>
        <span style={{ fontSize: 12, color: "#6B6478" }}>Login sebagai: <b style={{ color: "#1A1523" }}>{ACCOUNT_ID_LABELS[myAccountId] || myAccountId}</b></span>
        <button onClick={() => signOut(auth)} style={{ fontSize: 12, color: "#6B6478", background: "none", border: "none", cursor: "pointer" }}>
          Keluar
        </button>
      </div>
      <GMVDashboard myAccountId={myAccountId} />
    </div>
  );
}
