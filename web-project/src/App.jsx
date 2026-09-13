import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { app } from "./firebaseConfig.js";
import installStorageAdapter, { fetchMyRole, fetchUserMapping } from "./storageAdapter.js";
import GMVDashboard from "./GMVDashboard.jsx";

installStorageAdapter();

const auth = getAuth(app);

// Hardcoded login lama (backward compatibility)
const STORE_LOGINS = {
  pretty:  { email: "pretty@cosmetic.com",  label: "Pretty Cosmetic" },
  lovie:   { email: "lovie@dovey.com",       label: "Lovie Dovey" },
  flowie:  { email: "flowie@cosmetic.com",   label: "Flowie Cosmetic" },
  our:     { email: "our@beauty.com",        label: "Our Beauty Space" },
  celline: { email: "celline@cosmetic.com",  label: "Celline Cosmetic" },
  kiwie:   { email: "kiwie@beauty.com",      label: "Kiwie Cosmetic" },
  twie:    { email: "twie@beauty.com",       label: "Twie Beauty (Shopee)" },
  admin:   { email: "surabaya@online.com",   label: "Admin" },
};

const ACCOUNT_ID_LABELS = {
  tt1:"Pretty Cosmetic", tt2:"Lovie Dovey", tt3:"Flowie Cosmetic", tt4:"Our Beauty Space",
  tt5:"Celline Cosmetic", tt6:"Kiwie Cosmetic", shopee:"Twie Beauty (Shopee)", admin:"Admin",
};

