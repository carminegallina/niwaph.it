/* ================================================================
   NIWA.PH — Core hooks: theme, lang, store, router, reveal
   ================================================================ */

const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

/* ---------------- Theme ---------------- */
const ThemeCtx = createContext(null);

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("niwa.theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("niwa.theme", theme);
  }, [theme]);

  // Listen to system changes (only if user hasn't set an explicit preference)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      // Always reflect system unless user has chosen
      const saved = localStorage.getItem("niwa.theme.user");
      if (!saved) setTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = useCallback(() => {
    setTheme(t => {
      const next = t === "light" ? "dark" : "light";
      localStorage.setItem("niwa.theme.user", "1");
      return next;
    });
  }, []);

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

function useTheme() { return useContext(ThemeCtx); }

/* ---------------- Lang ---------------- */
const LangCtx = createContext(null);

function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem("niwa.lang");
    if (saved === "it" || saved === "en") return saved;
    return navigator.language.startsWith("it") ? "it" : "en";
  });

  // copyVersion: contatore bumpato ogni volta che il CopyProvider ha
  // applicato testi nuovi a window.NIWA_I18N. Serve solo come dipendenza
  // di t() per forzare il re-render dei consumer quando i testi del DB
  // arrivano DOPO il primo render (caso comune con fetch async).
  // Senza questo, t("home.featured") restituisce il default di data.js
  // finché l'utente non triggera manualmente un re-render (es. cambio lingua).
  const [copyVersion, setCopyVersion] = useState(0);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("niwa.lang", lang);
  }, [lang]);

  useEffect(() => {
    // Listener globale: il CopyProvider emette 'niwa-copy-updated' ogni volta
    // che aggiorna window.NIWA_I18N (sia al reload iniziale, sia dopo upsert
    // da admin). Usiamo un evento window perché LangProvider è SOPRA
    // CopyProvider nella gerarchia e non può quindi consumare il context.
    const onCopy = () => setCopyVersion(v => v + 1);
    window.addEventListener("niwa-copy-updated", onCopy);
    return () => window.removeEventListener("niwa-copy-updated", onCopy);
  }, []);

  const toggle = useCallback(() => setLang(l => l === "it" ? "en" : "it"), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // copyVersion è usata SOLO come dipendenza per forzare il re-render:
  // non viene letta nel corpo di t(), ma la sua presenza fa sì che t()
  // riferisca una nuova identità funzione ogni volta che i testi cambiano.
  const t = useCallback((path) => {
    const parts = path.split(".");
    let cur = window.NIWA_I18N[lang];
    for (const p of parts) {
      if (cur == null) return path;
      cur = cur[p];
    }
    return cur ?? path;
  }, [lang, copyVersion]);

  return <LangCtx.Provider value={{ lang, setLang, toggle, t }}>{children}</LangCtx.Provider>;
}

function useLang() { return useContext(LangCtx); }

/* ---------------- API base ---------------- */
const NIWA_API = "/api";

// Helper fetch: gestisce JSON e include i cookie per le richieste autenticate.
async function niwaFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, data };
}

window.niwaFetch = niwaFetch;

// niwaAssetUrl è definita in data.js per essere disponibile sincronamente
// prima che qualsiasi componente React provi a usarla.

/* ---------------- Store ----------------
 * I media vivono nel DB. Il client li carica da GET /api/media.php
 * (sito pubblico) e da GET /api/admin/media.php (admin, vede anche draft/private).
 *
 * Le operazioni di mutazione passano per gli endpoint admin protetti.
 * Manteniamo gli aggiornamenti ottimistici per non bloccare l'UI:
 * se la chiamata server fallisce, la modifica viene rollbackata.
 *
 * Resta esposto un campo `loading` per la prima fetch e `error` se la
 * richiesta iniziale fallisce.
 */
const StoreCtx = createContext(null);

