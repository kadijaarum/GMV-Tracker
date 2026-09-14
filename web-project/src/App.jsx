import { useEffect, useState } from "react";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  updatePassword, EmailAuthProvider, reauthenticateWithCredential
} from "firebase/auth";
import { app } from "./firebaseConfig.js";
import installStorageAdapter, { fetchMyRole, fetchUserMapping } from "./storageAdapter.js";
import GMVDashboard from "./GMVDashboard.jsx";

installStorageAdapter();
const auth = getAuth(app);

// Hardcoded login lama (backward compatibility) — user baru dibuat lewat admin panel
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

const STORE_ACCOUNT_IDS = ["tt1","tt2","tt3","tt4","tt5","tt6","shopee"];

// Hitung efektif permissions berdasarkan accountId + optional override dari Firestore
function resolvePermissions(accountId, rawPermissions) {
  if (accountId === "admin") {
    return { editGmv: true, editLive: true, editJadwal: true, editAds: true, isAdmin: true };
  }
  const isStoreAccount = STORE_ACCOUNT_IDS.includes(accountId);
  // Default untuk akun toko: boleh edit GMV dan Live milik toko sendiri
  const base = {
    editGmv:    isStoreAccount ? true  : false,
    editLive:   isStoreAccount ? true  : false,
    editJadwal: false,
    editAds:    isStoreAccount ? false : false,
    isAdmin:    false,
  };
  // Override dengan permissions eksplisit dari Firestore (untuk user yang dibuat admin)
  if (rawPermissions && typeof rawPermissions === "object") {
    Object.entries(rawPermissions).forEach(([k, v]) => { if (k in base) base[k] = !!v; });
  }
  return base;
}