export default function App() {
  const [user, setUser] = useState(undefined);
  const [myAccountId, setMyAccountId] = useState(null);
  const [roleError, setRoleError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [userLabel, setUserLabel] = useState("");

  // Ubah kata sandi
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd1, setNewPwd1] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setRoleError(""); setMyAccountId(null); setUserLabel("");
      if (u) {
        try {
          const role = await fetchMyRole(u.uid);
          if (!role) {
            setRoleError("Login berhasil tapi peran belum diset di Firestore (userRoles). Hubungi admin.");
            await signOut(auth);
          } else {
            setMyAccountId(role);
            setUserLabel(ACCOUNT_ID_LABELS[role] || role);
          }
        } catch (e) {
          setRoleError("Gagal membaca peran. Cek Firestore Rules sudah ter-publish.");
          await signOut(auth);
        }
      }
    });
    return unsub;
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoggingIn(true);
    const uname = username.trim().toLowerCase();

    // 1. Cek hardcoded STORE_LOGINS
    let entry = STORE_LOGINS[uname];

    // 2. Cek Firestore userMappings (user yang dibuat lewat admin panel)
    if (!entry) {
      try {
        const mapping = await fetchUserMapping(uname);
        if (mapping) entry = { email: mapping.email, label: mapping.label || uname };
      } catch {}
    }

    if (!entry) {
      setError(`Username "${username}" tidak dikenali.`);
      setLoggingIn(false); return;
    }
    try {
      await signInWithEmailAndPassword(auth, entry.email, password);
    } catch (err) {
      const code = err.code || "";
      setError(`Login gagal — ${code === "auth/too-many-requests" ? "Terlalu banyak percobaan, tunggu beberapa menit." : code === "auth/invalid-credential" || code === "auth/wrong-password" ? "Password salah." : code === "auth/user-not-found" ? "User tidak ditemukan." : "Detail: " + (err.message || code)}`);
    }
    setLoggingIn(false);
  };

  const handleChangePwd = async (e) => {
    e.preventDefault();
    setPwdError(""); setPwdSuccess(""); setChangingPwd(true);
    if (newPwd1 !== newPwd2) { setPwdError("Konfirmasi kata sandi tidak cocok."); setChangingPwd(false); return; }
    if (newPwd1.length < 6) { setPwdError("Kata sandi baru minimal 6 karakter."); setChangingPwd(false); return; }
    try {
      // Re-autentikasi dulu (diperlukan Firebase untuk operasi sensitif)
      const cred = EmailAuthProvider.credential(user.email, oldPwd);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPwd1);
      setPwdSuccess("Kata sandi berhasil diubah!");
      setOldPwd(""); setNewPwd1(""); setNewPwd2("");
      setTimeout(() => { setShowChangePwd(false); setPwdSuccess(""); }, 2000);
    } catch (err) {
      const code = err.code || "";
      setPwdError(code === "auth/wrong-password" || code === "auth/invalid-credential" ? "Kata sandi lama salah." : code === "auth/too-many-requests" ? "Terlalu banyak percobaan." : `Gagal: ${err.message || code}`);
    }
    setChangingPwd(false);
  };

  if (user === undefined) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"sans-serif", color:"#75716A" }}>Memuat…</div>
  );

  if (!user || !myAccountId) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#FAF8FF", fontFamily:"sans-serif", padding:16 }}>
      <div style={{ width:"100%", maxWidth:360 }}>
        <form onSubmit={handleLogin} style={{ background:"#fff", padding:32, borderRadius:14, border:"1px solid #E8E1F5", boxShadow:"0 8px 30px -8px rgba(124,58,237,0.18)" }}>
          <h1 style={{ fontSize:18, fontWeight:800, marginBottom:4, color:"#1A1523" }}>GMV Tracker</h1>
          <p style={{ fontSize:13, color:"#6B6478", marginBottom:18 }}>Login dengan akun toko kamu.</p>
          <label style={{ fontSize:11, fontWeight:600, color:"#6B6478", display:"block", marginBottom:4 }}>Username</label>
          <input type="text" value={username} onChange={e=>setUsername(e.target.value)} placeholder="contoh: pretty" autoFocus
            style={{ width:"100%", boxSizing:"border-box", padding:"9px 11px", border:"1px solid #E8E1F5", borderRadius:8, marginBottom:12, fontSize:14 }} />
          <label style={{ fontSize:11, fontWeight:600, color:"#6B6478", display:"block", marginBottom:4 }}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"
            style={{ width:"100%", boxSizing:"border-box", padding:"9px 11px", border:"1px solid #E8E1F5", borderRadius:8, marginBottom:12, fontSize:14 }} />
          {(error || roleError) && <div style={{ color:"#BE123C", fontSize:12, marginBottom:12, lineHeight:1.5 }}>{error || roleError}</div>}
          <button type="submit" disabled={loggingIn}
            style={{ width:"100%", padding:10, background:"linear-gradient(135deg,#7C3AED,#EC4899)", color:"#fff", border:"none", borderRadius:8, fontWeight:700, fontSize:14, cursor:"pointer", opacity:loggingIn?0.7:1 }}>
            {loggingIn ? "Masuk…" : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div>
      {/* Top bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 16px", background:"#FAF8FF", borderBottom:"1px solid #E8E1F5", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:12, color:"#6B6478" }}>Login sebagai: <b style={{ color:"#1A1523" }}>{userLabel}</b></span>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={() => setShowChangePwd(true)}
            style={{ fontSize:12, color:"#7C3AED", background:"none", border:"1px solid #E8E1F5", borderRadius:6, padding:"3px 10px", cursor:"pointer" }}>
            Ubah Kata Sandi
          </button>
          <button onClick={() => signOut(auth)} style={{ fontSize:12, color:"#6B6478", background:"none", border:"none", cursor:"pointer" }}>Keluar</button>
        </div>
      </div>

      {/* Modal ubah kata sandi */}
      {showChangePwd && (
        <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(28,21,35,0.5)", padding:16 }}>
          <form onSubmit={handleChangePwd} style={{ background:"#fff", padding:24, borderRadius:14, width:"100%", maxWidth:360, boxShadow:"0 8px 40px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize:15, fontWeight:700, marginBottom:4, color:"#1A1523" }}>Ubah Kata Sandi</h2>
            <p style={{ fontSize:12, color:"#6B6478", marginBottom:16 }}>Login sebagai: <b>{userLabel}</b></p>
            {[["Kata sandi lama", oldPwd, setOldPwd], ["Kata sandi baru", newPwd1, setNewPwd1], ["Konfirmasi kata sandi baru", newPwd2, setNewPwd2]].map(([label, val, setter]) => (
              <div key={label}>
                <label style={{ fontSize:11, fontWeight:600, color:"#6B6478", display:"block", marginBottom:4 }}>{label}</label>
                <input type="password" value={val} onChange={e=>setter(e.target.value)} placeholder={label}
                  style={{ width:"100%", boxSizing:"border-box", padding:"9px 11px", border:"1px solid #E8E1F5", borderRadius:8, marginBottom:12, fontSize:14 }} />
              </div>
            ))}
            {pwdError && <div style={{ color:"#BE123C", fontSize:12, marginBottom:10 }}>{pwdError}</div>}
            {pwdSuccess && <div style={{ color:"#1baf7a", fontSize:12, marginBottom:10 }}>{pwdSuccess}</div>}
            <div style={{ display:"flex", gap:8 }}>
              <button type="button" onClick={() => { setShowChangePwd(false); setPwdError(""); setOldPwd(""); setNewPwd1(""); setNewPwd2(""); }}
                style={{ flex:1, padding:10, border:"1px solid #E8E1F5", borderRadius:8, fontSize:13, cursor:"pointer", background:"#fff", color:"#6B6478" }}>
                Batal
              </button>
              <button type="submit" disabled={changingPwd}
                style={{ flex:2, padding:10, background:"linear-gradient(135deg,#7C3AED,#EC4899)", color:"#fff", border:"none", borderRadius:8, fontWeight:700, fontSize:14, cursor:"pointer", opacity:changingPwd?0.7:1 }}>
                {changingPwd ? "Menyimpan…" : "Simpan Kata Sandi"}
              </button>
            </div>
          </form>
        </div>
      )}

      <GMVDashboard myAccountId={myAccountId} />
    </div>
  );
}