function StoreProvider({ children }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Quando l'admin entra, ricarica la lista estesa (con draft/private).
  const [adminMode, setAdminMode] = useState(false);

  const reload = useCallback(async (mode) => {
    const useAdmin = mode === "admin";
    setLoading(true);
    setError(null);
    try {
      const url = useAdmin ? `${NIWA_API}/admin/media.php` : `${NIWA_API}/media.php`;
      const { ok, data } = await niwaFetch(url);
      if (ok && Array.isArray(data)) {
        // Array vuoto è un risultato VALIDO: significa "il DB non ha media".
        // Mostriamo davvero la lista vuota — niente seed di Unsplash di
        // riserva, perché il sito è in produzione e le foto demo
        // confonderebbero (sembrerebbero le foto reali del fotografo).
        setMedia(data);
      } else {
        // Risposta non valida (server giù, errore PHP): lista vuota + flag.
        // L'utente vede "nessuna foto" invece di foto demo finte.
        setMedia([]);
        setError(useAdmin ? "server_error" : "offline");
      }
    } catch (e) {
      // Errore di rete (server irraggiungibile, CORS, etc.): idem
      setMedia([]);
      setError("network_error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(adminMode ? "admin" : "public"); }, [adminMode, reload]);

  // Listener: l'admin ha modificato qualcosa che riguarda i media
  // (es. ha catturato una nuova copertina carosello da un video).
  // Ri-fetchiamo la lista così l'UI si aggiorna senza refresh manuale.
  useEffect(() => {
    const onUpdate = () => reload(adminMode ? "admin" : "public");
    window.addEventListener("niwa-media-updated", onUpdate);
    return () => window.removeEventListener("niwa-media-updated", onUpdate);
  }, [adminMode, reload]);

  // ---- Mutazioni ----

  // addMedia richiede un oggetto già "completo" (tipicamente arriva da upload.php).
  const addMedia = useCallback(async (item) => {
    // Caso 1: l'oggetto contiene già un id_media (es. ritornato da upload.php)
    //          → inseriamo direttamente in lista (l'upload ha già scritto su DB).
    if (item && item.id_media) {
      setMedia(arr => [item, ...arr]);
      return { ok: true, item };
    }
    // Caso 2: chiamata diretta (creazione "vuota") → POST /api/admin/media.php
    const body = {
      type: "photo",
      category: "nature",
      preset: "niwa",
      aspect: "sq",
      visibility: "draft",
      title: { it: "", en: "" },
      desc:  { it: "", en: "" },
      tags: [],
      adj: {},
      ...item,
    };
    const { ok, data } = await niwaFetch(`${NIWA_API}/admin/media.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!ok || !data?.ok) return { ok: false, error: data?.error || "server_error" };
    const newItem = { ...body, id: data.id, id_media: data.id_media };
    setMedia(arr => [newItem, ...arr]);
    return { ok: true, item: newItem };
  }, []);

  const updateMedia = useCallback(async (id, patch) => {
    // id locale es. "m42" → id_media=42; oppure passato direttamente come numero
    const target = media.find(m => m.id === id) || media.find(m => m.id_media === id);
    if (!target) return { ok: false, error: "not_found" };
    const idMedia = target.id_media || (typeof id === "string" && id.startsWith("m")
      ? parseInt(id.slice(1), 10) : null);
    if (!idMedia) return { ok: false, error: "not_persisted" };

    // Optimistic update
    const prev = target;
    setMedia(arr => arr.map(m => (m.id === target.id ? { ...m, ...patch } : m)));

    const { ok, data } = await niwaFetch(
      `${NIWA_API}/admin/media.php?id=${idMedia}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    if (!ok || !data?.ok) {
      // Rollback
      setMedia(arr => arr.map(m => (m.id === target.id ? prev : m)));
      return { ok: false, error: data?.error || "server_error" };
    }
    return { ok: true };
  }, [media]);

  const removeMedia = useCallback(async (id) => {
    const target = media.find(m => m.id === id) || media.find(m => m.id_media === id);
    if (!target) return { ok: false, error: "not_found" };
    const idMedia = target.id_media || (typeof id === "string" && id.startsWith("m")
      ? parseInt(id.slice(1), 10) : null);
    if (!idMedia) {
      // Item non ancora persistito (improbabile col nuovo flusso): rimuovi e basta
      setMedia(arr => arr.filter(m => m.id !== target.id));
      return { ok: true };
    }
    const prev = media;
    setMedia(arr => arr.filter(m => m.id !== target.id));

    const { ok, data } = await niwaFetch(
      `${NIWA_API}/admin/media.php?id=${idMedia}`,
      { method: "DELETE" }
    );
    if (!ok || !data?.ok) {
      setMedia(prev);
      return { ok: false, error: data?.error || "server_error" };
    }
    return { ok: true };
  }, [media]);

  // resetSeed mantenuto per compatibilità: ricarica dalla sorgente attiva
  const resetSeed = useCallback(() => {
    reload(adminMode ? "admin" : "public");
  }, [reload, adminMode]);

  const ctx = {
    media, loading, error,
    addMedia, updateMedia, removeMedia, resetSeed, reload,
    setAdminMode,
  };
  return <StoreCtx.Provider value={ctx}>{children}</StoreCtx.Provider>;
}

function useStore() { return useContext(StoreCtx); }

/* ---------------- Categories provider ----------------
 * Carica le categorie dal DB via GET /api/categories.php e popola
 * window.NIWA_CATEGORIES per mantenere la compatibilità col codice
 * esistente che lo usa direttamente. Espone anche metodi di
 * mutazione che chiamano l'endpoint admin protetto.
 */
const CategoriesCtx = createContext(null);

function CategoriesProvider({ children }) {
  // Inizializzo con il seed di data.js per evitare flash di contenuto vuoto
  const [cats, setCats] = useState(() => ({ ...(window.NIWA_CATEGORIES || {}) }));
  const [bumpKey, setBumpKey] = useState(0);

  const reload = useCallback(async () => {
    const { ok, data } = await niwaFetch(`${NIWA_API}/categories.php`);
    if (ok && data && typeof data === "object") {
      // Sostituisce TUTTO il contenuto di window.NIWA_CATEGORIES, mantenendo
      // il riferimento (alcuni componenti lo leggono direttamente).
      Object.keys(window.NIWA_CATEGORIES).forEach(k => { delete window.NIWA_CATEGORIES[k]; });
      Object.assign(window.NIWA_CATEGORIES, data);
      setCats({ ...data });
      setBumpKey(b => b + 1);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (slug, it, en, sortOrder = 0) => {
    const { ok, data } = await niwaFetch(`${NIWA_API}/admin/categories.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, it, en, sort_order: sortOrder }),
    });
    if (ok && data?.ok) await reload();
    return { ok: ok && data?.ok, error: data?.error };
  }, [reload]);

  const update = useCallback(async (slug, patch) => {
    const { ok, data } = await niwaFetch(
      `${NIWA_API}/admin/categories.php?slug=${encodeURIComponent(slug)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    if (ok && data?.ok) await reload();
    return { ok: ok && data?.ok, error: data?.error };
  }, [reload]);

  const remove = useCallback(async (slug) => {
    const { ok, data } = await niwaFetch(
      `${NIWA_API}/admin/categories.php?slug=${encodeURIComponent(slug)}`,
      { method: "DELETE" }
    );
    if (ok && data?.ok) await reload();
    return { ok: ok && data?.ok, error: data?.error };
  }, [reload]);

  return (
    <CategoriesCtx.Provider value={{ cats, bumpKey, reload, create, update, remove }}>
      {children}
    </CategoriesCtx.Provider>
  );
}
function useCategories() { return useContext(CategoriesCtx); }

/* ---------------- Presets provider ---------------- */
const PresetsCtx = createContext(null);

function PresetsProvider({ children }) {
  const [presets, setPresets] = useState(() => ({ ...(window.NIWA_PRESETS || {}) }));
  const [order, setOrder]     = useState(() => [...(window.NIWA_PRESET_KEYS || [])]);

  const reload = useCallback(async () => {
    const { ok, data } = await niwaFetch(`${NIWA_API}/presets.php`);
    if (ok && data?.presets) {
      // Sostituisce window.NIWA_PRESETS in-place
      Object.keys(window.NIWA_PRESETS).forEach(k => { delete window.NIWA_PRESETS[k]; });
      Object.assign(window.NIWA_PRESETS, data.presets);
      window.NIWA_PRESET_KEYS.length = 0;
      (data.order || Object.keys(data.presets)).forEach(k => window.NIWA_PRESET_KEYS.push(k));
      setPresets({ ...data.presets });
      setOrder([...window.NIWA_PRESET_KEYS]);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (payload) => {
    const { ok, data } = await niwaFetch(`${NIWA_API}/admin/presets.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (ok && data?.ok) await reload();
    return { ok: ok && data?.ok, error: data?.error };
  }, [reload]);

  const update = useCallback(async (slug, patch) => {
    const { ok, data } = await niwaFetch(
      `${NIWA_API}/admin/presets.php?slug=${encodeURIComponent(slug)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    if (ok && data?.ok) await reload();
    return { ok: ok && data?.ok, error: data?.error };
  }, [reload]);

  const remove = useCallback(async (slug) => {
    const { ok, data } = await niwaFetch(
      `${NIWA_API}/admin/presets.php?slug=${encodeURIComponent(slug)}`,
      { method: "DELETE" }
    );
    if (ok && data?.ok) await reload();
    return { ok: ok && data?.ok, error: data?.error };
  }, [reload]);

  return (
    <PresetsCtx.Provider value={{ presets, order, reload, create, update, remove }}>
      {children}
    </PresetsCtx.Provider>
  );
}
function usePresets() { return useContext(PresetsCtx); }

/* ---------------- Site copy (testi del sito) ----------------
 * Carica gli override testuali dal DB e li applica a window.NIWA_I18N
 * (replicando l'effetto del vecchio niwa.copy.v1 ma da DB). Espone metodi
 * di mutazione che parlano con /api/admin/site_text.php.
 */
const CopyCtx = createContext(null);

function CopyProvider({ children }) {
  const [copy, setCopy] = useState({}); // { "key.path": {it,en} }
  const [bumpKey, setBumpKey] = useState(0);

  const applyToI18n = useCallback((overrides) => {
    Object.entries(overrides).forEach(([keyPath, langs]) => {
      const parts = keyPath.split(".");
      ["it", "en"].forEach(lang => {
        if (langs[lang] === undefined) return;
        let cur = window.NIWA_I18N[lang];
        for (let i = 0; i < parts.length - 1; i++) {
          if (cur[parts[i]] == null) cur[parts[i]] = {};
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = langs[lang];
      });
    });
  }, []);

  const reload = useCallback(async () => {
    const { ok, data } = await niwaFetch(`${NIWA_API}/site_text.php`);
    if (ok && data && typeof data === "object") {
      applyToI18n(data);
      setCopy(data);
      setBumpKey(b => b + 1);
      // Notifica i consumer di useLang().t che i testi di window.NIWA_I18N
      // sono cambiati. Senza questo evento, i componenti che usano t(...)
      // resterebbero con i default di data.js finché l'utente non forza
      // un re-render (es. cambia lingua).
      window.dispatchEvent(new Event("niwa-copy-updated"));
    }
  }, [applyToI18n]);

  useEffect(() => { reload(); }, [reload]);

  const upsert = useCallback(async (keyPath, langs) => {
    const { ok, data } = await niwaFetch(
      `${NIWA_API}/admin/site_text.php?key=${encodeURIComponent(keyPath)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(langs),
      }
    );
    if (ok && data?.ok) {
      // Aggiorna localmente senza ricaricare tutto
      setCopy(c => {
        const next = { ...c, [keyPath]: { ...(c[keyPath] || {}), ...langs } };
        applyToI18n({ [keyPath]: next[keyPath] });
        return next;
      });
      setBumpKey(b => b + 1);
      window.dispatchEvent(new Event("niwa-copy-updated"));
    }
    return { ok: ok && data?.ok, error: data?.error };
  }, [applyToI18n]);

  return (
    <CopyCtx.Provider value={{ copy, bumpKey, reload, upsert }}>
      {children}
    </CopyCtx.Provider>
  );
}
function useCopy() { return useContext(CopyCtx); }

/* ---------------- Router (hash-based) ---------------- */
const RouterCtx = createContext(null);

function RouterProvider({ children }) {
  const [route, setRoute] = useState(() => {
    const h = window.location.hash.replace("#", "") || "home";
    return h;
  });

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace("#", "") || "home";
      setRoute(h);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((to) => {
    window.location.hash = to;
  }, []);

  return <RouterCtx.Provider value={{ route, go }}>{children}</RouterCtx.Provider>;
}

function useRouter() { return useContext(RouterCtx); }

/* ---------------- Toast ---------------- */
const ToastCtx = createContext(null);
function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);

  const show = useCallback((m) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2400);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className={"toast " + (msg ? "is-visible" : "")}>{msg}</div>
    </ToastCtx.Provider>
  );
}
function useToast() { return useContext(ToastCtx); }

/* ---------------- Scroll-reveal hook ---------------- */
function useReveal(deps = []) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    el.querySelectorAll(".reveal").forEach(n => io.observe(n));
    return () => io.disconnect();
  }, deps);
  return ref;
}

/* ---------------- Tiny icon set ---------------- */
const Icon = {
  Sun: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  Moon: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Close: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  Plus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  Arrow: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>,
  ChevR: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>,
  ChevL: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6"/></svg>,
  Play: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>,
  Camera: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Upload: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>,
  Edit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Mail: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>,
  Instagram: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01"/></svg>,
  Pin: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Burger: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
  Grid: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Mosaic: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="6" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  // Social icons aggiuntive — usate dinamicamente sulla pagina Contatti
  // tramite SOCIAL_ICONS map. Tutte stile lineare 1.6, 14×14.
  Facebook:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
  TikTok:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>,
  YouTube:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>,
  Twitter:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l7.5 10L4.5 20H7l5.5-5.5L17 20h3L12 9.5 19 4h-2.5L12 8 8 4z"/></svg>,
  LinkedIn:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>,
  Behance:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h6a3 3 0 0 1 0 6H3zM3 11h7a3 3 0 0 1 0 6H3zM14 7h6M14 13a3 3 0 0 1 6 0h-6a3 3 0 0 0 6 0"/></svg>,
  Vimeo:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7c1-1 3-2 4-2 2 0 2 2 2 4l1 6c0 1 1 1 2 0 2-2 4-6 4-9 0-2-1-3-3-2"/></svg>,
  Pinterest: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l-2 8M9 14a3 3 0 1 0 6 0 3 3 0 0 0-6 0z"/></svg>,
  Telegram:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L2 11l7 3 3 7 4-5 6 4z"/><path d="M9 14l9-7"/></svg>,
  WhatsApp:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z"/><path d="M8 9c0 4 3 7 7 7l2-2-3-2-2 2c-1 0-3-2-3-3l2-2-2-3z"/></svg>,
  // Fallback generico per url custom (catena di link)
  Link:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/></svg>
};

// Helper: localized text from {it, en}
function localized(obj, lang) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[lang] || obj.it || obj.en || "";
}

// Expose to window for cross-script use
Object.assign(window, {
  ThemeProvider, useTheme,
  LangProvider, useLang,
  StoreProvider, useStore,
  CategoriesProvider, useCategories,
  PresetsProvider, usePresets,
  CopyProvider, useCopy,
  RouterProvider, useRouter,
  ToastProvider, useToast,
  useReveal, Icon, localized,
  useState, useEffect, useRef, useMemo, useCallback
});