export default function App() {
  const [user, setUser]             = useState(undefined);
  const [myAccountId, setMyAccountId] = useState(null);
  const [myPermissions, setMyPermissions] = useState(null);
  const [userLabel, setUserLabel]   = useState("");
  const [roleError, setRoleError]   = useState("");

  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn]   = useState(false);

  const [showChangePwd, setShowChangePwd] = useState(false);
  const [oldPwd, setOldPwd]   = useState("");
  const [newPwd1, setNewPwd1] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdMsg, setPwdMsg]   = useState({ text:"", ok:false });
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setRoleError(""); setMyAccountId(null); setMyPermissions(null); setUserLabel("");
      if (!u) return;
      try {
        const result = await fetchMyRole(u.uid);
        if (!result || !result.accountId) {
          setRoleError("Login berhasil tapi peran belum diset di Firestore (userRoles). Hubungi admin.");
          await signOut(auth); return;
        }
        const { accountId, permissions } = result;
        const perms = resolvePermissions(accountId, permissions);
        setMyAccountId(accountId);
        setMyPermissions(perms);
        // Label nama: coba dari userMappings dulu (user dinamis), fallback ke hardcoded
        try {
          const uname = Object.entries(STORE_LOGINS).find(([, v]) => v.email === u.email)?.[0];
          if (uname) {
            setUserLabel(STORE_LOGINS[uname].label);
          } else {
            // User dinamis — ambil label dari userMappings
            const mapping = await fetchUserMapping(u.email.split("@")[0]);
            setUserLabel(mapping?.label || accountId);
          }
        } catch { setUserLabel(accountId); }
      } catch (e) {
        setRoleError("Gagal membaca peran. Cek Firestore Rules sudah ter-publish.");
        await signOut(auth);
      }
    });
    return unsub;
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(""); setLoggingIn(true);
    const uname = username.trim().toLowerCase();
    let entry = STORE_LOGINS[uname];
    if (!entry) {
      try {
        const mapping = await fetchUserMapping(uname);
        if (mapping) entry = { email: mapping.email, label: mapping.label || uname };
      } catch {}
    }
    if (!entry) { setLoginError(`Username "${username}" tidak dikenali.`); setLoggingIn(false); return; }
    try {
      await signInWithEmailAndPassword(auth, entry.email, password);
    } catch (err) {
      const c = err.code || "";
      setLoginError(`Login gagal — ${c === "auth/too-many-requests" ? "Terlalu banyak percobaan, tunggu beberapa menit." : c === "auth/invalid-credential" || c === "auth/wrong-password" ? "Password salah." : "Detail: " + (err.message || c)}`);
    }
    setLoggingIn(false);
  };

  const handleChangePwd = async (e) => {
    e.preventDefault();
    setPwdMsg({ text:"", ok:false }); setChangingPwd(true);
    if (newPwd1 !== newPwd2) { setPwdMsg({ text:"Konfirmasi tidak cocok.", ok:false }); setChangingPwd(false); return; }
    if (newPwd1.length < 6)  { setPwdMsg({ text:"Password baru minimal 6 karakter.", ok:false }); setChangingPwd(false); return; }
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, oldPwd));
      await updatePassword(user, newPwd1);
      setPwdMsg({ text:"Kata sandi berhasil diubah!", ok:true });
      setOldPwd(""); setNewPwd1(""); setNewPwd2("");
      setTimeout(() => { setShowChangePwd(false); setPwdMsg({ text:"", ok:false }); }, 2000);
    } catch (err) {
      const c = err.code || "";
      setPwdMsg({ text: c === "auth/wrong-password" || c === "auth/invalid-credential" ? "Kata sandi lama salah." : c === "auth/too-many-requests" ? "Terlalu banyak percobaan." : `Gagal: ${err.message || c}`, ok:false });
    }
    setChangingPwd(false);
  };

  const INK = "#1A1523", SOFT = "#6B6478", BORDER = "#E8E1F5";

  if (user === undefined) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:SOFT }}>Memuat…</div>
  );

  if (!user || !myAccountId || !myPermissions) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#FAF8FF", padding:16 }}>
      <div style={{ width:"100%", maxWidth:360 }}>
        <form onSubmit={handleLogin} style={{ background:"#fff", padding:32, borderRadius:14, border:`1px solid ${BORDER}`, boxShadow:"0 8px 30px -8px rgba(124,58,237,0.18)" }}>
          <h1 style={{ fontSize:18, fontWeight:800, marginBottom:4, color:INK }}>GMV Tracker</h1>
          <p style={{ fontSize:13, color:SOFT, marginBottom:18 }}>Login dengan akun toko kamu.</p>
          {[["Username","text",username,setUsername,"contoh: pretty"],["Password","password",password,setPassword,"Password"]].map(([lbl,type,val,setter,ph])=>(
            <div key={lbl}>
              <label style={{ fontSize:11, fontWeight:600, color:SOFT, display:"block", marginBottom:4 }}>{lbl}</label>
              <input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph} autoFocus={lbl==="Username"}
                style={{ width:"100%", boxSizing:"border-box", padding:"9px 11px", border:`1px solid ${BORDER}`, borderRadius:8, marginBottom:12, fontSize:14 }} />
            </div>
          ))}
          {loginError && <div style={{ color:"#BE123C", fontSize:12, marginBottom:12, lineHeight:1.5 }}>{loginError}</div>}
          {roleError  && <div style={{ color:"#BE123C", fontSize:12, marginBottom:12, lineHeight:1.5 }}>{roleError}</div>}
          <button type="submit" disabled={loggingIn}
            style={{ width:"100%", padding:10, background:"linear-gradient(135deg,#7C3AED,#EC4899)", color:"#fff", border:"none", borderRadius:8, fontWeight:700, fontSize:14, cursor:"pointer", opacity:loggingIn?0.7:1 }}>
            {loggingIn?"Masuk…":"Masuk"}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div>
      {/* Top bar — Ubah Kata Sandi tersedia untuk SEMUA pengguna */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 16px", background:"#FAF8FF", borderBottom:`1px solid ${BORDER}`, flexWrap:"wrap", gap:8 }}>
        <span style={{ fontSize:12, color:SOFT }}>Login sebagai: <b style={{ color:INK }}>{userLabel}</b></span>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={()=>setShowChangePwd(true)}
            style={{ fontSize:12, color:"#7C3AED", background:"none", border:`1px solid ${BORDER}`, borderRadius:6, padding:"3px 10px", cursor:"pointer" }}>
            Ubah Kata Sandi
          </button>
          <button onClick={()=>signOut(auth)} style={{ fontSize:12, color:SOFT, background:"none", border:"none", cursor:"pointer" }}>Keluar</button>
        </div>
      </div>

      {/* Modal ubah kata sandi */}
      {showChangePwd && (
        <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(28,21,35,0.5)", padding:16 }}>
          <form onSubmit={handleChangePwd} style={{ background:"#fff", padding:24, borderRadius:14, width:"100%", maxWidth:360, boxShadow:"0 8px 40px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize:15, fontWeight:700, marginBottom:4, color:INK }}>Ubah Kata Sandi</h2>
            <p style={{ fontSize:12, color:SOFT, marginBottom:16 }}>Login sebagai: <b>{userLabel}</b></p>
            {[["Kata sandi lama",oldPwd,setOldPwd],["Kata sandi baru (min. 6 karakter)",newPwd1,setNewPwd1],["Konfirmasi kata sandi baru",newPwd2,setNewPwd2]].map(([lbl,val,setter])=>(
              <div key={lbl}>
                <label style={{ fontSize:11, fontWeight:600, color:SOFT, display:"block", marginBottom:4 }}>{lbl}</label>
                <input type="password" value={val} onChange={e=>setter(e.target.value)} placeholder={lbl}
                  style={{ width:"100%", boxSizing:"border-box", padding:"9px 11px", border:`1px solid ${BORDER}`, borderRadius:8, marginBottom:12, fontSize:14 }} />
              </div>
            ))}
            {pwdMsg.text && <div style={{ color:pwdMsg.ok?"#1baf7a":"#BE123C", fontSize:12, marginBottom:10 }}>{pwdMsg.text}</div>}
            <div style={{ display:"flex", gap:8 }}>
              <button type="button" onClick={()=>{setShowChangePwd(false);setPwdMsg({text:"",ok:false});setOldPwd("");setNewPwd1("");setNewPwd2("");}}
                style={{ flex:1, padding:10, border:`1px solid ${BORDER}`, borderRadius:8, fontSize:13, cursor:"pointer", background:"#fff", color:SOFT }}>Batal</button>
              <button type="submit" disabled={changingPwd}
                style={{ flex:2, padding:10, background:"linear-gradient(135deg,#7C3AED,#EC4899)", color:"#fff", border:"none", borderRadius:8, fontWeight:700, fontSize:14, cursor:"pointer", opacity:changingPwd?0.7:1 }}>
                {changingPwd?"Menyimpan…":"Simpan Kata Sandi"}
              </button>
            </div>
          </form>
        </div>
      )}

      <GMVDashboard myAccountId={myAccountId} userPermissions={myPermissions} />
    </div>
  );
}
