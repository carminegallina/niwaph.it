/* Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina */
/* ================================================================
   NIWA.PH — Admin Page (login-protected, full editor)
   ================================================================
   Auth flow:
   - Nessuna password nel codice client. Username e password vengono
     verificati lato server da api/admin/login.php contro la tabella
     admin_user del DB (campo password_hash, bcrypt).
   - Il server, in caso di successo, rilascia un cookie di sessione
     HttpOnly+Secure+SameSite=Strict che il browser invia
     automaticamente a ogni richiesta successiva.
   - Tutte le richieste verso le API admin usano credentials: 'include'
     per trasportare il cookie di sessione.
   ================================================================ */

const API_BASE = "/api/admin";

/* ---- Site copy override store: NON PIÙ LOCALE ----
   Le modifiche ai testi del sito ora passano per /api/admin/site_text.php
   e sono caricate dal CopyProvider in app-core.jsx (hook: useCopy()). */

/* ---- Auth ----
   Stato:
   - status: "checking" | "anon" | "authed"
   - user:   { username, display_name } | null

   Metodi:
   - login(username, password) -> Promise<{ok, error?, retryAfter?}>
   - logout()                  -> Promise<void>

   Al mount viene chiamato session.php per ricontrollare se il cookie
   è ancora valido (es. dopo un refresh della pagina).
*/
function useAdminAuth() {
  const [status, setStatus] = useState("checking");
  const [user, setUser] = useState(null);

  // Verifica sessione esistente al mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API_BASE + "/session.php", {
          method: "GET",
          credentials: "include",
          headers: { "Accept": "application/json" }
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data && data.authed) {
            setUser({ username: data.username, display_name: data.display_name });
            setStatus("authed");
            return;
          }
        }
        setStatus("anon");
      } catch (e) {
        if (!cancelled) setStatus("anon");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (username, password) => {
    try {
      const res = await fetch(API_BASE + "/login.php", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      // Risposte standard del server:
      //   200 { ok:true,  username, display_name }
      //   401 { ok:false, error:"invalid_credentials" }
      //   429 { ok:false, error:"rate_limited", retry_after: <secondi> }
      //   400 { ok:false, error:"bad_request" }
      let data = null;
      try { data = await res.json(); } catch (_) {}

      if (res.ok && data && data.ok) {
        setUser({ username: data.username, display_name: data.display_name });
        setStatus("authed");
        return { ok: true };
      }

      if (res.status === 429) {
        return { ok: false, error: "rate_limited", retryAfter: data?.retry_after ?? 60 };
      }
      return { ok: false, error: data?.error || "invalid_credentials" };
    } catch (e) {
      return { ok: false, error: "network_error" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(API_BASE + "/logout.php", {
        method: "POST",
        credentials: "include",
        headers: { "Accept": "application/json" }
      });
    } catch (_) {}
    setUser(null);
    setStatus("anon");
  }, []);

  return {
    authed: status === "authed",
    checking: status === "checking",
    user,
    login,
    logout
  };
}

/* ---- Login screen ---- */
function AdminLogin({ onLogin }) {
  const { lang, t } = useLang();
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0); // timestamp ms

  // Tick per aggiornare il countdown del rate limit
  const [, setTick] = useState(0);
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const id = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  const isLocked = remaining > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (busy || isLocked) return;
    if (!username.trim() || !pw) {
      setErr(t("admin.login_error"));
      return;
    }
    setBusy(true);
    setErr("");

    const result = await onLogin(username.trim(), pw);

    setBusy(false);
    if (result.ok) {
      setPw("");
      return;
    }

    // Pulisce sempre la password dopo un tentativo fallito
    setPw("");

    if (result.error === "rate_limited") {
      const sec = Math.max(1, parseInt(result.retryAfter, 10) || 60);
      setLockedUntil(Date.now() + sec * 1000);
      setErr(lang === "it"
        ? `Troppi tentativi. Riprova tra ${sec}s.`
        : `Too many attempts. Retry in ${sec}s.`);
      return;
    }
    if (result.error === "network_error") {
      setErr(lang === "it" ? "Errore di rete, riprova." : "Network error, please retry.");
      return;
    }
    setErr(t("admin.login_error"));
  };

  return (
    <div className="container page-transition-enter">
      <div className="admin-login">
        <h1>{t("admin.login_title")}</h1>
        <p>{t("admin.login_sub")}</p>
        <form onSubmit={submit} autoComplete="on">
          <div className="field">
            <label>{lang === "it" ? "Utente" : "Username"}</label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={busy || isLocked}
              maxLength={60}
            />
          </div>
          <div className="field">
            <label>{t("admin.login_password")}</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              disabled={busy || isLocked}
              maxLength={200}
            />
          </div>
          <button
            className="btn btn--accent"
            type="submit"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={busy || isLocked}>
            {busy
              ? (lang === "it" ? "Verifica…" : "Checking…")
              : isLocked
                ? (lang === "it" ? `Attendi ${remaining}s` : `Wait ${remaining}s`)
                : t("admin.login_submit")}
            {!busy && !isLocked && <span className="btn-arrow"><Icon.Arrow /></span>}
          </button>
          {err && <div style={{ color: "var(--accent)", fontSize: 13, marginTop: 12, textAlign: "center" }}>
            {err}
          </div>}
        </form>
        <div className="hint">🔒 {lang === "it"
          ? "Accesso riservato. Le credenziali sono verificate sul server."
          : "Restricted access. Credentials are verified server-side."}</div>
      </div>
    </div>
  );
}

/* ---- Spinner di verifica sessione (mostrato al primo mount) ---- */
function AdminChecking() {
  const { lang } = useLang();
  return (
    <div className="container page-transition-enter">
      <div className="admin-login">
        <p style={{ textAlign: "center", color: "var(--fg-soft)" }}>
          {lang === "it" ? "Verifica sessione…" : "Checking session…"}
        </p>
      </div>
    </div>
  );
}

/* ---- Admin page ---- */
function AdminPage() {
  const { authed, checking, login, logout, user } = useAdminAuth();
  const { t, lang } = useLang();
  const { media, addMedia, updateMedia, removeMedia, resetSeed, setAdminMode, loading } = useStore();
  const { cats } = useCategories();
  const { order: presetOrder } = usePresets();
  const { show } = useToast();
  // Niente fallback al seed: se il DB è vuoto, l'admin vede una lista vuota
  // (è uno stato valido, e impedisce di confondere foto demo con foto reali).
  const displayMedia = media;
  const [section, setSection] = useState(() => {
    const v = sessionStorage.getItem("niwa.adminSec");
    // Filtriamo i valori storici (services/events/copy/etc. esistono più
    // come macro-area, sono diventate sub-tab di "pages")
    if (["overview", "media", "pages", "messages"].includes(v)) return v;
    return "overview";
  });
  // Sub-section: tab interna di una macro-area (es. dentro "Media" può
  // essere "gallery", "upload", "categories", "presets"; dentro "Pages"
  // può essere "home", "about", "contact"). Si resetta al cambio macro.
  const [subSection, setSubSection] = useState(() => sessionStorage.getItem("niwa.adminSub") || "");
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  // Coda di file in attesa di review prima dell'upload reale.
  // Quando l'admin droppa N file, li mettiamo qui e mostriamo un modale
  // per ognuno: l'admin può impostare categoria/preset/titolo/tag prima
  // di confermare il caricamento (oppure annullare).
  const [pendingFiles, setPendingFiles] = useState([]);

  useEffect(() => {
    sessionStorage.setItem("niwa.adminSec", section);
  }, [section]);
  useEffect(() => {
    sessionStorage.setItem("niwa.adminSub", subSection || "");
  }, [subSection]);

  // Naviga a macro+sub in un'unica chiamata. Usato dalle scorciatoie
  // (es. Overview "Vai a categorie" → goAdmin("media", "categories")).
  const goAdmin = useCallback((macro, sub = "") => {
    setSection(macro);
    setSubSection(sub);
  }, []);

  // Quando l'admin entra, ricarichiamo i media in modalità admin (anche draft/private)
  useEffect(() => {
    if (authed) setAdminMode(true);
    return () => { if (authed) setAdminMode(false); };
  }, [authed, setAdminMode]);

  if (checking) return <AdminChecking />;
  if (!authed) return <AdminLogin onLogin={login} />;

  const aT = (k) => t("admin." + k);

  // ─── Architettura admin riorganizzata ──────────────────────────────
  // 4 macro-aree nel sidebar, ognuna con eventuali sub-tab interne.
  // Lo stato sessionStorage 'niwa.adminSec' tiene la macro-area; le
  // sub-tab sono interne ai loro pannelli (non persistono tra reload,
  // ma è ok perché di solito si rientra nella tab che si stava usando).
  const sectionsList = [
    { id: "overview", label: lang === "it" ? "Panoramica" : "Overview", count: null },
    { id: "media",    label: lang === "it" ? "Media"      : "Media",    count: displayMedia.length },
    { id: "pages",    label: lang === "it" ? "Pagine"     : "Pages",    count: null },
    { id: "messages", label: lang === "it" ? "Messaggi"   : "Messages", count: null }
  ];

  // I file droppati NON vanno più direttamente all'upload: vengono accodati
  // in pendingFiles e mostrati uno alla volta nel modale di review.
  // L'admin per ogni file imposta i metadati, preme "Salva e carica" e
  // l'upload reale parte solo allora.
  const onFiles = (files) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setPendingFiles(prev => [...prev, ...list]);
  };

  // Upload effettivo di un singolo file con i metadati confermati dall'utente.
  // Chiamato dal modale di review quando l'utente preme "Salva".
  const doUpload = async (file, fields) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", fields.category);
      fd.append("preset", fields.preset);
      fd.append("aspect", fields.aspect);
      fd.append("visibility", fields.visibility);
      // Nuovi flag passati al backend (upload.php li accetta in POST).
      fd.append("is_featured", fields.is_featured ? "1" : "0");
      fd.append("show_info",   fields.show_info   ? "1" : "0");
      const res = await fetch("/api/admin/upload.php", {
        method: "POST", credentials: "include", body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "upload_failed"));
        setUploading(false);
        return { ok: false };
      }
      // Aggiunge a state locale subito + chiama updateMedia per salvare
      // titolo/desc/tags che upload.php non gestisce.
      await addMedia({
        id: data.id,
        id_media: data.id_media,
        type: data.type,
        category: fields.category,
        title: fields.title,
        desc: fields.desc,
        tags: fields.tags,
        src: data.src,
        poster: "",
        preset: fields.preset,
        adj: {},
        aspect: data.aspect,
        visibility: fields.visibility,
        is_featured: !!fields.is_featured,
        show_info: fields.show_info !== false,
        sort_order: 0,
      });
      // Patch dei campi non-upload (titoli, descrizioni, tag): vanno aggiornati
      // tramite updateMedia perché upload.php crea il record con campi vuoti.
      if (fields.title.it || fields.title.en
          || fields.desc.it || fields.desc.en
          || (fields.tags && fields.tags.length)) {
        await updateMedia(data.id, {
          title: fields.title,
          desc: fields.desc,
          tags: fields.tags,
        });
      }
      setUploading(false);
      return { ok: true };
    } catch (e) {
      setUploading(false);
      show(lang === "it" ? "Errore di rete" : "Network error");
      return { ok: false };
    }
  };

  // Chiamata dal modale: passa al prossimo file (o chiude la coda)
  const advanceQueue = (uploadedOk) => {
    setPendingFiles(prev => prev.slice(1));
    // Se era l'ultimo della coda E almeno uno è stato caricato, mostra la lista media
    if (pendingFiles.length === 1 && uploadedOk) {
      goAdmin("media", "gallery");
      show(aT("uploaded"));
    }
  };

  return (
    <div className="container admin-page page-transition-enter">
      <div className="admin-section-head">
        <div>
          <div className="eyebrow">Niwa.ph · Admin</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 600, letterSpacing: "-0.04em", margin: "12px 0 0", lineHeight: 1.05, paddingBottom: "0.08em" }}>
            {user?.display_name ? `${lang === "it" ? "Benvenuto" : "Welcome"}, ${user.display_name}` : aT("welcome")}<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
        </div>
        <button className="btn btn--ghost" onClick={logout}>
          {aT("logout")}
        </button>
      </div>

      <div className="admin-shell">
        <aside className="admin-side">
          {sectionsList.map(s => (
            <button key={s.id}
                    className={"admin-side-link " + (section === s.id ? "is-active" : "")}
                    onClick={() => goAdmin(s.id, "")}>
              <span>{s.label}</span>
              {s.count != null && <span className="admin-side-count">{s.count}</span>}
            </button>
          ))}
          <div className="admin-side-divider" />
          <a className="admin-side-link" href="#home">← {t("nav.home")}</a>
        </aside>

        <main>
          {loading && (
            <div className="admin-card" style={{ textAlign: "center", color: "var(--fg-soft)" }}>
              {lang === "it" ? "Caricamento dal server…" : "Loading from server…"}
            </div>
          )}
          {section === "overview" && (
            <AdminOverview media={displayMedia} goAdmin={goAdmin} />
          )}
          {section === "media" && (
            <AdminMediaArea
              media={displayMedia}
              editingId={editingId}
              setEditingId={setEditingId}
              updateMedia={updateMedia}
              removeMedia={removeMedia}
              onFiles={onFiles}
              resetSeed={resetSeed}
              uploading={uploading}
              subSection={subSection}
              setSubSection={setSubSection} />
          )}
          {section === "pages" && (
            <AdminPagesArea
              subSection={subSection}
              setSubSection={setSubSection} />
          )}
          {section === "messages" && (
            <AdminMessages />
          )}
        </main>
      </div>

      {/* Modale di review pre-upload.
          Si attiva quando pendingFiles ha almeno un file: l'admin vede
          l'anteprima e imposta i metadati prima di caricare davvero. */}
      {pendingFiles.length > 0 && (
        <UploadPreviewModal
          file={pendingFiles[0]}
          remaining={pendingFiles.length}
          uploading={uploading}
          onSave={async (fields) => {
            const r = await doUpload(pendingFiles[0], fields);
            advanceQueue(r.ok);
          }}
          onSkip={() => advanceQueue(false)}
          onCancelAll={() => setPendingFiles([])} />
      )}
    </div>
  );
}

/* ---- Overview ---- */
function AdminOverview({ media, goAdmin }) {
  const { lang, t } = useLang();
  const photos = media.filter(m => m.type === "photo").length;
  const videos = media.filter(m => m.type === "video").length;
  const cats = Object.keys(window.NIWA_CATEGORIES).length;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label={lang === "it" ? "Foto" : "Photos"} value={photos} onClick={() => goAdmin("media", "gallery")} />
        <StatCard label="Video" value={videos} onClick={() => goAdmin("media", "gallery")} />
        <StatCard label={lang === "it" ? "Categorie" : "Categories"} value={cats} onClick={() => goAdmin("media", "categories")} />
        <StatCard label={lang === "it" ? "Lingue" : "Languages"} value="2" />
      </div>

      <div className="admin-card">
        <h3>{lang === "it" ? "Azioni rapide" : "Quick actions"}</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn--accent" onClick={() => goAdmin("media", "upload")}>
            <Icon.Upload />
            {lang === "it" ? "Carica nuovo media" : "Upload media"}
          </button>
          <button className="btn btn--ghost" onClick={() => goAdmin("media", "gallery")}>
            {lang === "it" ? "Gestisci media" : "Manage media"}
          </button>
          <button className="btn btn--ghost" onClick={() => goAdmin("pages", "home")}>
            {lang === "it" ? "Pagine del sito" : "Site pages"}
          </button>
          <button className="btn btn--ghost" onClick={() => goAdmin("media", "categories")}>
            {lang === "it" ? "Categorie" : "Categories"}
          </button>
        </div>
      </div>

      <div className="admin-card">
        <h3>{lang === "it" ? "Ultimi media" : "Recent media"}</h3>
        <div className="admin-grid-media">
          {media.slice(0, 8).map(m => (
            <div key={m.id} className="admin-tile" onClick={() => goAdmin("media", "gallery")}>
              <div className="admin-tile-media">
                {m.type === "video" ? (
                  <video src={window.niwaAssetUrl(m.src)} poster={window.niwaAssetUrl(m.poster, 400)} muted />
                ) : (
                     <img src={window.niwaAssetUrl(m.src, 400)} alt="" loading="lazy"
                       style={{ filter: window.niwaFilterStr({ ...window.NIWA_PRESETS[m.preset || "none"], ...m.adj }) }} />
                )}
                <div className="admin-tile-type">{m.type}</div>
              </div>
              <div className="admin-tile-info">
                <span className="t">{localized(m.title, lang) || "—"}</span>
                <span className="c">{m.category}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, onClick }) {
  return (
    <button onClick={onClick} className="admin-card" style={{ textAlign: "left", cursor: onClick ? "pointer" : "default", margin: 0, transition: "transform 220ms" }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div className="stat-num">{value}</div>
    </button>
  );
}

/* =====================================================================
   AdminMediaArea — pannello composito "Media"
   ─────────────────────────────────────────────────────────────────────
   Macro-area che raggruppa tutte le operazioni sui media in 4 sub-tab:
     1. Galleria — lista + edit di tutti i media esistenti
     2. Carica   — drop zone per nuovi upload
     3. Categorie — CRUD categorie
     4. Preset   — CRUD preset look

   I 4 componenti interni (AdminMedia, AdminUpload, AdminCategories,
   AdminPresets) sono quelli già esistenti, non sono duplicati: qui
   facciamo solo da wrapper di navigazione. La sub-tab attiva è
   persistita in sessionStorage tramite il parent (AdminPage).
   ===================================================================== */
function AdminMediaArea({
  media, editingId, setEditingId, updateMedia, removeMedia,
  onFiles, resetSeed, uploading,
  subSection, setSubSection,
}) {
  const { lang } = useLang();
  const { cats } = useCategories();
  const { order: presetOrder } = usePresets();

  // Default tab al primo accesso: "gallery". Se l'utente arriva con un
  // sub valido restiamo lì, altrimenti reset a gallery.
  const validSubs = ["gallery", "upload", "categories", "presets"];
  const sub = validSubs.includes(subSection) ? subSection : "gallery";
  useEffect(() => {
    if (!validSubs.includes(subSection)) setSubSection("gallery");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs = [
    { id: "gallery",    label: lang === "it" ? "Galleria"   : "Gallery",    count: media.length },
    { id: "upload",     label: lang === "it" ? "Carica"     : "Upload",     count: null },
    { id: "categories", label: lang === "it" ? "Categorie"  : "Categories", count: Object.keys(cats || {}).length },
    { id: "presets",    label: lang === "it" ? "Preset"     : "Presets",    count: presetOrder.length },
  ];

  return (
    <>
      <AdminTabs tabs={tabs} active={sub} onChange={setSubSection} />

      {sub === "gallery" && (
        <AdminMedia
          media={media}
          editingId={editingId}
          setEditingId={setEditingId}
          updateMedia={updateMedia}
          removeMedia={removeMedia}
          onUpload={() => setSubSection("upload")} />
      )}
      {sub === "upload" && (
        <AdminUpload onFiles={onFiles} resetSeed={resetSeed} uploading={uploading} />
      )}
      {sub === "categories" && (
        <AdminCategories />
      )}
      {sub === "presets" && (
        <AdminPresets />
      )}
    </>
  );
}

/* =====================================================================
   AdminPagesArea — pannello composito "Pagine"
   ─────────────────────────────────────────────────────────────────────
   Macro-area che raggruppa tutto ciò che riguarda le pagine pubbliche
   del sito (testi modificabili + collezioni associate) in 3 sub-tab:
     1. Home    — testi della home + gestione eventi
     2. Chi sono — testi della about + gestione servizi
     3. Contatti — testi della contatti + social + tipi di progetto

   In ciascuna sub-tab i contenuti sono affiancati: prima i testi
   dell'AdminCopy filtrato per quella sezione, poi i pannelli CRUD
   correlati. Tutto in una pagina sola, niente più sezioni isolate.
   ===================================================================== */
function AdminPagesArea({ subSection, setSubSection }) {
  const { lang } = useLang();
  const validSubs = ["home", "about", "contact"];
  const sub = validSubs.includes(subSection) ? subSection : "home";
  useEffect(() => {
    if (!validSubs.includes(subSection)) setSubSection("home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs = [
    { id: "home",    label: "Home",    count: null },
    { id: "about",   label: lang === "it" ? "Chi sono" : "About",   count: null },
    { id: "contact", label: lang === "it" ? "Contatti" : "Contact", count: null },
  ];

  return (
    <>
      <AdminTabs tabs={tabs} active={sub} onChange={setSubSection} />

      {sub === "home" && (
        <>
          <SectionHeading
            title={lang === "it" ? "Pagina Home" : "Home page"}
            subtitle={lang === "it"
              ? "Testi della home e timeline eventi mostrati ai visitatori."
              : "Home page copy and events timeline shown to visitors."} />
          {/* Testi pagina Home (eyebrow, titoli, blurb, stats labels…) */}
          <AdminCopy sectionFilter="Home" hideHeader />
          {/* Eventi: tutta la sezione CRUD eventi è inline qui */}
          <div className="admin-section-divider">
            {lang === "it" ? "Eventi della timeline" : "Timeline events"}
          </div>
          <AdminEvents />
        </>
      )}

      {sub === "about" && (
        <>
          <SectionHeading
            title={lang === "it" ? "Pagina Chi sono" : "About page"}
            subtitle={lang === "it"
              ? "Bio, dati personali e lista di servizi offerti."
              : "Bio, personal data and list of offered services."} />
          {/* Foto profilo + anno nascita + bio (era il vecchio AdminAbout) */}
          <AdminAbout />
          {/* Testi About (eyebrow, name, quote, bio_1, bio_2, journey_title…) */}
          <div className="admin-section-divider">
            {lang === "it" ? "Testi della pagina" : "Page copy"}
          </div>
          <AdminCopy sectionFilter="About" hideHeader />
          {/* Servizi: lista accanto a "Focus" sul sito pubblico */}
          <div className="admin-section-divider">
            {lang === "it" ? "Servizi offerti" : "Services offered"}
          </div>
          <AdminServices />
        </>
      )}

      {sub === "contact" && (
        <>
          <SectionHeading
            title={lang === "it" ? "Pagina Contatti" : "Contact page"}
            subtitle={lang === "it"
              ? "Testi, profili social e tipi di progetto disponibili nel form."
              : "Copy, social profiles, and project types in the form."} />
          {/* Testi contatti (email, social title, location, disponibilità on/off…) */}
          <AdminCopy sectionFilter="Contact" hideHeader />
          {/* Social link */}
          <div className="admin-section-divider">
            {lang === "it" ? "Profili social" : "Social profiles"}
          </div>
          <AdminSocials />
          {/* Tipi di progetto (subjects) */}
          <div className="admin-section-divider">
            {lang === "it" ? "Tipi di progetto (form contatti)" : "Project types (contact form)"}
          </div>
          <AdminSubjects />
        </>
      )}
    </>
  );
}

/* Componenti di supporto per la nuova struttura ──────────────────── */

function AdminTabs({ tabs, active, onChange }) {
  return (
    <div className="admin-tabs">
      {tabs.map(tab => (
        <button key={tab.id}
                type="button"
                className={"admin-tab " + (active === tab.id ? "is-active" : "")}
                onClick={() => onChange(tab.id)}>
          {tab.label}
          {tab.count != null && <span className="admin-tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="admin-section-heading">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

/* ---- Media manager ---- */
function AdminMedia({ media, editingId, setEditingId, updateMedia, removeMedia, onUpload }) {
  const { lang, t } = useLang();
  const { cats } = useCategories();
  const { show } = useToast();
  const [type, setType] = useState("all");
  const [cat, setCat] = useState("all");

  const filtered = media.filter(m => {
    if (type !== "all" && m.type !== type) return false;
    if (cat !== "all" && m.category !== cat) return false;
    return true;
  });

  const editing = media.find(m => m.id === editingId);

  const handleDelete = async (id) => {
    if (!confirm(lang === "it" ? "Eliminare?" : "Delete?")) return;
    const res = await removeMedia(id);
    if (!res.ok) {
      show((lang === "it" ? "Errore: " : "Error: ") + (res.error || "server_error"));
    }
  };

  return (
    <>
      <div className="admin-card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className={"filter-chip " + (type === "all" ? "is-active" : "")} onClick={() => setType("all")}>{t("common.all")}</button>
            <button className={"filter-chip " + (type === "photo" ? "is-active" : "")} onClick={() => setType("photo")}>Photos</button>
            <button className={"filter-chip " + (type === "video" ? "is-active" : "")} onClick={() => setType("video")}>Videos</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className={"filter-chip " + (cat === "all" ? "is-active" : "")} onClick={() => setCat("all")}>{t("common.all")}</button>
            {Object.keys(cats || {}).map(c => (
              <button key={c} className={"filter-chip " + (cat === c ? "is-active" : "")} onClick={() => setCat(c)}>
                {cats[c]?.[lang] || c}
              </button>
            ))}
          </div>
          <button className="btn btn--accent" onClick={() => onUpload && onUpload()}>
            <Icon.Plus />
            {lang === "it" ? "Aggiungi" : "Add"}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>{t("admin.empty")}</h3>
        </div>
      ) : (
        <div className="admin-grid-media">
          {filtered.map(m => (
            <div key={m.id} className={"admin-tile " + (editingId === m.id ? "is-editing" : "")}
                 onClick={() => setEditingId(m.id)}>
              <div className="admin-tile-media">
                {m.type === "video" ? (
                  <video src={window.niwaAssetUrl(m.src)} poster={window.niwaAssetUrl(m.poster, 400)} muted />
                ) : (
                     <img src={window.niwaAssetUrl(m.src, 400)} alt="" loading="lazy"
                       style={{ filter: window.niwaFilterStr({ ...window.NIWA_PRESETS[m.preset || "none"], ...m.adj }) }} />
                )}
                <div className="admin-tile-type">{m.type}</div>
                <div className="admin-tile-actions">
                  <button onClick={(e) => { e.stopPropagation(); setEditingId(m.id); }} title="Edit"><Icon.Edit /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} title="Delete"><Icon.Trash /></button>
                </div>
              </div>
              <div className="admin-tile-info">
                <span className="t">{localized(m.title, lang) || (lang === "it" ? "Senza titolo" : "Untitled")}</span>
                <span className="c">{m.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditModal item={editing}
                   updateMedia={updateMedia}
                   onClose={() => setEditingId(null)} />
      )}
    </>
  );
}

/* ---- Edit modal: portal + scroll lock + centering robusto ----
   Stessa filosofia della Lightbox: il modale viene renderizzato
   direttamente in document.body via Portal, così il position:fixed
   è sempre relativo al viewport e non risente di transform su pagine
   antenate (.page-transition-enter, ecc.).
   In più, blocca lo scroll della pagina sotto e lo ripristina
   esattamente alla posizione originale alla chiusura. */
function EditModal({ item, updateMedia, onClose }) {
  const { lang } = useLang();

  // Lock scroll robusto, identico al pattern usato dalla Lightbox
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow:    html.style.overflow,
      bodyOverflow:    body.style.overflow,
      bodyPosition:    body.style.position,
      bodyTop:         body.style.top,
      bodyLeft:        body.style.left,
      bodyRight:       body.style.right,
      bodyWidth:       body.style.width,
      htmlScrollBehavior: html.style.scrollBehavior,
    };
    html.style.overflow = "hidden";
    html.style.scrollBehavior = "auto";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.scrollBehavior = prev.htmlScrollBehavior;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, scrollY);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const node = (
    <div className="edit-modal-backdrop"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="edit-modal-card">
        <button className="icon-btn edit-modal-close" onClick={onClose}>
          <Icon.Close />
        </button>
        <h3 className="edit-modal-title">
          {lang === "it" ? "Modifica media" : "Edit media"}
        </h3>
        <div className="edit-modal-body">
          <EditPane item={item} updateMedia={updateMedia} onClose={onClose} />
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(node, document.body);
}

/* ---- Upload preview modal ----
   Si apre quando l'admin droppa un file. Mostra anteprima + form coi metadati
   (categoria, preset, titoli IT/EN, descrizione, tag, visibilità) e fa
   l'upload reale solo dopo che l'utente preme "Salva e carica".
   Se ci sono più file in coda, dopo "Salva" o "Salta" si passa al prossimo. */
function UploadPreviewModal({ file, remaining, uploading, onSave, onSkip, onCancelAll }) {
  const { lang } = useLang();
  const { cats } = useCategories();
  const { order: presetOrder, presets: presetMap } = usePresets();

  const isVideo = file?.type?.startsWith?.("video/");

  // URL temporaneo per l'anteprima locale: creiamo un ObjectURL dal File API,
  // lo revochiamo quando cambia file o smonta il modale (no memory leak).
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Default categoria: la prima delle attive
  const catKeys = Object.keys(cats || {});
  const defaultCategory = catKeys[0] || "nature";

  // Stato form
  const [category, setCategory] = useState(defaultCategory);
  const [preset, setPreset]     = useState("niwa");
  const [aspect, setAspect]     = useState("sq");
  const [visibility, setVisibility] = useState("published");
  const [titleIt, setTitleIt]   = useState("");
  const [titleEn, setTitleEn]   = useState("");
  const [descIt, setDescIt]     = useState("");
  const [descEn, setDescEn]     = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags]         = useState([]);
  // Nuovi toggle: l'admin sceglie qui se mettere il media nel carosello
  // e se mostrare le info nella lightbox al visitatore. Default coerenti
  // col comportamento storico: non-featured, info visibili.
  const [isFeatured, setIsFeatured] = useState(false);
  const [showInfo,   setShowInfo]   = useState(true);

  // Reset quando arriva un nuovo file in coda
  useEffect(() => {
    setCategory(defaultCategory);
    setPreset("niwa");
    setAspect("sq");
    setVisibility("published");
    setTitleIt(""); setTitleEn("");
    setDescIt(""); setDescEn("");
    setTagInput(""); setTags([]);
    setIsFeatured(false);
    setShowInfo(true);
  }, [file]);

  // Tentiamo di dedurre l'aspect automaticamente dalle dimensioni reali
  // dell'immagine: appena l'anteprima è caricata, leggiamo naturalWidth/Height
  // e settiamo aspect e larghezza/altezza coerentemente.
  const imgRef = useRef(null);
  useEffect(() => {
    if (!previewUrl || isVideo) return;
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return;
      const r = w / h;
      // Mappa coerente con _recompute_image_sizes.php
      let a = "sq";
      if (r >= 2.2) a = "pano";
      else if (r >= 1.3) a = "wide";
      else if (r >= 0.87) a = "sq";
      else if (r >= 0.55) a = "port";
      else a = "tall";
      setAspect(a);
    };
    img.src = previewUrl;
  }, [previewUrl, isVideo]);

  // Lock scroll robusto (stesso pattern di EditModal/Lightbox)
  useEffect(() => {
    const scrollY = window.scrollY || 0;
    const html = document.documentElement, body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    if (!tags.includes(v)) setTags([...tags, v]);
    setTagInput("");
  };
  const removeTag = (tg) => setTags(tags.filter(x => x !== tg));

  const handleSave = () => {
    if (uploading) return;
    onSave({
      category, preset, aspect, visibility,
      title: { it: titleIt.trim(), en: titleEn.trim() },
      desc:  { it: descIt.trim(),  en: descEn.trim() },
      tags,
      is_featured: isFeatured,
      show_info: showInfo,
    });
  };

  // Preset preview filter (se selezionato)
  const filterStr = window.niwaFilterStr({
    ...(presetMap[preset] || window.NIWA_PRESETS[preset] || window.NIWA_PRESETS.none)
  });

  const node = (
    <div className="edit-modal-backdrop"
         onClick={(e) => { if (e.target === e.currentTarget) onCancelAll(); }}>
      <div className="edit-modal-card upload-preview-card">
        <h3 className="edit-modal-title">
          {lang === "it" ? "Nuovo caricamento" : "New upload"}
          {remaining > 1 && (
            <span style={{
              fontSize: 12, fontFamily: "var(--font-mono)",
              color: "var(--fg-faint)", marginLeft: 12, letterSpacing: "0.08em"
            }}>
              {remaining} {lang === "it" ? "in coda" : "in queue"}
            </span>
          )}
        </h3>
        <button className="icon-btn edit-modal-close"
                onClick={onCancelAll}
                disabled={uploading}
                title={lang === "it" ? "Annulla tutto" : "Cancel all"}>
          <Icon.Close />
        </button>

        <div className="edit-modal-body">
          <div className="upload-preview-grid">
            <div className="upload-preview-media">
              {isVideo ? (
                <video src={previewUrl} controls muted style={{ filter: filterStr }} />
              ) : (
                <img ref={imgRef} src={previewUrl} alt="" style={{ filter: filterStr }} />
              )}
              <div className="upload-preview-filename">{file.name}</div>
            </div>

            <div className="upload-preview-form">
              <div className="field-row">
                <div className="field">
                  <label>{lang === "it" ? "Categoria" : "Category"}</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {catKeys.map(c => (
                      <option key={c} value={c}>{cats[c]?.[lang] || c}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>{lang === "it" ? "Visibilità" : "Visibility"}</label>
                  <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                    <option value="published">{lang === "it" ? "Pubblicata" : "Published"}</option>
                    <option value="draft">{lang === "it" ? "Bozza" : "Draft"}</option>
                    <option value="private">{lang === "it" ? "Privata" : "Private"}</option>
                  </select>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>{lang === "it" ? "Preset" : "Preset"}</label>
                  <select value={preset} onChange={(e) => setPreset(e.target.value)}>
                    {(presetOrder.length ? presetOrder : window.NIWA_PRESET_KEYS).map(k => (
                      <option key={k} value={k}>
                        {(presetMap[k] || window.NIWA_PRESETS[k])?.label?.[lang] || k}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>{lang === "it" ? "Proporzione" : "Aspect"}</label>
                  <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                    <option value="sq">{lang === "it" ? "Quadrata" : "Square"}</option>
                    <option value="port">{lang === "it" ? "Ritratto" : "Portrait"}</option>
                    <option value="tall">{lang === "it" ? "Verticale" : "Tall"}</option>
                    <option value="wide">{lang === "it" ? "Orizzontale" : "Wide"}</option>
                    <option value="pano">{lang === "it" ? "Panoramica" : "Panoramic"}</option>
                  </select>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>{lang === "it" ? "Titolo IT" : "Title IT"}</label>
                  <input type="text" value={titleIt}
                         onChange={(e) => setTitleIt(e.target.value)}
                         placeholder={lang === "it" ? "Titolo in italiano" : "Italian title"} />
                </div>
                <div className="field">
                  <label>{lang === "it" ? "Titolo EN" : "Title EN"}</label>
                  <input type="text" value={titleEn}
                         onChange={(e) => setTitleEn(e.target.value)}
                         placeholder={lang === "it" ? "Titolo in inglese" : "English title"} />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>{lang === "it" ? "Descrizione IT" : "Description IT"}</label>
                  <textarea rows="2" value={descIt}
                            onChange={(e) => setDescIt(e.target.value)}
                            placeholder="…"></textarea>
                </div>
                <div className="field">
                  <label>{lang === "it" ? "Descrizione EN" : "Description EN"}</label>
                  <textarea rows="2" value={descEn}
                            onChange={(e) => setDescEn(e.target.value)}
                            placeholder="…"></textarea>
                </div>
              </div>

              <div className="field">
                <label>{lang === "it" ? "Tag" : "Tags"}</label>
                <div className="tag-input">
                  {tags.map(tg => (
                    <span className="tag-pill" key={tg}>
                      #{tg}
                      <button onClick={() => removeTag(tg)}><Icon.Close /></button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder={lang === "it" ? "Aggiungi tag e premi Invio" : "Add tag and press Enter"} />
                </div>
              </div>

              {/* Comportamento del media nel sito pubblico */}
              <div className="field">
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 8, textTransform: "none", letterSpacing: 0, fontSize: 14, fontFamily: "inherit", color: "var(--fg)" }}>
                  <input type="checkbox"
                         checked={isFeatured}
                         onChange={(e) => setIsFeatured(e.target.checked)} />
                  <span style={{ fontWeight: 500 }}>
                    {lang === "it" ? "Includi nel carosello home" : "Include in home carousel"}
                  </span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: 14, fontFamily: "inherit", color: "var(--fg)" }}>
                  <input type="checkbox"
                         checked={showInfo}
                         onChange={(e) => setShowInfo(e.target.checked)} />
                  <span style={{ fontWeight: 500 }}>
                    {lang === "it" ? "Mostra titolo/descrizione nell'anteprima" : "Show title/description in preview"}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="upload-preview-actions">
            <button className="btn btn--ghost" onClick={onSkip} disabled={uploading}>
              {lang === "it" ? "Salta" : "Skip"}
            </button>
            <button className="btn btn--accent" onClick={handleSave} disabled={uploading}>
              {uploading
                ? (lang === "it" ? "Caricamento…" : "Uploading…")
                : (lang === "it" ? "Salva e carica" : "Save and upload")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(node, document.body);
}
function AdminUpload({ onFiles, resetSeed, uploading }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const { t, lang } = useLang();
  const aT = (k) => t("admin." + k);

  return (
    <>
      <div className="admin-card">
        <h3>{aT("drop_title")}</h3>
        <div
          className={"dropzone " + (drag ? "is-drag" : "") + (uploading ? " is-uploading" : "")}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { if (!uploading) { e.preventDefault(); setDrag(true); } }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (uploading) return;
            if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
          }}
          style={uploading ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
          <div className="dropzone-icon"><Icon.Upload /></div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            {uploading
              ? (lang === "it" ? "Caricamento in corso…" : "Uploading…")
              : aT("drop_title")}
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-faint)", marginTop: 6 }}>{aT("drop_sub")}</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            style={{ display: "none" }}
            disabled={uploading}
            onChange={(e) => { if (e.target.files.length) onFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      </div>
      <div className="admin-card">
        <h3>{lang === "it" ? "Info" : "Info"}</h3>
        <p style={{ fontSize: 13, color: "var(--fg-soft)", margin: 0, lineHeight: 1.6 }}>
          {lang === "it"
            ? "I file vengono caricati sul server e i metadati salvati nel database. Formati: JPG, PNG, WebP, MP4, WebM. Massimo 50 MB per immagine, 200 MB per video. I nuovi media sono pubblicati subito: per nasconderli, modificali e cambia 'Visibilità' a 'bozza'."
            : "Files are uploaded to the server and metadata saved to the database. Formats: JPG, PNG, WebP, MP4, WebM. Max 50 MB for images, 200 MB for videos. New media are published immediately: to hide them, edit and change 'Visibility' to 'draft'."}
        </p>
        <button className="btn btn--ghost" style={{ marginTop: 12 }} onClick={resetSeed}>
          {lang === "it" ? "Ricarica dal server" : "Reload from server"}
        </button>
      </div>
    </>
  );
}

/* ---- Categories ----
   Tutte le mutazioni passano per /api/admin/categories.php tramite
   useCategories(). Il provider ricarica la lista dopo ogni operazione. */
function AdminCategories() {
  const { lang } = useLang();
  const { cats, create, update, remove } = useCategories();
  const { show } = useToast();
  const [newKey, setNewKey] = useState("");
  const [newIt, setNewIt]   = useState("");
  const [newEn, setNewEn]   = useState("");
  const [busy, setBusy]     = useState(false);

  // Bozza locale per le label esistenti — viene salvata su blur
  const [draft, setDraft] = useState({});
  useEffect(() => {
    setDraft({ ...cats });
  }, [cats]);

  const onLabelChange = (key, locale, value) => {
    setDraft(d => ({ ...d, [key]: { ...(d[key] || {}), [locale]: value } }));
  };

  const onLabelBlur = async (key, locale) => {
    const v = draft[key]?.[locale];
    if (v === undefined || v === cats[key]?.[locale]) return;
    const res = await update(key, { [locale]: v });
    if (!res.ok) {
      show((lang === "it" ? "Errore: " : "Error: ") + (res.error || "server_error"));
    }
  };

  const removeCat = async (key) => {
    if (!confirm(lang === "it" ? "Rimuovere questa categoria?" : "Remove this category?")) return;
    const res = await remove(key);
    if (!res.ok) {
      const msg = res.error === "category_in_use"
        ? (lang === "it" ? "Categoria in uso, impossibile rimuovere" : "Category in use, cannot remove")
        : (res.error || "server_error");
      show(msg);
    } else {
      show(lang === "it" ? "Categoria rimossa" : "Category removed");
    }
  };

  const addCat = async () => {
    const k = newKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!k || cats[k] || busy) return;
    setBusy(true);
    const res = await create(k, newIt || k, newEn || k);
    setBusy(false);
    if (!res.ok) {
      show((lang === "it" ? "Errore: " : "Error: ") + (res.error || "server_error"));
      return;
    }
    setNewKey(""); setNewIt(""); setNewEn("");
    show(lang === "it" ? "Categoria aggiunta" : "Category added");
  };

  return (
    <>
      <div className="admin-card">
        <h3>{lang === "it" ? "Gestisci categorie" : "Manage categories"}</h3>
        <p style={{ fontSize: 13, color: "var(--fg-soft)", margin: "0 0 16px" }}>
          {lang === "it"
            ? "Le modifiche vengono salvate sul server quando esci dal campo. Una categoria con media collegati non può essere eliminata."
            : "Changes are saved to the server on blur. A category with linked media cannot be deleted."}
        </p>
        {Object.keys(cats || {}).map(k => (
          <div key={k} className="cat-row">
            <div className="key">{k}</div>
            <input
              value={draft[k]?.it ?? ""}
              onChange={(e) => onLabelChange(k, "it", e.target.value)}
              onBlur={() => onLabelBlur(k, "it")}
              placeholder="IT" />
            <input
              value={draft[k]?.en ?? ""}
              onChange={(e) => onLabelChange(k, "en", e.target.value)}
              onBlur={() => onLabelBlur(k, "en")}
              placeholder="EN" />
            <button className="icon-btn" onClick={() => removeCat(k)} title="Delete"><Icon.Trash /></button>
          </div>
        ))}
      </div>
      <div className="admin-card">
        <h3>{lang === "it" ? "Aggiungi categoria" : "Add category"}</h3>
        <div className="cat-row" style={{ background: "var(--accent-soft)" }}>
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="key (e.g. street)" disabled={busy} />
          <input value={newIt} onChange={(e) => setNewIt(e.target.value)} placeholder="Etichetta IT" disabled={busy} />
          <input value={newEn} onChange={(e) => setNewEn(e.target.value)} placeholder="EN label" disabled={busy} />
          <button className="icon-btn" onClick={addCat} disabled={busy}
                  style={{ background: "var(--accent)", color: "var(--accent-fg)" }} title="Add"><Icon.Plus /></button>
        </div>
      </div>
    </>
  );
}

/* ---- Copy editor ---- */
const COPY_FIELDS = [
  { section: "Home", key: "home.eyebrow", label: "Hero eyebrow" },
  { section: "Home", key: "home.title_a", label: "Hero corner small" },
  { section: "Home", key: "home.blurb", label: "Blurb", multi: true },
  { section: "Home", key: "home.featured", label: "Featured title" },
  { section: "Home", key: "home.featured_sub", label: "Featured subtitle" },
  { section: "Home", key: "home.stats.events_val", label: "Numero eventi mostrato in home (es. 42)" },
  { section: "About", key: "about.eyebrow", label: "Eyebrow" },
  { section: "About", key: "about.name", label: "Name" },
  { section: "About", key: "about.quote", label: "Quote" },
  { section: "About", key: "about.bio_1", label: "Bio paragraph 1", multi: true },
  { section: "About", key: "about.bio_2", label: "Bio paragraph 2", multi: true },
  { section: "About", key: "about.birth_year", label: "Anno di nascita (es. 1999)" },
  { section: "About", key: "about.since_year", label: "Anno 'attivo dal' (es. 2021)" },
  { section: "About", key: "about.journey_title", label: "Titolo sezione 'Journey'" },
  { section: "About", key: "about.based_val", label: "Based" },
  { section: "About", key: "about.focus_val", label: "Focus" },
  { section: "Contact", key: "contact.eyebrow", label: "Eyebrow" },
  { section: "Contact", key: "contact.title_a", label: "Title line 1" },
  { section: "Contact", key: "contact.title_b", label: "Title line 2" },
  { section: "Contact", key: "contact.sub", label: "Subtitle", multi: true },
  // Email mostrata in pagina (e cliccabile con mailto:). Stringa singola
  // (stessa email IT/EN ma metto comunque entrambe le lingue per coerenza).
  { section: "Contact", key: "contact.side.email_val", label: "Indirizzo email pubblico (es. hello@niwa.ph)" },
  // Etichette delle 4 card della aside contatti (modificabili)
  { section: "Contact", key: "contact.side.email", label: "Card label · Email" },
  { section: "Contact", key: "contact.side.social", label: "Card label · Social (titolo sezione)" },
  { section: "Contact", key: "contact.side.location", label: "Card label · Location" },
  { section: "Contact", key: "contact.side.availability", label: "Card label · Disponibilità" },
  // Location: se vuota, l'intera card viene NASCOSTA in pagina
  { section: "Contact", key: "contact.side.location_val", label: "Location (svuota per nascondere la card)" },
  // Disponibilità — toggle on/off + testo personalizzabile per ogni stato.
  // L'admin scrive "on" (o "1", "true", "si", "yes") per attivare lo stato
  // disponibile; qualsiasi altro valore (incluso vuoto) = non disponibile.
  { section: "Contact", key: "contact.side.availability_on", label: "Disponibilità ATTIVA? (scrivi 'on' o 'off')" },
  { section: "Contact", key: "contact.side.availability_val", label: "Testo quando disponibile (es. 'Aperto a nuovi progetti')" },
  { section: "Contact", key: "contact.side.availability_off_val", label: "Testo quando NON disponibile (es. 'Completo fino a marzo')" },
  // Rate-limit del form contatti: l'admin sceglie max messaggi e finestra
  // in minuti. Letti da api/contact.php; valori non validi (0, vuoto, testo)
  // ricadono al default 5/60.
  { section: "Contact", key: "contact.rate_limit_max",    label: "Anti-spam: max messaggi per IP (default 5)" },
  { section: "Contact", key: "contact.rate_limit_window", label: "Anti-spam: finestra in minuti (default 60)" }
];

function getCopyValue(lang, path) {
  const parts = path.split(".");
  let cur = window.NIWA_I18N[lang];
  for (const p of parts) { if (cur == null) return ""; cur = cur[p]; }
  return cur ?? "";
}

function setCopyValue(lang, path, value) {
  const parts = path.split(".");
  let cur = window.NIWA_I18N[lang];
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function AdminCopy({ sectionFilter, hideHeader }) {
  const { lang } = useLang();
  const { bumpKey, upsert } = useCopy();
  const { show } = useToast();

  // Salvataggio su blur con confronto contro il valore precedente
  const onChange = async (key, locale, value) => {
    // Aggiorna NIWA_I18N localmente perché il provider lo fa già al reload,
    // ma la mutazione via API è la fonte autoritativa.
    const res = await upsert(key, { [locale]: value });
    if (!res.ok) {
      show((lang === "it" ? "Errore: " : "Error: ") + (res.error || "server_error"));
    }
  };

  // Filtra i campi alla sezione richiesta (es. "Home"). Se sectionFilter
  // è null/undefined mostra tutto come prima. Sub-tab di "Pages" passa
  // la sezione che le interessa così l'admin vede solo i testi pertinenti.
  const allFields = sectionFilter
    ? COPY_FIELDS.filter(f => f.section === sectionFilter)
    : COPY_FIELDS;
  const sections = [...new Set(allFields.map(f => f.section))];

  return (
    <>
      {!hideHeader && (
        <div className="admin-card">
          <h3>{lang === "it" ? "Modifica testi del sito" : "Edit site copy"}</h3>
          <p style={{ fontSize: 13, color: "var(--fg-soft)", margin: 0 }}>
            {lang === "it"
              ? "Modifica i testi delle pagine in italiano e inglese. Le modifiche vengono salvate sul server quando esci dal campo."
              : "Edit page copy in Italian and English. Changes are saved to the server on blur."}
          </p>
        </div>
      )}

      {sections.map(sec => (
        <div className="admin-card" key={sec}>
          {!sectionFilter && <h3>{sec}</h3>}
          {allFields.filter(f => f.section === sec).map(f => {
            const Tag = f.multi ? "textarea" : "input";
            return (
              <div className="copy-edit-grid" key={f.key + bumpKey}>
                <div className="key">{f.label}<br /><span style={{ opacity: 0.6, fontSize: 9 }}>{f.key}</span></div>
                <Tag rows={f.multi ? 3 : undefined}
                     defaultValue={getCopyValue("it", f.key)}
                     placeholder="Italiano"
                     onBlur={(e) => onChange(f.key, "it", e.target.value)} />
                <Tag rows={f.multi ? 3 : undefined}
                     defaultValue={getCopyValue("en", f.key)}
                     placeholder="English"
                     onBlur={(e) => onChange(f.key, "en", e.target.value)} />
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ---- Edit pane (kept from before, used in modal) ---- */
function EditPane({ item, updateMedia, onClose }) {
  const { lang, t } = useLang();
  const aT = (k) => t("admin." + k);
  const { cats: categoriesMap } = useCategories();
  const { order: presetOrder, presets: presetMap } = usePresets();
  const { show } = useToast();
  const cats = Object.keys(categoriesMap || {});

  const [draft, setDraft] = useState(() => ({
    title: { ...item.title },
    desc: { ...item.desc },
    category: item.category,
    tags: [...(item.tags || [])],
    preset: item.preset || "none",
    adj: { ...item.adj },
    // Toggle visibilità "comportamento":
    // is_featured: questo media va nel carosello della home
    // show_info: nella lightbox vengono mostrate le info (titolo, desc, tag)
    is_featured: !!item.is_featured,
    show_info: item.show_info !== false, // default true se assente
  }));
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const presetBase = (presetMap && presetMap[draft.preset]) || window.NIWA_PRESETS[draft.preset] || window.NIWA_PRESETS.none;
  const eff = (key) => draft.adj[key] !== undefined ? draft.adj[key] : presetBase[key];

  const setSlider = (key, v) => setDraft(d => ({ ...d, adj: { ...d.adj, [key]: parseFloat(v) } }));
  const setPreset = (k) => setDraft(d => ({ ...d, preset: k, adj: {} }));
  const resetAll = () => setDraft(d => ({ ...d, preset: "none", adj: {} }));

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    if (!draft.tags.includes(v)) setDraft(d => ({ ...d, tags: [...d.tags, v] }));
    setTagInput("");
  };
  const removeTag = (tg) => setDraft(d => ({ ...d, tags: d.tags.filter(x => x !== tg) }));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const res = await updateMedia(item.id, draft);
    setSaving(false);
    if (!res || !res.ok) {
      show((lang === "it" ? "Errore di salvataggio: " : "Save error: ") + (res?.error || "server_error"));
      return;
    }
    onClose();
  };

  const filterStr = window.niwaFilterStr({ ...presetBase, ...draft.adj });
  const grain = (eff("grain") || 0) / 100;
  const vignette = (eff("vignette") || 0) / 100;
  const sliderKeys = ["exposure", "contrast", "saturation", "warmth", "grain", "vignette", "fade"];

  return (
    <div className="edit-pane">
      <div className="edit-preview">
        {item.type === "video" ? (
          <video src={window.niwaAssetUrl(item.src)} poster={window.niwaAssetUrl(item.poster)} muted loop autoPlay playsInline style={{ filter: filterStr }} />
        ) : (
          <img src={window.niwaAssetUrl(item.src)} alt="" style={{ filter: filterStr }} />
        )}
        {grain > 0 && <div style={grainStyle(grain)} />}
        {vignette > 0 && <div style={vignetteStyle(vignette)} />}
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>{aT("preset_title")}</div>
        <div className="preset-row">
          {(presetOrder.length ? presetOrder : window.NIWA_PRESET_KEYS).map(k => (
            <button key={k}
                    className={"preset-chip " + (draft.preset === k ? "is-active" : "")}
                    onClick={() => setPreset(k)}>
              {(presetMap[k] || window.NIWA_PRESETS[k])?.label?.[lang] || k}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="eyebrow">{aT("adjustments")}</div>
          <button className="preset-chip" onClick={resetAll} style={{ fontSize: 10 }}>{aT("reset")}</button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {sliderKeys.map(k => (
            <div className="slider-row" key={k}>
              <label>{t(`admin.sliders.${k}`)}</label>
              <input type="range"
                     min={k === "grain" || k === "vignette" || k === "fade" ? 0 : -100}
                     max={100}
                     step={1}
                     value={eff(k) || 0}
                     onChange={(e) => setSlider(k, e.target.value)} />
              <div className="val">{(eff(k) || 0) > 0 ? "+" : ""}{Math.round(eff(k) || 0)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>{aT("fields.category")}</label>
          <select value={draft.category} onChange={(e) => setDraft(d => ({ ...d, category: e.target.value }))}>
            {cats.map(c => (
              <option key={c} value={c}>{categoriesMap[c]?.[lang] || c}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{aT("fields.type")}</label>
          <input value={item.type} disabled style={{ textTransform: "capitalize", fontFamily: "var(--font-mono)", fontSize: 13 }} />
        </div>
      </div>

      {/* Toggle "comportamento" del media nel sito pubblico.
          Sono 2 flag indipendenti che l'admin attiva/disattiva. */}
      <div className="field-row">
        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 0 }}>
            <input type="checkbox"
                   checked={draft.is_featured}
                   onChange={(e) => setDraft(d => ({ ...d, is_featured: e.target.checked }))} />
            <div>
              <div style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: 14, fontFamily: "inherit" }}>
                {lang === "it" ? "Includi nel carosello home" : "Include in home carousel"}
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2, fontFamily: "inherit", letterSpacing: 0, textTransform: "none" }}>
                {lang === "it"
                  ? "Solo i media flaggati appaiono nel carosello (filtrati per orientamento)."
                  : "Only flagged media appear in the carousel (filtered by orientation)."}
              </div>
            </div>
          </label>
        </div>
        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 0 }}>
            <input type="checkbox"
                   checked={draft.show_info}
                   onChange={(e) => setDraft(d => ({ ...d, show_info: e.target.checked }))} />
            <div>
              <div style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: 14, fontFamily: "inherit" }}>
                {lang === "it" ? "Mostra info nell'anteprima" : "Show info in preview"}
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2, fontFamily: "inherit", letterSpacing: 0, textTransform: "none" }}>
                {lang === "it"
                  ? "Se disattivato, la lightbox mostra solo l'immagine senza titolo/descrizione."
                  : "If off, the lightbox shows only the image without title/description."}
              </div>
            </div>
          </label>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>{aT("fields.title")} · IT</label>
          <input value={draft.title.it}
                 placeholder={aT("placeholders.title")}
                 onChange={(e) => setDraft(d => ({ ...d, title: { ...d.title, it: e.target.value } }))} />
        </div>
        <div className="field">
          <label>{aT("fields.title")} · EN</label>
          <input value={draft.title.en}
                 placeholder={aT("placeholders.title")}
                 onChange={(e) => setDraft(d => ({ ...d, title: { ...d.title, en: e.target.value } }))} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>{aT("fields.description")} · IT</label>
          <textarea rows="2" value={draft.desc.it}
                    placeholder={aT("placeholders.description")}
                    onChange={(e) => setDraft(d => ({ ...d, desc: { ...d.desc, it: e.target.value } }))} />
        </div>
        <div className="field">
          <label>{aT("fields.description")} · EN</label>
          <textarea rows="2" value={draft.desc.en}
                    placeholder={aT("placeholders.description")}
                    onChange={(e) => setDraft(d => ({ ...d, desc: { ...d.desc, en: e.target.value } }))} />
        </div>
      </div>

      {/* Picker per il frame del video da usare nel carosello home.
          Visibile solo per i media di tipo video. Permette all'admin di
          scegliere un fotogramma specifico (timestamp) e salvarlo come
          immagine statica sul server. */}
      {item.type === "video" && (
        <VideoFramePicker item={item} />
      )}

      <div className="field">
        <label>{aT("fields.tags")}</label>
        <div className="tag-input">
          {draft.tags.map(tg => (
            <span className="tag-pill" key={tg}>
              #{tg}
              <button onClick={() => removeTag(tg)}><Icon.Close /></button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder={aT("placeholders.tags")} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button className="btn btn--ghost" onClick={onClose} disabled={saving}>{lang === "it" ? "Annulla" : "Cancel"}</button>
        <button className="btn btn--accent" onClick={save} disabled={saving}>
          {saving ? (lang === "it" ? "Salvataggio…" : "Saving…") : aT("save")}
          {!saving && <span className="btn-arrow"><Icon.Arrow /></span>}
        </button>
      </div>
    </div>
  );
}

/* ---- VideoFramePicker ----
   Permette all'admin di selezionare un frame specifico da un video e
   salvarlo come "copertina carosello" (campo media.carousel_frame_url).
   Quel frame apparirà come immagine statica nel carosello home al posto
   del video animato.

   Funzionamento:
   - Carichiamo il <video> con preload=metadata per ottenere la durata
     senza scaricare tutto il file.
   - Slider HTML5 permette di scorrere la timeline; il video.currentTime
     si aggiorna live e mostra l'anteprima.
   - "Cattura" disegna il frame corrente su un <canvas>, lo converte in
     blob JPEG (qualità 92%) e fa POST a /api/admin/video_frame.php.
   - Su successo, mostra subito l'anteprima della copertina salvata.
   - "Rimuovi" fa DELETE sull'endpoint e torna allo stato senza frame.

   Note tecniche:
   - I video remoti devono essere serviti col CORS abilitato per
     poter leggere il frame nel canvas; i nostri lo sono (stesso host).
   - Se il video ha audio, ricordiamo di settare muted=true così
     l'autoplay funziona anche su mobile durante lo scrub. */
function VideoFramePicker({ item }) {
  const { lang } = useLang();
  const { show } = useToast();
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  const [duration,    setDuration]    = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [capturing,   setCapturing]   = useState(false);
  // Frame attuale impostato sul media (dal DB). Stato locale così
  // l'aggiornamento è ottimistico subito dopo la cattura.
  const [frameUrl, setFrameUrl] = useState(item.carousel_frame_url || null);

  // Sync se l'item cambia (altro media modificato senza chiudere il modal)
  useEffect(() => {
    setFrameUrl(item.carousel_frame_url || null);
    setCurrentTime(0);
  }, [item.id_media]);

  const onLoaded = () => {
    const v = videoRef.current;
    if (v) setDuration(v.duration || 0);
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (v) setCurrentTime(v.currentTime);
  };

  const onSliderChange = (e) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const captureFrame = async () => {
    if (capturing) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    // Dimensioni naturali del video; usiamo width/height del videoElement
    const w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) {
      show(lang === "it" ? "Video non ancora pronto" : "Video not ready yet");
      return;
    }
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    try {
      ctx.drawImage(v, 0, 0, w, h);
    } catch (e) {
      // Tipicamente "Tainted canvas" se il video è cross-origin senza CORS
      show(lang === "it" ? "Impossibile leggere il frame (CORS)" : "Cannot read frame (CORS)");
      return;
    }
    setCapturing(true);

    // Converte canvas → Blob JPEG
    const blob = await new Promise((resolve) => {
      c.toBlob(resolve, "image/jpeg", 0.92);
    });
    if (!blob) {
      setCapturing(false);
      show(lang === "it" ? "Impossibile generare l'immagine" : "Cannot generate image");
      return;
    }

    const fd = new FormData();
    fd.append("file", blob, `frame.jpg`);
    fd.append("id_media", String(item.id_media));

    try {
      const res = await fetch("/api/admin/video_frame.php", {
        method: "POST", credentials: "include", body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "save_failed"));
        setCapturing(false);
        return;
      }
      setFrameUrl(data.carousel_frame_url);
      show(lang === "it" ? "Copertina salvata" : "Cover saved");
      // Notifica home/sito pubblico: rifetcha media così la nuova
      // copertina appare nel carosello senza dover ricaricare la pagina.
      window.dispatchEvent(new Event("niwa-media-updated"));
    } catch (err) {
      show(lang === "it" ? "Errore di rete" : "Network error");
    } finally {
      setCapturing(false);
    }
  };

  const removeFrame = async () => {
    if (!confirm(lang === "it" ? "Rimuovere la copertina personalizzata?" : "Remove custom cover?")) return;
    try {
      const res = await fetch(`/api/admin/video_frame.php?id=${item.id_media}`, {
        method: "DELETE", credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "delete_failed"));
        return;
      }
      setFrameUrl(null);
      show(lang === "it" ? "Copertina rimossa" : "Cover removed");
      window.dispatchEvent(new Event("niwa-media-updated"));
    } catch (err) {
      show(lang === "it" ? "Errore di rete" : "Network error");
    }
  };

  const fmt = (sec) => {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="video-frame-picker">
      <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-soft)", display: "block", marginBottom: 12 }}>
        {lang === "it" ? "Copertina carosello (frame video)" : "Carousel cover (video frame)"}
      </label>

      <div className="video-frame-grid">
        {/* Sinistra: video con timeline */}
        <div className="video-frame-source">
          <video
            ref={videoRef}
            src={window.niwaAssetUrl(item.src)}
            crossOrigin="anonymous"
            preload="metadata"
            muted
            playsInline
            onLoadedMetadata={onLoaded}
            onTimeUpdate={onTimeUpdate}
          />
          <div className="video-frame-controls">
            <input type="range"
                   min="0" max={duration || 0} step="0.01"
                   value={currentTime}
                   onChange={onSliderChange}
                   disabled={!duration} />
            <div className="video-frame-time">
              <span>{fmt(currentTime)}</span>
              <span>/</span>
              <span>{fmt(duration)}</span>
            </div>
            <button type="button"
                    className="btn btn--accent"
                    onClick={captureFrame}
                    disabled={capturing || !duration}>
              {capturing
                ? (lang === "it" ? "Salvataggio…" : "Saving…")
                : (lang === "it" ? "Cattura questo frame" : "Capture this frame")}
            </button>
          </div>
        </div>

        {/* Destra: anteprima della copertina già salvata */}
        <div className="video-frame-current">
          <div className="video-frame-current-label">
            {lang === "it" ? "Copertina attuale" : "Current cover"}
          </div>
          {frameUrl ? (
            <>
              <img src={window.niwaAssetUrl(frameUrl)} alt="" />
              <button type="button"
                      className="btn btn--ghost"
                      onClick={removeFrame}
                      style={{ marginTop: 8 }}>
                {lang === "it" ? "Rimuovi copertina" : "Remove cover"}
              </button>
            </>
          ) : (
            <div className="video-frame-empty">
              {lang === "it"
                ? "Nessuna copertina personalizzata. Nel carosello verrà mostrato il video in autoplay."
                : "No custom cover. The carousel will show the video on autoplay."}
            </div>
          )}
        </div>
      </div>

      {/* Canvas invisibile, usato solo come buffer per la cattura */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

/* ---- Presets editor (CRUD completo) ----
   La sezione presets non è più solo "reference": l'admin può creare,
   modificare label/valori e disattivare preset. Lo slug "none" è un
   preset di sistema, non eliminabile lato server. */
function AdminPresets() {
  const { lang } = useLang();
  const { presets, order, create, update, remove } = usePresets();
  const { show } = useToast();

  // Bozza locale: sliders e label modificabili, salvataggio onBlur
  const [draft, setDraft] = useState({});
  useEffect(() => {
    setDraft({ ...presets });
  }, [presets]);

  const [newSlug, setNewSlug] = useState("");
  const [newIt, setNewIt]     = useState("");
  const [newEn, setNewEn]     = useState("");
  const [busy, setBusy]       = useState(false);

  const SLIDERS = ["exposure","contrast","saturation","warmth","grain","vignette","fade"];

  const setLabel = (slug, locale, value) => {
    setDraft(d => ({
      ...d,
      [slug]: { ...d[slug], label: { ...(d[slug]?.label || {}), [locale]: value } }
    }));
  };
  const setSlider = (slug, key, value) => {
    setDraft(d => ({ ...d, [slug]: { ...d[slug], [key]: parseInt(value, 10) || 0 } }));
  };

  const saveLabel = async (slug, locale) => {
    const cur = draft[slug]?.label?.[locale];
    const orig = presets[slug]?.label?.[locale];
    if (cur === undefined || cur === orig) return;
    const res = await update(slug, { ['label_' + locale]: cur });
    if (!res.ok) show((lang === "it" ? "Errore: " : "Error: ") + (res.error || "server_error"));
  };

  const saveSlider = async (slug, key) => {
    const cur = draft[slug]?.[key];
    const orig = presets[slug]?.[key];
    if (cur === undefined || cur === orig) return;
    const res = await update(slug, { [key]: cur });
    if (!res.ok) show((lang === "it" ? "Errore: " : "Error: ") + (res.error || "server_error"));
  };

  const removePreset = async (slug) => {
    if (slug === "none") {
      show(lang === "it" ? "Non è possibile rimuovere il preset di sistema" : "Cannot remove system preset");
      return;
    }
    if (!confirm(lang === "it" ? "Rimuovere questo preset?" : "Remove this preset?")) return;
    const res = await remove(slug);
    if (!res.ok) {
      show((lang === "it" ? "Errore: " : "Error: ") + (res.error || "server_error"));
    } else {
      show(lang === "it" ? "Preset rimosso" : "Preset removed");
    }
  };

  const addPreset = async () => {
    const slug = newSlug.trim().toLowerCase().replace(/\s+/g, "-");
    if (!slug || presets[slug] || busy) return;
    setBusy(true);
    const res = await create({
      slug,
      label_it: newIt || slug,
      label_en: newEn || slug,
      exposure: 0, contrast: 0, saturation: 0, warmth: 0,
      grain: 0, vignette: 0, fade: 0,
    });
    setBusy(false);
    if (!res.ok) {
      show((lang === "it" ? "Errore: " : "Error: ") + (res.error || "server_error"));
      return;
    }
    setNewSlug(""); setNewIt(""); setNewEn("");
    show(lang === "it" ? "Preset aggiunto" : "Preset added");
  };

  return (
    <>
      <div className="admin-card">
        <h3>Presets</h3>
        <p style={{ fontSize: 13, color: "var(--fg-soft)", margin: "0 0 16px" }}>
          {lang === "it"
            ? "I preset definiscono il look di base. Modifica le etichette e i valori (intervallo da -100 a +100). Le modifiche vengono salvate sul server quando esci dal campo."
            : "Presets define the base look. Edit labels and values (range -100..+100). Changes are saved to the server on blur."}
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          {(order.length ? order : Object.keys(presets)).map(slug => {
            const p = draft[slug] || presets[slug];
            if (!p) return null;
            const filterStr = window.niwaFilterStr(p);
            return (
              <div key={slug} style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr auto",
                gap: 14, alignItems: "start",
                padding: 12, border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)", background: "var(--bg-soft)"
              }}>
                <div style={{ width: 70, height: 70, borderRadius: 6, background: "var(--bg-sunken)", overflow: "hidden", position: "relative" }}>
                     <img src={window.niwaAssetUrl("https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=200&q=70")}
                       alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: filterStr }} />
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", padding: "2px 6px", background: "var(--bg-sunken)", borderRadius: 4 }}>{slug}</span>
                    <input style={{ fontSize: 13, padding: "4px 8px", flex: 1 }}
                           value={p.label?.it ?? ""}
                           onChange={(e) => setLabel(slug, "it", e.target.value)}
                           onBlur={() => saveLabel(slug, "it")}
                           placeholder="IT" />
                    <input style={{ fontSize: 13, padding: "4px 8px", flex: 1 }}
                           value={p.label?.en ?? ""}
                           onChange={(e) => setLabel(slug, "en", e.target.value)}
                           onBlur={() => saveLabel(slug, "en")}
                           placeholder="EN" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
                    {SLIDERS.map(k => (
                      <div key={k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <label style={{ fontSize: 10, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</label>
                        <input type="number" min={-100} max={100} step={1}
                               value={p[k] ?? 0}
                               onChange={(e) => setSlider(slug, k, e.target.value)}
                               onBlur={() => saveSlider(slug, k)}
                               style={{ fontSize: 12, padding: "4px 6px", fontFamily: "var(--font-mono)" }} />
                      </div>
                    ))}
                  </div>
                </div>
                <button className="icon-btn" onClick={() => removePreset(slug)}
                        disabled={slug === "none"}
                        title={slug === "none" ? "Sistema" : "Delete"}
                        style={{ opacity: slug === "none" ? 0.3 : 1 }}>
                  <Icon.Trash />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-card">
        <h3>{lang === "it" ? "Aggiungi preset" : "Add preset"}</h3>
        <div className="cat-row" style={{ background: "var(--accent-soft)" }}>
          <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)}
                 placeholder="slug (e.g. golden-hour)" disabled={busy} />
          <input value={newIt} onChange={(e) => setNewIt(e.target.value)}
                 placeholder="Etichetta IT" disabled={busy} />
          <input value={newEn} onChange={(e) => setNewEn(e.target.value)}
                 placeholder="EN label" disabled={busy} />
          <button className="icon-btn" onClick={addPreset} disabled={busy}
                  style={{ background: "var(--accent)", color: "var(--accent-fg)" }} title="Add"><Icon.Plus /></button>
        </div>
      </div>
    </>
  );
}

/* ---- Admin: pagina About ----
   Permette di:
   - Caricare/sostituire l'immagine profilo (uploadata in /uploads/photos
     come un media qualsiasi, ma referenziata via key 'about.portrait_url'
     in site_text — non finisce nel portfolio).
   - Tutti gli altri testi About (bio, anno di nascita, ecc.) sono
     gestiti dalla sezione "Testi" che usa la stessa COPY_FIELDS. */
function AdminAbout() {
  const { lang } = useLang();
  const { copy, upsert } = useCopy();
  const { show } = useToast();
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState([]); // ultime foto profilo caricate
  const [loadingHistory, setLoadingHistory] = useState(true);
  const fileInputRef = useRef(null);

  // URL corrente dell'immagine profilo (override).
  const currentUrl = (copy["about.portrait_url"]?.it
                   || copy["about.portrait_url"]?.en
                   || "").trim();

  // Carica la cronologia delle foto profilo dal nuovo endpoint dedicato.
  // Il backend ritorna max 5 record, ordinati dal più recente al più vecchio.
  const reloadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { ok, data } = await window.niwaFetch("/api/admin/profile_history.php");
      if (ok && Array.isArray(data)) {
        setHistory(data);
      } else {
        setHistory([]);
      }
    } catch (_) {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { reloadHistory(); }, [reloadHistory]);

  const onPick = () => fileInputRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      show(lang === "it" ? "Solo immagini consentite" : "Images only");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // 'private' + tag '__profile__' = la foto NON appare nella lista media,
      // ma viene tracciata come foto profilo per la cronologia.
      fd.append("visibility", "private");
      fd.append("tags", "__profile__");
      fd.append("category", "portrait");
      fd.append("preset", "none");
      fd.append("aspect", "tall");
      const res = await fetch("/api/admin/upload.php", {
        method: "POST", credentials: "include", body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "upload_failed"));
        setUploading(false);
        return;
      }
      // Aggiorna l'override testuale sull'immagine attiva.
      const r = await upsert("about.portrait_url", { it: data.src, en: data.src });
      if (!r.ok) {
        show((lang === "it" ? "Errore salvataggio: " : "Save error: ") + (r.error || "server_error"));
      } else {
        show(lang === "it" ? "Immagine aggiornata" : "Image updated");
      }
      // Aggiorna la cronologia (il backend si occupa di tagliare a 5)
      await reloadHistory();
    } catch (err) {
      show(lang === "it" ? "Errore di rete" : "Network error");
    } finally {
      setUploading(false);
    }
  };

  // Seleziona una foto vecchia dalla cronologia come immagine attiva
  const selectFromHistory = async (url) => {
    if (url === currentUrl) return;
    const r = await upsert("about.portrait_url", { it: url, en: url });
    if (!r.ok) {
      show((lang === "it" ? "Errore: " : "Error: ") + (r.error || "server_error"));
    } else {
      show(lang === "it" ? "Immagine selezionata" : "Image selected");
    }
  };

  const removePortrait = async () => {
    if (!confirm(lang === "it" ? "Rimuovere l'immagine personalizzata?" : "Remove custom image?")) return;
    const r = await upsert("about.portrait_url", { it: "", en: "" });
    if (!r.ok) {
      show((lang === "it" ? "Errore: " : "Error: ") + (r.error || "server_error"));
    } else {
      show(lang === "it" ? "Immagine ripristinata al default" : "Image reset to default");
    }
  };

  return (
    <>
      <div className="admin-card">
        <h3>{lang === "it" ? "Immagine profilo" : "Profile image"}</h3>
        <p style={{ fontSize: 13, color: "var(--fg-soft)", margin: "0 0 16px" }}>
          {lang === "it"
            ? "L'immagine mostrata nella pagina 'About'. Le foto profilo non appaiono nel pannello Media o nel portfolio pubblico — sono tracciate solo qui."
            : "Image shown on the 'About' page. Profile images don't appear in the Media panel or public portfolio — they are tracked only here."}
        </p>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{
            width: 180, height: 240,
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            background: "var(--bg-sunken)",
            border: "1px solid var(--border)",
            position: "relative",
            flexShrink: 0
          }}>
            {currentUrl ? (
              <img src={window.niwaAssetUrl(currentUrl)} alt=""
                   style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{
                width: "100%", height: "100%",
                display: "grid", placeItems: "center",
                color: "var(--fg-faint)", fontSize: 12, padding: 16, textAlign: "center"
              }}>
                {lang === "it" ? "Nessuna immagine caricata" : "No image uploaded"}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 200 }}>
            <button className="btn btn--accent"
                    onClick={onPick}
                    disabled={uploading}>
              {uploading
                ? (lang === "it" ? "Caricamento…" : "Uploading…")
                : (currentUrl
                    ? (lang === "it" ? "Sostituisci immagine" : "Replace image")
                    : (lang === "it" ? "Carica immagine" : "Upload image"))}
            </button>
            {currentUrl && (
              <button className="btn btn--ghost" onClick={removePortrait} disabled={uploading}>
                {lang === "it" ? "Rimuovi (usa default)" : "Remove (use default)"}
              </button>
            )}
            <p style={{ fontSize: 12, color: "var(--fg-faint)", margin: 0, lineHeight: 1.5 }}>
              {lang === "it"
                ? "JPG, PNG o WebP. Consigliato: orientamento verticale (es. 900×1200 px). Max 50 MB."
                : "JPG, PNG or WebP. Recommended: portrait orientation (e.g. 900×1200 px). Max 50 MB."}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={onFile}
            />
          </div>
        </div>
      </div>

      {/* Cronologia ultime foto profilo (max 5).
          Cliccando una foto vecchia, la si reimposta come attiva.
          Le foto oltre la 5ª vengono cancellate automaticamente al prossimo
          upload, lato server (in profile_history.php). */}
      <div className="admin-card">
        <h3>{lang === "it" ? "Ultime immagini caricate" : "Recently uploaded"}</h3>
        <p style={{ fontSize: 13, color: "var(--fg-soft)", margin: "0 0 16px" }}>
          {lang === "it"
            ? "Le 5 immagini profilo più recenti. Clicca per riselezionare una versione precedente. Caricando una nuova foto, la più vecchia viene eliminata."
            : "The 5 most recent profile images. Click to reselect a previous version. Uploading a new one removes the oldest."}
        </p>
        {loadingHistory ? (
          <div style={{ color: "var(--fg-faint)", fontSize: 13 }}>
            {lang === "it" ? "Caricamento…" : "Loading…"}
          </div>
        ) : history.length === 0 ? (
          <div style={{ color: "var(--fg-faint)", fontSize: 13 }}>
            {lang === "it" ? "Nessuna immagine in cronologia." : "No images in history yet."}
          </div>
        ) : (
          <div className="profile-history-grid">
            {history.map(h => {
              const isActive = h.src === currentUrl;
              return (
                <button key={h.id_media}
                        className={"profile-history-item " + (isActive ? "is-active" : "")}
                        onClick={() => selectFromHistory(h.src)}
                        title={isActive
                          ? (lang === "it" ? "Attualmente in uso" : "Currently in use")
                          : (lang === "it" ? "Seleziona questa immagine" : "Select this image")}>
                  <img src={window.niwaAssetUrl(h.src)} alt="" />
                  {isActive && (
                    <div className="profile-history-badge">
                      {lang === "it" ? "In uso" : "In use"}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}


/* ---- Admin: eventi ----
   CRUD completo per la timeline della pagina About. Ogni evento ha:
   - date_from (obbligatoria)
   - date_to (opzionale, per range; vuoto = evento di un giorno)
   - traduzioni IT/EN: title, description, tag
   - sort_order, is_active */
function AdminEvents() {
  const { lang } = useLang();
  const { show } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  // Stato del form: null se non si sta editando nulla, oppure i campi
  // dell'evento attualmente in modifica (o "new" per creare).
  const [form, setForm] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await window.niwaFetch("/api/admin/events.php");
      if (r.ok && Array.isArray(r.data)) setItems(r.data);
      else setItems([]);
    } catch (_) { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const blankForm = () => ({
    date_from: "", date_to: "", sort_order: 0, is_active: true,
    title_it: "", title_en: "",
    desc_it: "", desc_en: "",
    tag_it: "", tag_en: "",
  });

  const startCreate = () => { setEditingId("new"); setForm(blankForm()); };
  const startEdit = (ev) => {
    setEditingId(ev.id);
    setForm({
      date_from: ev.date_from || "",
      date_to:   ev.date_to   || "",
      sort_order: ev.sort_order || 0,
      is_active:  !!ev.is_active,
      title_it: ev.title?.it || "", title_en: ev.title?.en || "",
      desc_it:  ev.description?.it || "", desc_en: ev.description?.en || "",
      tag_it:   ev.tag?.it || "", tag_en: ev.tag?.en || "",
    });
  };
  const cancelEdit = () => { setEditingId(null); setForm(null); };

  const save = async () => {
    if (!form.date_from) {
      show(lang === "it" ? "Data inizio obbligatoria" : "Start date required");
      return;
    }
    const body = {
      date_from: form.date_from,
      date_to: form.date_to || null,
      sort_order: parseInt(form.sort_order, 10) || 0,
      is_active: !!form.is_active,
      title_it: form.title_it, title_en: form.title_en,
      desc_it: form.desc_it,   desc_en: form.desc_en,
      tag_it: form.tag_it,     tag_en: form.tag_en,
    };
    const isNew = editingId === "new";
    const url = isNew
      ? "/api/admin/events.php"
      : `/api/admin/events.php?id=${editingId}`;
    try {
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "save_failed"));
        return;
      }
      show(lang === "it" ? "Evento salvato" : "Event saved");
      window.dispatchEvent(new Event("niwa-events-updated"));
      cancelEdit();
      reload();
    } catch (e) {
      show(lang === "it" ? "Errore di rete" : "Network error");
    }
  };

  const remove = async (ev) => {
    const title = ev.title?.[lang] || ev.title?.it || ev.title?.en || `#${ev.id}`;
    const msg = lang === "it"
      ? `Eliminare l'evento "${title}"?`
      : `Delete event "${title}"?`;
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/admin/events.php?id=${ev.id}`, {
        method: "DELETE", credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "delete_failed"));
        return;
      }
      show(lang === "it" ? "Evento eliminato" : "Event deleted");
      window.dispatchEvent(new Event("niwa-events-updated"));
      reload();
    } catch (e) {
      show(lang === "it" ? "Errore di rete" : "Network error");
    }
  };

  return (
    <>
      <div className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            {lang === "it" ? "Eventi della timeline About" : "About timeline events"}
          </h3>
          {!form && (
            <button className="btn btn--accent" onClick={startCreate}>
              {lang === "it" ? "+ Nuovo evento" : "+ New event"}
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, color: "var(--fg-soft)", margin: "0 0 16px" }}>
          {lang === "it"
            ? "Gli eventi appaiono nella sezione 'Il percorso' della pagina About, ordinati dal più recente."
            : "Events appear in the 'Journey' section of the About page, sorted from newest."}
        </p>

        {form && (
          <div className="event-form">
            <div className="field-row">
              <div className="field">
                <label>{lang === "it" ? "Data inizio *" : "Start date *"}</label>
                <input type="date" value={form.date_from}
                       onChange={(e) => setForm({ ...form, date_from: e.target.value })} />
              </div>
              <div className="field">
                <label>{lang === "it" ? "Data fine (opzionale)" : "End date (optional)"}</label>
                <input type="date" value={form.date_to}
                       onChange={(e) => setForm({ ...form, date_to: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>{lang === "it" ? "Titolo IT" : "Title IT"}</label>
                <input type="text" value={form.title_it}
                       onChange={(e) => setForm({ ...form, title_it: e.target.value })} />
              </div>
              <div className="field">
                <label>{lang === "it" ? "Titolo EN" : "Title EN"}</label>
                <input type="text" value={form.title_en}
                       onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>{lang === "it" ? "Descrizione IT" : "Description IT"}</label>
                <textarea rows="2" value={form.desc_it}
                          onChange={(e) => setForm({ ...form, desc_it: e.target.value })}></textarea>
              </div>
              <div className="field">
                <label>{lang === "it" ? "Descrizione EN" : "Description EN"}</label>
                <textarea rows="2" value={form.desc_en}
                          onChange={(e) => setForm({ ...form, desc_en: e.target.value })}></textarea>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>{lang === "it" ? "Tag IT (es. Live, Studio)" : "Tag IT (e.g. Live, Studio)"}</label>
                <input type="text" value={form.tag_it}
                       onChange={(e) => setForm({ ...form, tag_it: e.target.value })} />
              </div>
              <div className="field">
                <label>{lang === "it" ? "Tag EN" : "Tag EN"}</label>
                <input type="text" value={form.tag_en}
                       onChange={(e) => setForm({ ...form, tag_en: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field" style={{ paddingTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 0 }}>
                  <input type="checkbox" checked={form.is_active}
                         onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  {lang === "it" ? "Attivo (visibile sul sito)" : "Active (visible on site)"}
                </label>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn btn--ghost" onClick={cancelEdit}>
                {lang === "it" ? "Annulla" : "Cancel"}
              </button>
              <button className="btn btn--accent" onClick={save}>
                {lang === "it" ? "Salva" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="admin-card">
        <h3>{lang === "it" ? "Tutti gli eventi" : "All events"}</h3>
        {loading ? (
          <div style={{ color: "var(--fg-faint)" }}>
            {lang === "it" ? "Caricamento…" : "Loading…"}
          </div>
        ) : items.length === 0 ? (
          <div style={{ color: "var(--fg-faint)" }}>
            {lang === "it" ? "Nessun evento ancora." : "No events yet."}
          </div>
        ) : (
          <ul className="event-admin-list">
            {items.map(ev => {
              const title = ev.title?.[lang] || ev.title?.it || ev.title?.en || "(?)";
              const date = ev.date_to && ev.date_to !== ev.date_from
                ? `${ev.date_from} → ${ev.date_to}`
                : ev.date_from;
              return (
                <li key={ev.id} className={ev.is_active ? "" : "is-inactive"}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 12, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                      {date}
                      {!ev.is_active && (
                        <span style={{ marginLeft: 12, color: "var(--accent)" }}>
                          {lang === "it" ? "BOZZA" : "DRAFT"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="icon-btn" onClick={() => startEdit(ev)} title={lang === "it" ? "Modifica" : "Edit"}>
                      <Icon.Edit />
                    </button>
                    <button className="icon-btn" onClick={() => remove(ev)} title={lang === "it" ? "Elimina" : "Delete"}>
                      <Icon.Trash />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/* ---- Admin: servizi ----
   Lista di "cosa fa Carmine" mostrata nel meta-strip della About.
   Ogni servizio ha solo un nome in IT/EN. */
function AdminServices() {
  const { lang } = useLang();
  const { show } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await window.niwaFetch("/api/admin/services.php");
      if (r.ok && Array.isArray(r.data)) setItems(r.data);
      else setItems([]);
    } catch (_) { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const blankForm = () => ({ name_it: "", name_en: "", sort_order: 0, is_active: true });
  const startCreate = () => { setEditingId("new"); setForm(blankForm()); };
  const startEdit = (s) => {
    setEditingId(s.id);
    setForm({
      name_it: s.name?.it || "", name_en: s.name?.en || "",
      sort_order: s.sort_order || 0,
      is_active: !!s.is_active,
    });
  };
  const cancelEdit = () => { setEditingId(null); setForm(null); };

  const save = async () => {
    if (!form.name_it.trim() && !form.name_en.trim()) {
      show(lang === "it" ? "Inserisci almeno un nome" : "Enter at least one name");
      return;
    }
    const body = {
      name_it: form.name_it, name_en: form.name_en,
      sort_order: parseInt(form.sort_order, 10) || 0,
      is_active: !!form.is_active,
    };
    const isNew = editingId === "new";
    const url = isNew
      ? "/api/admin/services.php"
      : `/api/admin/services.php?id=${editingId}`;
    try {
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "save_failed"));
        return;
      }
      show(lang === "it" ? "Servizio salvato" : "Service saved");
      window.dispatchEvent(new Event("niwa-services-updated"));
      cancelEdit();
      reload();
    } catch (e) {
      show(lang === "it" ? "Errore di rete" : "Network error");
    }
  };

  const remove = async (s) => {
    const name = s.name?.[lang] || s.name?.it || s.name?.en || `#${s.id}`;
    if (!confirm(lang === "it" ? `Eliminare "${name}"?` : `Delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/services.php?id=${s.id}`, {
        method: "DELETE", credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "delete_failed"));
        return;
      }
      show(lang === "it" ? "Servizio eliminato" : "Service deleted");
      window.dispatchEvent(new Event("niwa-services-updated"));
      reload();
    } catch (e) {
      show(lang === "it" ? "Errore di rete" : "Network error");
    }
  };

  return (
    <>
      <div className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            {lang === "it" ? "Servizi offerti" : "Services offered"}
          </h3>
          {!form && (
            <button className="btn btn--accent" onClick={startCreate}>
              {lang === "it" ? "+ Nuovo servizio" : "+ New service"}
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, color: "var(--fg-soft)", margin: "0 0 16px" }}>
          {lang === "it"
            ? "Mostrati come elenco nella card 'Servizi' della pagina About."
            : "Shown as a list in the 'Services' card of the About page."}
        </p>

        {form && (
          <div className="event-form">
            <div className="field-row">
              <div className="field">
                <label>{lang === "it" ? "Nome IT" : "Name IT"}</label>
                <input type="text" value={form.name_it}
                       placeholder={lang === "it" ? "Es. Servizi fotografici eventi" : "E.g. Event photography"}
                       onChange={(e) => setForm({ ...form, name_it: e.target.value })} />
              </div>
              <div className="field">
                <label>{lang === "it" ? "Nome EN" : "Name EN"}</label>
                <input type="text" value={form.name_en}
                       placeholder="E.g. Event photography"
                       onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field" style={{ maxWidth: 140 }}>
                <label>{lang === "it" ? "Ordine" : "Sort order"}</label>
                <input type="number" value={form.sort_order}
                       onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
              </div>
              <div className="field" style={{ display: "flex", alignItems: "end", paddingBottom: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.is_active}
                         onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  {lang === "it" ? "Attivo (visibile sul sito)" : "Active (visible on site)"}
                </label>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn btn--ghost" onClick={cancelEdit}>
                {lang === "it" ? "Annulla" : "Cancel"}
              </button>
              <button className="btn btn--accent" onClick={save}>
                {lang === "it" ? "Salva" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="admin-card">
        <h3>{lang === "it" ? "Tutti i servizi" : "All services"}</h3>
        {loading ? (
          <div style={{ color: "var(--fg-faint)" }}>
            {lang === "it" ? "Caricamento…" : "Loading…"}
          </div>
        ) : items.length === 0 ? (
          <div style={{ color: "var(--fg-faint)" }}>
            {lang === "it" ? "Nessun servizio ancora." : "No services yet."}
          </div>
        ) : (
          <ul className="event-admin-list">
            {items.map(s => {
              const name = s.name?.[lang] || s.name?.it || s.name?.en || "(?)";
              return (
                <li key={s.id} className={s.is_active ? "" : "is-inactive"}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{name}</div>
                    {!s.is_active && (
                      <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                        {lang === "it" ? "BOZZA" : "DRAFT"}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="icon-btn" onClick={() => startEdit(s)} title={lang === "it" ? "Modifica" : "Edit"}>
                      <Icon.Edit />
                    </button>
                    <button className="icon-btn" onClick={() => remove(s)} title={lang === "it" ? "Elimina" : "Delete"}>
                      <Icon.Trash />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/* ---- Admin: social link della pagina Contatti ----
   CRUD su {label, url, icon, sort_order, is_active}. L'icona può essere
   lasciata vuota: il server la deduce automaticamente dall'URL per i
   social più comuni (Instagram, Facebook, TikTok, YouTube, Twitter,
   LinkedIn, Behance, Vimeo, Pinterest, Telegram, WhatsApp). */
function AdminSocials() {
  const { lang } = useLang();
  const { show } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await window.niwaFetch("/api/admin/social.php");
      if (r.ok && Array.isArray(r.data)) setItems(r.data); else setItems([]);
    } catch (_) { setItems([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const blank = () => ({ label: "", url: "", icon: "", sort_order: 0, is_active: true });
  const startCreate = () => { setEditingId("new"); setForm(blank()); };
  const startEdit   = (s) => {
    setEditingId(s.id);
    setForm({
      label: s.label || "",
      url: s.url || "",
      icon: s.icon || "",
      sort_order: s.sort_order || 0,
      is_active: !!s.is_active,
    });
  };
  const cancelEdit = () => { setEditingId(null); setForm(null); };

  const save = async () => {
    if (!form.label.trim()) {
      show(lang === "it" ? "Etichetta obbligatoria" : "Label required"); return;
    }
    if (!/^https?:\/\//i.test(form.url.trim())) {
      show(lang === "it"
        ? "URL deve iniziare con http:// o https://"
        : "URL must start with http:// or https://");
      return;
    }
    const body = {
      label: form.label.trim(),
      url:   form.url.trim(),
      icon:  form.icon.trim() || null,  // null = auto-detect lato server
      sort_order: parseInt(form.sort_order, 10) || 0,
      is_active: !!form.is_active,
    };
    const isNew = editingId === "new";
    const url   = isNew ? "/api/admin/social.php" : `/api/admin/social.php?id=${editingId}`;
    try {
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "save_failed"));
        return;
      }
      show(lang === "it" ? "Social salvato" : "Social saved");
      window.dispatchEvent(new Event("niwa-socials-updated"));
      cancelEdit(); reload();
    } catch (e) {
      show(lang === "it" ? "Errore di rete" : "Network error");
    }
  };

  const remove = async (s) => {
    if (!confirm(lang === "it" ? `Eliminare "${s.label}"?` : `Delete "${s.label}"?`)) return;
    try {
      const res = await fetch(`/api/admin/social.php?id=${s.id}`, {
        method: "DELETE", credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "delete_failed"));
        return;
      }
      show(lang === "it" ? "Social eliminato" : "Social deleted");
      window.dispatchEvent(new Event("niwa-socials-updated"));
      reload();
    } catch (e) {
      show(lang === "it" ? "Errore di rete" : "Network error");
    }
  };

  return (
    <>
      <div className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            {lang === "it" ? "Profili social (Pagina Contatti)" : "Social profiles (Contact page)"}
          </h3>
          {!form && (
            <button className="btn btn--accent" onClick={startCreate}>
              {lang === "it" ? "+ Nuovo social" : "+ New social"}
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, color: "var(--fg-soft)", margin: "0 0 16px" }}>
          {lang === "it"
            ? "L'icona viene rilevata automaticamente dall'URL per i social più comuni (Instagram, Facebook, TikTok, YouTube, Twitter, LinkedIn, Behance, Vimeo, Pinterest, Telegram, WhatsApp). Lascia il campo 'Icona' vuoto per usare il rilevamento automatico."
            : "The icon is auto-detected from the URL for common socials (Instagram, Facebook, TikTok, YouTube, Twitter, LinkedIn, Behance, Vimeo, Pinterest, Telegram, WhatsApp). Leave the 'Icon' field empty to use auto-detection."}
        </p>

        {form && (
          <div className="event-form">
            <div className="field-row">
              <div className="field">
                <label>{lang === "it" ? "Etichetta visualizzata" : "Display label"}</label>
                <input type="text" value={form.label}
                       placeholder={lang === "it" ? "Es. @niwa.ph" : "E.g. @niwa.ph"}
                       onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="field">
                <label>URL</label>
                <input type="url" value={form.url}
                       placeholder="https://instagram.com/niwa.ph"
                       onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>{lang === "it" ? "Icona (opzionale)" : "Icon (optional)"}</label>
                <select value={form.icon}
                        onChange={(e) => setForm({ ...form, icon: e.target.value })}>
                  <option value="">{lang === "it" ? "Auto (dall'URL)" : "Auto (from URL)"}</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                  <option value="twitter">Twitter / X</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="behance">Behance</option>
                  <option value="vimeo">Vimeo</option>
                  <option value="pinterest">Pinterest</option>
                  <option value="telegram">Telegram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="link">{lang === "it" ? "Link generico" : "Generic link"}</option>
                </select>
              </div>
              <div className="field" style={{ paddingTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 0 }}>
                  <input type="checkbox" checked={form.is_active}
                         onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  {lang === "it" ? "Attivo (visibile sul sito)" : "Active (visible on site)"}
                </label>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn btn--ghost" onClick={cancelEdit}>
                {lang === "it" ? "Annulla" : "Cancel"}
              </button>
              <button className="btn btn--accent" onClick={save}>
                {lang === "it" ? "Salva" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="admin-card">
        <h3>{lang === "it" ? "Tutti i social" : "All socials"}</h3>
        {loading ? (
          <div style={{ color: "var(--fg-faint)" }}>{lang === "it" ? "Caricamento…" : "Loading…"}</div>
        ) : items.length === 0 ? (
          <div style={{ color: "var(--fg-faint)" }}>{lang === "it" ? "Nessun social ancora." : "No socials yet."}</div>
        ) : (
          <ul className="event-admin-list">
            {items.map(s => (
              <li key={s.id} className={s.is_active ? "" : "is-inactive"}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.url}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="icon-btn" onClick={() => startEdit(s)} title={lang === "it" ? "Modifica" : "Edit"}>
                    <Icon.Edit />
                  </button>
                  <button className="icon-btn" onClick={() => remove(s)} title={lang === "it" ? "Elimina" : "Delete"}>
                    <Icon.Trash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ---- Admin: tipi progetto (subject) per il form Contatti ----
   Stesso pattern di AdminServices: solo label IT/EN + flag attivo.
   Le voci appaiono come opzioni del select "Tipo di progetto" sul sito. */
function AdminSubjects() {
  const { lang } = useLang();
  const { show } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await window.niwaFetch("/api/admin/subjects.php");
      if (r.ok && Array.isArray(r.data)) setItems(r.data); else setItems([]);
    } catch (_) { setItems([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const blank = () => ({ label_it: "", label_en: "", is_active: true });
  const startCreate = () => { setEditingId("new"); setForm(blank()); };
  const startEdit = (s) => {
    setEditingId(s.id);
    setForm({
      label_it: s.label?.it || "",
      label_en: s.label?.en || "",
      is_active: !!s.is_active,
    });
  };
  const cancelEdit = () => { setEditingId(null); setForm(null); };

  const save = async () => {
    if (!form.label_it.trim() && !form.label_en.trim()) {
      show(lang === "it" ? "Inserisci almeno un'etichetta" : "Enter at least one label");
      return;
    }
    const body = {
      label_it: form.label_it, label_en: form.label_en,
      is_active: !!form.is_active,
    };
    const isNew = editingId === "new";
    const url   = isNew ? "/api/admin/subjects.php" : `/api/admin/subjects.php?id=${editingId}`;
    try {
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "save_failed"));
        return;
      }
      show(lang === "it" ? "Tipo progetto salvato" : "Project type saved");
      window.dispatchEvent(new Event("niwa-subjects-updated"));
      cancelEdit(); reload();
    } catch (e) {
      show(lang === "it" ? "Errore di rete" : "Network error");
    }
  };

  const remove = async (s) => {
    const name = s.label?.[lang] || s.label?.it || s.label?.en || `#${s.id}`;
    if (!confirm(lang === "it" ? `Eliminare "${name}"?` : `Delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/subjects.php?id=${s.id}`, {
        method: "DELETE", credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "delete_failed"));
        return;
      }
      show(lang === "it" ? "Tipo progetto eliminato" : "Project type deleted");
      window.dispatchEvent(new Event("niwa-subjects-updated"));
      reload();
    } catch (e) {
      show(lang === "it" ? "Errore di rete" : "Network error");
    }
  };

  return (
    <>
      <div className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            {lang === "it" ? "Tipi di progetto (Form Contatti)" : "Project types (Contact form)"}
          </h3>
          {!form && (
            <button className="btn btn--accent" onClick={startCreate}>
              {lang === "it" ? "+ Nuovo tipo" : "+ New type"}
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, color: "var(--fg-soft)", margin: "0 0 16px" }}>
          {lang === "it"
            ? "Voci che appaiono nel menu a tendina 'Tipo di progetto' del form Contatti."
            : "Items that appear in the 'Project type' dropdown of the Contact form."}
        </p>

        {form && (
          <div className="event-form">
            <div className="field-row">
              <div className="field">
                <label>{lang === "it" ? "Etichetta IT" : "Label IT"}</label>
                <input type="text" value={form.label_it}
                       placeholder={lang === "it" ? "Es. Matrimonio o evento" : "E.g. Wedding or event"}
                       onChange={(e) => setForm({ ...form, label_it: e.target.value })} />
              </div>
              <div className="field">
                <label>{lang === "it" ? "Etichetta EN" : "Label EN"}</label>
                <input type="text" value={form.label_en}
                       placeholder="E.g. Wedding or event"
                       onChange={(e) => setForm({ ...form, label_en: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field" style={{ paddingTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 0 }}>
                  <input type="checkbox" checked={form.is_active}
                         onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  {lang === "it" ? "Attivo (visibile sul sito)" : "Active (visible on site)"}
                </label>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn btn--ghost" onClick={cancelEdit}>{lang === "it" ? "Annulla" : "Cancel"}</button>
              <button className="btn btn--accent" onClick={save}>{lang === "it" ? "Salva" : "Save"}</button>
            </div>
          </div>
        )}
      </div>

      <div className="admin-card">
        <h3>{lang === "it" ? "Tutti i tipi" : "All types"}</h3>
        {loading ? (
          <div style={{ color: "var(--fg-faint)" }}>{lang === "it" ? "Caricamento…" : "Loading…"}</div>
        ) : items.length === 0 ? (
          <div style={{ color: "var(--fg-faint)" }}>{lang === "it" ? "Nessun tipo ancora." : "No types yet."}</div>
        ) : (
          <ul className="event-admin-list">
            {items.map(s => {
              const name = s.label?.[lang] || s.label?.it || s.label?.en || "(?)";
              return (
                <li key={s.id} className={s.is_active ? "" : "is-inactive"}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{name}</div>
                    {!s.is_active && (
                      <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                        {lang === "it" ? "BOZZA" : "DRAFT"}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="icon-btn" onClick={() => startEdit(s)} title={lang === "it" ? "Modifica" : "Edit"}>
                      <Icon.Edit />
                    </button>
                    <button className="icon-btn" onClick={() => remove(s)} title={lang === "it" ? "Elimina" : "Delete"}>
                      <Icon.Trash />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/* ---- Contact messages inbox ----
   Mostra i messaggi ricevuti dal form contatti del sito pubblico,
   con filtri per status e azioni di cambio stato / eliminazione. */
function AdminMessages() {
  const { lang } = useLang();
  const { show } = useToast();
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const url = status === "all"
      ? "/api/admin/messages.php"
      : `/api/admin/messages.php?status=${encodeURIComponent(status)}`;
    const { ok, data } = await window.niwaFetch(url);
    if (ok && Array.isArray(data)) setMessages(data);
    setLoading(false);
  }, [status]);

  useEffect(() => { reload(); }, [reload]);

  const setMessageStatus = async (id, newStatus) => {
    const { ok, data } = await window.niwaFetch(`/api/admin/messages.php?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (ok && data?.ok) {
      setMessages(arr => arr.map(m => m.id_message === id ? { ...m, status: newStatus } : m));
    } else {
      show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "server_error"));
    }
  };

  const deleteMessage = async (id) => {
    if (!confirm(lang === "it" ? "Eliminare questo messaggio?" : "Delete this message?")) return;
    const { ok, data } = await window.niwaFetch(`/api/admin/messages.php?id=${id}`, { method: "DELETE" });
    if (ok && data?.ok) {
      setMessages(arr => arr.filter(m => m.id_message !== id));
      if (expanded === id) setExpanded(null);
    } else {
      show((lang === "it" ? "Errore: " : "Error: ") + (data?.error || "server_error"));
    }
  };

  const statusLabels = {
    new:      { it: "Nuovo",     en: "New",      color: "var(--accent)" },
    read:     { it: "Letto",     en: "Read",     color: "var(--fg-soft)" },
    replied:  { it: "Risposto",  en: "Replied",  color: "#16a34a" },
    archived: { it: "Archiviato",en: "Archived", color: "var(--fg-faint)" },
  };

  return (
    <>
      <div className="admin-card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{lang === "it" ? "Messaggi ricevuti" : "Received messages"}</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all","new","read","replied","archived"].map(s => (
              <button key={s}
                      className={"filter-chip " + (status === s ? "is-active" : "")}
                      onClick={() => setStatus(s)}>
                {s === "all"
                  ? (lang === "it" ? "Tutti" : "All")
                  : (statusLabels[s]?.[lang] || s)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="admin-card" style={{ textAlign: "center", color: "var(--fg-soft)" }}>
          {lang === "it" ? "Caricamento…" : "Loading…"}
        </div>
      ) : messages.length === 0 ? (
        <div className="empty-state">
          <h3>{lang === "it" ? "Nessun messaggio" : "No messages"}</h3>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {messages.map(m => {
            const isOpen = expanded === m.id_message;
            const label = statusLabels[m.status] || statusLabels.new;
            return (
              <div key={m.id_message} className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
                <div onClick={() => setExpanded(isOpen ? null : m.id_message)}
                     style={{ padding: 14, cursor: "pointer", display: "grid",
                              gridTemplateColumns: "auto 1fr auto auto",
                              gap: 12, alignItems: "center" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: label.color }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.subject}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 2 }}>
                      {m.name} · {m.email}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                    {new Date(m.created_at.replace(" ", "T")).toLocaleString(lang === "it" ? "it-IT" : "en-US", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                  <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, background: "var(--bg-sunken)", textTransform: "uppercase", letterSpacing: "0.06em", color: label.color }}>
                    {label[lang]}
                  </span>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--border)" }}>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.5, margin: "14px 0", color: "var(--fg)" }}>
                      {m.message}
                    </pre>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <a className="btn btn--ghost" href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`} onClick={(e) => e.stopPropagation()}>
                        {lang === "it" ? "Rispondi" : "Reply"}
                      </a>
                      <select value={m.status}
                              onChange={(e) => { e.stopPropagation(); setMessageStatus(m.id_message, e.target.value); }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ padding: "6px 10px", fontSize: 12 }}>
                        {Object.keys(statusLabels).map(s => (
                          <option key={s} value={s}>{statusLabels[s][lang]}</option>
                        ))}
                      </select>
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); deleteMessage(m.id_message); }} title="Delete">
                        <Icon.Trash />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

Object.assign(window, { AdminPage, useAdminAuth });
