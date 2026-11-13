/* ================================================================
   NIWA.PH — Pages: Home, Photos, Videos, About, Contact
   ================================================================ */

/* ---------------- Intro animation ---------------- */
function Intro({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2400);
    const t2 = setTimeout(() => onDone(), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const word = "Niwa.ph";
  return (
    <div className={"intro " + (leaving ? "is-leaving" : "")}>
      {/* Layout verticale: logo sopra, scritta sotto. Non più
          absolute positioning relativo al cerchio — così su qualsiasi
          viewport la scritta è in un proprio "slot" sotto il logo,
          senza rischio di sovrapposizione anche quando il cerchio
          fa l'animazione di scala. */}
      <div className="intro-content">
        <div className="intro-stage">
          <div className="intro-ring"></div>
          <div className="intro-ring"></div>
          <div className="intro-ring"></div>
          <div className="intro-logo">
            <img src="assets/logo.jpg" alt="" />
          </div>
        </div>
        <div className="intro-word">
          {word.split("").map((c, i) => (
            <span key={i} style={{ animationDelay: 0.6 + i * 0.06 + "s" }}>
              {c === "." ? <span className="intro-word-dot">.</span> : c}
            </span>
          ))}
        </div>
        <div className="intro-tag">Visual Storytelling · 2026</div>
      </div>
    </div>
  );
}

/* ---------------- Home ---------------- */
/* ---------------- Hook viewport profile ----------------
   Determina che tipo di schermo sta visualizzando il sito.
   Usato dal carosello per scegliere foto adatte:
   - "mobile-portrait": telefoni tenuti verticali → preferiamo foto verticali
   - "wide": tutto il resto (desktop, tablet, telefono in landscape) → orizzontali
   Si aggiorna automaticamente su resize/orientationchange. */
function useViewportProfile() {
  const [profile, setProfile] = useState(() => {
    if (typeof window === "undefined") return "wide";
    return window.innerWidth <= 768 && window.innerHeight > window.innerWidth
      ? "mobile-portrait"
      : "wide";
  });

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      const p = window.innerWidth <= 768 && window.innerHeight > window.innerWidth
        ? "mobile-portrait"
        : "wide";
      setProfile(prev => (prev === p ? prev : p));
    };
    // Throttle via requestAnimationFrame per evitare re-render furiosi su resize
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  return profile;
}

function HomeCarousel({ slides, onSlideClick }) {
  const [idx, setIdx] = useState(0);
  const { lang } = useLang();

  // Quando l'insieme di slide cambia (perché il viewport ha cambiato profilo
  // e ne ho scelto un sottoinsieme diverso), ripartiamo dalla prima.
  useEffect(() => { setIdx(0); }, [slides.length, slides[0]?.id]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => {
      setIdx(i => (i + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) return null;

  // Click sulla slide attiva → apre lightbox (se onSlideClick è fornito).
  // Uso un button overlay per accessibilità (focus/keyboard).
  const handleClick = () => {
    if (onSlideClick && slides[idx]) onSlideClick(slides[idx].id);
  };

  return (
    <div className="hero-carousel">
      <div className="hero-carousel-stage">
        {slides.map((s, i) => {
          const filter = window.niwaFilterStr({ ...window.NIWA_PRESETS[s.preset || "none"], ...s.adj });
          // Se è un video MA l'admin ha impostato un frame copertina,
          // mostriamo l'immagine statica al posto del video animato.
          // Questo permette di scegliere un fotogramma specifico
          // significativo invece di un video in loop autoplay.
          const showAsImage = s.type === "video" && s.carousel_frame_url;
          const isActive = i === idx;
          const isFirstSlide = i === 0;
          // Loading hint: la prima slide è priority (entra subito in view);
          // le altre lazy così non bloccano il render iniziale.
          const imgLoading = isFirstSlide ? "eager" : "lazy";
          const imgPriority = isFirstSlide ? "high" : "auto";
          return (
            <div key={s.id} className={"hero-slide " + (isActive ? "is-active" : "")}>
              {showAsImage ? (
                <img src={window.niwaAssetUrl(s.carousel_frame_url)}
                     alt=""
                     loading={imgLoading}
                     fetchpriority={imgPriority}
                     decoding="async"
                     style={{ filter }} />
              ) : s.type === "video" ? (
                <video src={window.niwaAssetUrl(s.src)}
                       poster={window.niwaAssetUrl(s.poster)}
                       muted loop autoPlay
                       playsInline
                       preload={isFirstSlide ? "auto" : "metadata"}
                       style={{ filter }} />
              ) : (
                <img src={window.niwaAssetUrl(s.src)}
                     alt=""
                     loading={imgLoading}
                     fetchpriority={imgPriority}
                     decoding="async"
                     style={{ filter }} />
              )}
            </div>
          );
        })}
      </div>
      {onSlideClick && (
        <button
          type="button"
          className="hero-carousel-click"
          onClick={handleClick}
          aria-label={lang === "it" ? "Apri anteprima" : "Open preview"}
        />
      )}
      <div className="hero-overlay" />

      <div className="hero-corner">
        <div className="eyebrow">Niwa.ph</div>
        <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", opacity: 0.85 }}>
          {String(idx + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </div>
      </div>

      <div className="hero-caption">
        <div>
          {(() => {
            const s = slides[idx];
            const cat = window.NIWA_CATEGORIES[s.category]?.[lang] || "";
            const title = localized(s.title, lang);
            return (
              <>
                {cat && <span className="hero-caption-cat">{cat}</span>}
                {title && <h2 className="hero-caption-title">{title}</h2>}
              </>
            );
          })()}
        </div>
        <div className="hero-bullets">
          {slides.map((_, i) => (
            <button key={i}
                    className={"hero-bullet " + (i === idx ? "is-active" : "")}
                    onClick={() => setIdx(i)}
                    aria-label={"slide " + (i + 1)}>
              <span className="hero-bullet-progress" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── EventsDiary ───────────────────────────────────────────────────────
   Lista di eventi paginata "a diario": mostra `perPage` eventi alla volta,
   con frecce sx/dx e indicatore di pagina centrale. Le transizioni tra
   pagine usano un fade + slide orizzontale (entrata da destra quando si va
   avanti, da sinistra quando si va indietro): semplice, leggera, non blocca
   il rendering anche su connessioni lente.

   Touch support: swipe orizzontale (>=40px) cambia pagina.

   Comportamento:
   - Se ci sono ≤ perPage eventi non mostriamo i controlli (tutto in 1 pagina).
   - Se l'array cambia (admin aggiunge un evento), si reset alla pagina 0
     se l'attuale è ormai fuori range.
*/
function EventsDiary({ events, formatDate, localizedField, perPage = 3, lang }) {
  const totalPages = Math.max(1, Math.ceil(events.length / perPage));
  const [page, setPage]         = useState(0);
  // direction: 1 = next, -1 = prev. Usato per scegliere la direzione
  // dell'animazione di slide tra pagine (entrata da dx o da sx).
  const [direction, setDirection] = useState(1);
  // Forziamo rimount del contenuto pagina ad ogni cambio: la classe
  // diary-page-enter applica un fade+slide CSS che parte da 0.
  const [animKey, setAnimKey] = useState(0);

  // Se l'array eventi si accorcia (admin elimina), tornare in range
  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [totalPages, page]);

  const goTo = (newPage) => {
    if (newPage < 0 || newPage >= totalPages || newPage === page) return;
    setDirection(newPage > page ? 1 : -1);
    setPage(newPage);
    setAnimKey(k => k + 1);
  };

  const next = () => goTo(page + 1);
  const prev = () => goTo(page - 1);

  // Touch swipe semplice
  const touchStartX = useRef(0);
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next();
      else        prev();
    }
  };

  const slice = events.slice(page * perPage, page * perPage + perPage);

  return (
    <div className="events-diary"
         onTouchStart={onTouchStart}
         onTouchEnd={onTouchEnd}>
      <div className={"events-diary-page " + (direction > 0 ? "is-from-right" : "is-from-left")}
           key={animKey}>
        {slice.map((ev) => {
          const title = localizedField(ev, "title");
          const desc  = localizedField(ev, "description");
          const tag   = localizedField(ev, "tag");
          return (
            <div className="diary-entry" key={ev.id}>
              <div className="diary-entry-body">
                <div className="diary-entry-title">{title}</div>
                {desc && <div className="diary-entry-desc">{desc}</div>}
                {tag  && <div className="diary-entry-tag">{tag}</div>}
              </div>
              <div className="diary-entry-date">{formatDate(ev.date_from, ev.date_to)}</div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="events-diary-controls">
          <button type="button"
                  className="diary-nav-btn"
                  onClick={prev}
                  disabled={page === 0}
                  aria-label={lang === "it" ? "Pagina precedente" : "Previous page"}>
            <Icon.ChevL />
          </button>
          <div className="events-diary-indicator">
            {/* Pallini cliccabili — visualizzano il progresso e permettono salto rapido */}
            {Array.from({ length: totalPages }).map((_, i) => (
              <button key={i} type="button"
                      className={"diary-dot " + (i === page ? "is-active" : "")}
                      onClick={() => goTo(i)}
                      aria-label={(lang === "it" ? "Pagina " : "Page ") + (i + 1)} />
            ))}
            <span className="diary-counter">
              {page + 1} / {totalPages}
            </span>
          </div>
          <button type="button"
                  className="diary-nav-btn"
                  onClick={next}
                  disabled={page === totalPages - 1}
                  aria-label={lang === "it" ? "Pagina successiva" : "Next page"}>
            <Icon.ChevR />
          </button>
        </div>
      )}
    </div>
  );
}

function HomePage() {
  const { t, lang } = useLang();
  const { go } = useRouter();
  const { media } = useStore();
  // Stato eventi: dichiarato qui in alto per poterlo usare come
  // dipendenza di useReveal (così le righe della timeline diventano
  // visibili appena il fetch torna).
  const [events, setEvents] = useState([]);
  const [refetchTick, setRefetchTick] = useState(0);
  const ref = useReveal([media.length, lang, events.length]);
  // Stato di autenticazione admin: il bottone "Admin" appare nella home
  // solo se l'utente è già loggato (cookie di sessione valido).
  // useAdminAuth è esposto da app-admin.jsx tramite window.
  const { authed } = (window.useAdminAuth ? window.useAdminAuth() : { authed: false });

  const birthYearStr = (t("about.birth_year") || "").trim();
  const birthYear = parseInt(birthYearStr, 10) || 1999;

  const age = useMemo(() => {
    const now = new Date();
    const birth = new Date(birthYear, 11, 29);
    let a = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) a--;
    return a;
  }, [birthYear]);

  // Anni di attività: calcolati da (anno corrente - anno 'attivo dal' impostato
  // dall'admin nei testi, key 'about.since_year'). Se non valido, fallback a 5.
  const sinceYearStrHome = (t("about.since_year") || "").trim();
  const sinceYearHome = parseInt(sinceYearStrHome, 10);
  const yearsActive = useMemo(() => {
    if (!sinceYearHome || isNaN(sinceYearHome)) return 5;
    const diff = new Date().getFullYear() - sinceYearHome;
    return Math.max(0, diff);
  }, [sinceYearHome]);

  // Viewport profile: ricalcolato automaticamente su resize/orientationchange.
  // Usato per scegliere foto del carosello adatte al device dell'utente.
  const viewport = useViewportProfile();

  const carouselSlides = useMemo(() => {
    // Solo foto/video marcati 'in evidenza' dall'admin: l'admin sceglie
    // esplicitamente quali far girare nel carosello. Se nessuno è marcato,
    // il fallback è "tutte le foto pubblicate" così il carosello non resta
    // vuoto (caso tipico al primo avvio o se l'admin dimentica di flaggare).
    const featuredOnly = media.filter(m => m.src && m.is_featured);
    const pool = featuredOnly.length > 0
      ? featuredOnly
      : media.filter(m => m.src);
    if (pool.length === 0) return [];

    // Stabilisce se un media è "orizzontale", "verticale" o "quadrato"
    // basandosi PRIMA sulle dimensioni reali in pixel (width/height dal DB,
    // misurate da getimagesize al momento dell'upload). Se quelle dimensioni
    // non ci sono — può capitare per video o media vecchi — ricadiamo sul
    // campo 'aspect' testuale come fallback.
    //
    // Soglia 1.15:1 — un'immagine deve essere chiaramente "lunga" su un asse
    // per essere classificata come orizzontale o verticale. Tra 0.87 e 1.15
    // la consideriamo quadrata (accettabile su qualunque viewport).
    const orientation = (m) => {
      const w = Number(m.width)  || 0;
      const h = Number(m.height) || 0;
      if (w > 0 && h > 0) {
        const ratio = w / h;
        if (ratio >= 1.15) return "horizontal";
        if (ratio <= 1 / 1.15) return "vertical";
        return "square";
      }
      // Fallback su 'aspect' testuale dei vecchi record / dei video
      const a = m.aspect || "sq";
      if (a === "wide" || a === "pano") return "horizontal";
      if (a === "tall" || a === "port") return "vertical";
      return "square";
    };

    // Mappa: viewport → preferenza orientamento
    // - Su mobile in portrait: vogliamo foto verticali (riempiono lo schermo)
    // - Su desktop/landscape: foto orizzontali (no fasce nere ai lati)
    // - I quadrati sono sempre tier 2 (accettabili ovunque)
    const score = (m) => {
      const o = orientation(m);
      if (viewport === "mobile-portrait") {
        if (o === "vertical")   return 2;
        if (o === "square")     return 1;
        return 0;
      } else {
        if (o === "horizontal") return 2;
        if (o === "square")     return 1;
        return 0;
      }
    };

    const ideal      = pool.filter(m => score(m) === 2);
    const acceptable = pool.filter(m => score(m) === 1);

    let chosen = ideal.length >= 3
      ? ideal
      : [...ideal, ...acceptable];
    if (chosen.length === 0) chosen = pool;

    const shuffled = [...chosen].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(6, shuffled.length));
  }, [media, viewport]);

  // Eventi della home: caricati dal server al mount.
  // Trigger di re-fetch: cambio lingua, 'niwa-events-updated' (admin),
  // visibilitychange (utente torna sul tab).
  // (states events/refetchTick dichiarati in alto al componente per
  //  poterli usare come dipendenze di useReveal)

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await window.niwaFetch("/api/events.php");
        if (!cancelled && r.ok && Array.isArray(r.data)) setEvents(r.data);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [lang, refetchTick]);

  useEffect(() => {
    const bump = () => setRefetchTick(x => x + 1);
    window.addEventListener("niwa-events-updated", bump);
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    return () => {
      window.removeEventListener("niwa-events-updated", bump);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
    };
  }, []);

  // Separa eventi passati vs imminenti/in corso in base alla data.
  // Un evento con date_to è "passato" solo quando anche date_to < oggi.
  // Senza date_to, si usa date_from.
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = [];
    const past = [];
    for (const ev of events) {
      if (!ev.date_from) continue;
      const lastDay = new Date((ev.date_to || ev.date_from) + "T00:00:00");
      if (isNaN(lastDay.getTime())) continue;
      if (lastDay >= today) upcoming.push(ev);
      else past.push(ev);
    }
    // Imminenti: ordinati dal più vicino in futuro
    upcoming.sort((a, b) => (a.date_from > b.date_from ? 1 : -1));
    // Passati: dal più recente al più vecchio (server già DESC, ma per
    // sicurezza riordiniamo qui)
    past.sort((a, b) => (a.date_from < b.date_from ? 1 : -1));
    return { upcomingEvents: upcoming, pastEvents: past };
  }, [events]);

  // Formato data localizzato compatto
  const formatEventDate = (from, to) => {
    if (!from) return "";
    const a = new Date(from + "T00:00:00");
    if (isNaN(a.getTime())) return from;
    const locale = lang === "it" ? "it-IT" : "en-US";
    const fmt = (d, opts) => d.toLocaleDateString(locale, opts);
    if (!to || to === from) {
      return fmt(a, { day: "2-digit", month: "short", year: "numeric" });
    }
    const b = new Date(to + "T00:00:00");
    if (isNaN(b.getTime())) return fmt(a, { day: "2-digit", month: "short", year: "numeric" });
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
      return `${a.getDate()}–${b.getDate()} ${fmt(a, { month: "short", year: "numeric" })}`;
    }
    if (a.getFullYear() === b.getFullYear()) {
      return `${fmt(a, { day: "2-digit", month: "short" })} — ${fmt(b, { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    return `${fmt(a, { day: "2-digit", month: "short", year: "numeric" })} — ${fmt(b, { day: "2-digit", month: "short", year: "numeric" })}`;
  };

  const localizedField = (obj, key) => (obj?.[key]?.[lang] || obj?.[key]?.it || obj?.[key]?.en || "");

  // Stato della Lightbox: quale slide del carosello è aperto.
  // I "items" della lightbox sono gli stessi slide del carosello.
  const [openId, setOpenId] = useState(null);

  return (
    <div className="home page-transition-enter" ref={ref}>
      <section className="hero container">
        <div className="hero-meta">
          <div className="eyebrow">{t("home.eyebrow")}</div>
        </div>

        <HomeCarousel slides={carouselSlides} onSlideClick={setOpenId} />

        <div className="hero-bottom">
          <div>
            <p className="hero-blurb reveal">{t("home.blurb")}</p>
            <div className="hero-cta-row reveal">
              <a className="btn btn--accent" href="#photos">
                {t("common.view_portfolio")}
                <span className="btn-arrow"><Icon.Arrow /></span>
              </a>
              <a className="btn btn--ghost" href="#about">
                {lang === "it" ? "Chi è Carmine" : "About Carmine"}
              </a>
              {authed && (
                <a className="btn btn--admin" href="#admin"
                   title={lang === "it" ? "Area amministrazione" : "Admin area"}>
                  <Icon.Edit />
                  {lang === "it" ? "Admin" : "Admin"}
                </a>
              )}
            </div>
          </div>
          <div className="hero-stats reveal">
            <div>
              <div className="stat-num">{yearsActive}</div>
              <div className="stat-label">{t("home.stats.years")}</div>
            </div>
            <div>
              <div className="stat-num">{(t("home.stats.events_val") || "").trim() || "42"}</div>
              <div className="stat-label">{t("home.stats.events")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-events container">
        <div className="home-events-head reveal">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            {lang === "it" ? "Eventi" : "Events"}
          </div>
          <h2 className="display h2" style={{ margin: 0 }}>{t("about.journey_title")}</h2>
        </div>

        {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
          <div className="reveal" style={{
            padding: "40px 0", color: "var(--fg-faint)",
            fontStyle: "italic", textAlign: "center"
          }}>
            {lang === "it"
              ? "Nessun evento da mostrare. L'admin può aggiungerli dal pannello."
              : "No events to show. The admin can add them from the panel."}
          </div>
        ) : (
          <>
            {upcomingEvents.length > 0 && (
              <div className="home-events-group">
                <h3 className="home-events-subtitle reveal">
                  <span className="home-events-dot home-events-dot--upcoming"></span>
                  {lang === "it" ? "Prossimi eventi" : "Upcoming events"}
                </h3>
                <EventsDiary
                  events={upcomingEvents}
                  formatDate={formatEventDate}
                  localizedField={localizedField}
                  perPage={3}
                  lang={lang} />
              </div>
            )}

            {pastEvents.length > 0 && (
              <div className="home-events-group">
                <h3 className="home-events-subtitle reveal">
                  <span className="home-events-dot home-events-dot--past"></span>
                  {lang === "it" ? "Eventi passati" : "Past events"}
                </h3>
                <EventsDiary
                  events={pastEvents}
                  formatDate={formatEventDate}
                  localizedField={localizedField}
                  perPage={3}
                  lang={lang} />
              </div>
            )}
          </>
        )}
      </section>

      {openId && (
        <Lightbox
          items={carouselSlides}
          currentId={openId}
          onClose={() => setOpenId(null)}
          onChange={setOpenId} />
      )}
    </div>
  );
}

/* ---------------- Gallery (Photos & Videos shared) ---------------- */
function GalleryPage({ kind }) {
  const { t, lang } = useLang();
  const { media } = useStore();
  const [filter, setFilter] = useState(() => sessionStorage.getItem("niwa.filter") || "all");
  const [openId, setOpenId] = useState(null);

  // Modalità di visualizzazione: "grid" (uniforme, tutte stesse dimensioni)
  // o "mosaic" (proporzioni naturali, layout Pinterest-style).
  // Persistita in localStorage SEPARATA per foto e video: l'utente può preferire
  // mosaico per le foto e griglia per i video, ad esempio.
  const viewKey = `niwa.view.${kind}`;
  const [view, setView] = useState(() => {
    const v = localStorage.getItem(viewKey);
    return v === "mosaic" || v === "grid" ? v : "grid";
  });
  useEffect(() => {
    try { localStorage.setItem(viewKey, view); } catch (e) {}
  }, [view, viewKey]);

  useEffect(() => {
    sessionStorage.removeItem("niwa.filter");
  }, []);

  const items = useMemo(() => {
    return media.filter(m => m.type === kind);
  }, [media, kind]);

  const counts = useMemo(() => {
    const c = { all: items.length };
    items.forEach(m => { c[m.category] = (c[m.category] || 0) + 1; });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(m => m.category === filter);
  }, [items, filter]);

  const cats = Object.keys(window.NIWA_CATEGORIES);

  const titleKey = kind === "photo" ? "photos" : "videos";

  return (
    <div className="page-transition-enter">
      <div className="container">
        <div className="gallery-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              {kind === "photo" ? "Portfolio" : "Portfolio"}
            </div>
            <h1 className="gallery-title">
              {t(`${titleKey}.title_a`)}{" "}
              <span style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 400 }}>
                {t(`${titleKey}.title_b`)}
              </span>
            </h1>
            <p className="gallery-subtitle">{t(`${titleKey}.sub`)}</p>
          </div>
        </div>

        <div className="filters">
          <button className={"filter-chip " + (filter === "all" ? "is-active" : "")}
                  onClick={() => setFilter("all")}>
            {t("common.all")}
            <span className="count">{counts.all || 0}</span>
          </button>
          {cats.map(c => (
            counts[c] > 0 && (
              <button key={c}
                      className={"filter-chip " + (filter === c ? "is-active" : "")}
                      onClick={() => setFilter(c)}>
                {window.NIWA_CATEGORIES[c][lang]}
                <span className="count">{counts[c] || 0}</span>
              </button>
            )
          ))}
          <div className="filter-spacer"></div>
          <div className="filter-view-toggle" role="group" aria-label={lang === "it" ? "Modalità di visualizzazione" : "View mode"}>
            <button className={view === "grid" ? "is-active" : ""}
                    onClick={() => setView("grid")}
                    title={lang === "it" ? "Griglia" : "Grid"}>
              <Icon.Grid />
              <span>{lang === "it" ? "Griglia" : "Grid"}</span>
            </button>
            <button className={view === "mosaic" ? "is-active" : ""}
                    onClick={() => setView("mosaic")}
                    title={lang === "it" ? "Mosaico" : "Mosaic"}>
              <Icon.Mosaic />
              <span>{lang === "it" ? "Mosaico" : "Mosaic"}</span>
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{t("common.no_results")}</h3>
            <p>{t("common.no_results_sub")}</p>
          </div>
        ) : (
          <div className={"photo-grid " + (view === "mosaic" ? "is-mosaic" : "is-uniform")}>
            {filtered.map((it, i) => (
              <MediaCard
                key={it.id}
                item={it}
                idx={i}
                sizeClass=""
                onOpen={() => setOpenId(it.id)} />
            ))}
          </div>
        )}
      </div>

      {openId && (
        <Lightbox
          items={filtered}
          currentId={openId}
          onClose={() => setOpenId(null)}
          onChange={setOpenId} />
      )}
    </div>
  );
}

/* ---------------- About ---------------- */
function AboutPage() {
  const { t, lang } = useLang();
  // Stato per servizi: caricato dal server al mount, ricaricato su
  // 'niwa-services-updated' (emesso dal pannello admin).
  const [services, setServices] = useState([]);
  const [refetchTick, setRefetchTick] = useState(0);
  // useReveal con dipendenza su services.length così le nuove voci
  // appena fetchate vengono osservate e diventano visibili.
  const ref = useReveal([lang, services.length]);

  // Anno di nascita modificabile dall'admin (key 'about.birth_year' nei testi).
  // Se non impostato, usa il default storico.
  const birthYearStr = (t("about.birth_year") || "").trim();
  const birthYear = parseInt(birthYearStr, 10) || 1999;

  const age = useMemo(() => {
    const now = new Date();
    const birth = new Date(birthYear, 11, 29);
    let a = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) a--;
    return a;
  }, [birthYear]);

  // Immagine profilo: solo l'override impostato dall'admin nei testi
  // (key 'about.portrait_url'). Se vuoto, mostriamo un placeholder neutro
  // — niente più foto Unsplash di backup che si confonderebbero con
  // l'immagine reale del fotografo.
  const portraitOverride = (t("about.portrait_url") || "").trim();
  const portraitUrl = portraitOverride;

  // Anno "since" modificabile dall'admin (key 'about.since_year').
  // Da questo calcoliamo dinamicamente gli anni di attività: ogni 1° gennaio
  // il numero si aggiorna da solo. Stesso valore usato anche nella home.
  const sinceYearStr = (t("about.since_year") || "").trim();
  const sinceYearAbout = parseInt(sinceYearStr, 10) || 2021;
  const yearsActiveAbout = useMemo(() => {
    const diff = new Date().getFullYear() - sinceYearAbout;
    return Math.max(0, diff);
  }, [sinceYearAbout]);

  // Servizi: caricato dal server al mount. Trigger di re-fetch:
  //  1) cambio di lang
  //  2) evento globale 'niwa-services-updated' (emesso dal pannello admin)
  //  3) visibilitychange / pageshow (utente torna sul tab)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await window.niwaFetch("/api/services.php");
        if (!cancelled && r.ok && Array.isArray(r.data)) setServices(r.data);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [lang, refetchTick]);

  useEffect(() => {
    const bump = () => setRefetchTick(x => x + 1);
    window.addEventListener("niwa-services-updated", bump);
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    return () => {
      window.removeEventListener("niwa-services-updated", bump);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
    };
  }, []);

  return (
    <div className="container page-transition-enter" ref={ref}>
      <section className="about-hero">
        <div className="about-portrait reveal">
          {portraitUrl ? (
            <img
              src={window.niwaAssetUrl(portraitUrl)}
              alt={t("about.name")}
              style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.85) contrast(1.05)" }} />
          ) : (
            <div className="about-portrait-placeholder">
              <div className="about-portrait-initial">
                {(t("about.name") || "?").trim().charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          <div className="age-chip">{age} {lang === "it" ? "anni" : "years old"}</div>
        </div>
        <div>
          <div className="eyebrow">{t("about.eyebrow")}</div>
          <h1 className="about-name">{t("about.name")}<span style={{ color: "var(--accent)" }}>.</span></h1>
          <p className="about-quote">{t("about.quote")}</p>
          <p className="about-bio">{t("about.bio_1")}</p>
          <p className="about-bio">{t("about.bio_2")}</p>
        </div>
      </section>

      <section className="about-meta-strip reveal">
        <div className="about-meta-item">
          <div className="eyebrow" style={{ marginBottom: 10 }}>{t("about.meta.based")}</div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{t("about.based_val")}</div>
        </div>
        <div className="about-meta-item">
          <div className="eyebrow" style={{ marginBottom: 10 }}>{t("about.meta.since")}</div>
          <div className="stat-num">{yearsActiveAbout} <span style={{ fontSize: "0.5em", color: "var(--fg-soft)", fontWeight: 400 }}>{lang === "it" ? "anni" : "yrs"}</span></div>
          <div style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
            {lang === "it" ? "dal" : "since"} {sinceYearAbout}
          </div>
        </div>
        <div className="about-meta-item">
          <div className="eyebrow" style={{ marginBottom: 10 }}>{t("about.meta.focus")}</div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{t("about.focus_val")}</div>
        </div>
        <div className="about-meta-item">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {lang === "it" ? "Servizi" : "Services"}
          </div>
          {services.length === 0 ? (
            <div style={{ fontSize: 14, color: "var(--fg-faint)", fontStyle: "italic" }}>
              {lang === "it" ? "Nessun servizio configurato" : "No services configured"}
            </div>
          ) : (
            <ul className="services-list">
              {services.map(s => {
                const name = s.name?.[lang] || s.name?.it || s.name?.en || "";
                if (!name) return null;
                return (
                  <li key={s.id}>
                    <span className="services-bullet"></span>
                    {name}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------------- Contact ---------------- */
// Mappa icon-key (server) → componente Icon (frontend).
// Le key sono quelle restituite da /api/social.php (auto-detect dell'host).
const SOCIAL_ICON_MAP = {
  instagram: "Instagram",
  facebook:  "Facebook",
  tiktok:    "TikTok",
  youtube:   "YouTube",
  twitter:   "Twitter",
  linkedin:  "LinkedIn",
  behance:   "Behance",
  vimeo:     "Vimeo",
  pinterest: "Pinterest",
  telegram:  "Telegram",
  whatsapp:  "WhatsApp",
  link:      "Link",
};

function ContactPage() {
  const { t, lang } = useLang();
  const { show } = useToast();

  const [subjects, setSubjects] = useState([]);
  const [socials, setSocials]   = useState([]);
  // Tick: incrementato da listener esterni (admin update, visibility change)
  // per forzare il refetch.
  const [refetchTick, setRefetchTick] = useState(0);

  // useReveal con dipendenza sui dati caricati: i nodi della aside
  // vengono creati dopo il fetch, quindi l'IntersectionObserver deve
  // ri-osservarli appena cambiano gli array.
  const ref = useReveal([lang, subjects.length, socials.length]);

  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot: campo nascosto. Se valorizzato → bot, ignoriamo lato server.
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);

  // Fetch subjects + socials dal server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await window.niwaFetch("/api/subjects.php");
        if (!cancelled && r.ok && Array.isArray(r.data)) setSubjects(r.data);
      } catch (_) {}
    })();
    (async () => {
      try {
        const r = await window.niwaFetch("/api/social.php");
        if (!cancelled && r.ok && Array.isArray(r.data)) setSocials(r.data);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [lang, refetchTick]);

  // Refetch quando l'admin salva/elimina + quando il tab torna visibile.
  useEffect(() => {
    const bump = () => setRefetchTick(x => x + 1);
    window.addEventListener("niwa-subjects-updated", bump);
    window.addEventListener("niwa-socials-updated", bump);
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    return () => {
      window.removeEventListener("niwa-subjects-updated", bump);
      window.removeEventListener("niwa-socials-updated", bump);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
    };
  }, []);

  // Disponibilità: il flag è una stringa testuale ("on"/"off"/"si"/"no"/"true"/"")
  // perché viene editata come testo libero dal pannello "Testi del sito".
  // Interpretiamo qualunque "on"/"1"/"true"/"yes"/"si" (case insensitive)
  // come attivo; tutto il resto come non disponibile.
  const availabilityOn = useMemo(() => {
    const v = (t("contact.side.availability_on") || "").trim().toLowerCase();
    return ["on", "1", "true", "yes", "si", "sì"].includes(v);
  }, [t]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (sending || sent) return;
    setSending(true);
    try {
      const res = await fetch("/api/contact.php", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ name, email, subject, message, website }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setSent(true);
        show(t("contact.form.sent"));
        setName(""); setEmail(""); setSubject(""); setMessage("");
        setTimeout(() => setSent(false), 4000);
      } else if (res.status === 429) {
        show(lang === "it" ? "Troppi messaggi, riprova più tardi." : "Too many messages, please try later.");
      } else {
        show(lang === "it" ? "Errore di invio. Riprova." : "Send error. Please retry.");
      }
    } catch (err) {
      show(lang === "it" ? "Errore di rete." : "Network error.");
    } finally {
      setSending(false);
    }
  };

  // Valori dinamici dai testi del sito (con fallback ai default)
  const emailVal       = (t("contact.side.email_val") || "hello@niwa.ph").trim();
  const locationVal    = (t("contact.side.location_val") || "").trim();
  const availOnText    = (t("contact.side.availability_val") || "").trim();
  const availOffText   = (t("contact.side.availability_off_val") || "").trim();
  const availText      = availabilityOn ? availOnText : availOffText;

  return (
    <div className="container contact page-transition-enter" ref={ref}>
      <div className="eyebrow">{t("contact.eyebrow")}</div>
      <h1 className="contact-title" style={{ marginTop: 16 }}>
        {t("contact.title_a")}<br />
        <span className="light">{t("contact.title_b")}</span>
      </h1>
      <p className="hero-blurb" style={{ marginTop: 16, maxWidth: 560 }}>
        {t("contact.sub")}
      </p>

      <div className="contact-grid">
        <form className="contact-form" onSubmit={onSubmit}>
          <div className="field-row">
            <div className="field">
              <label>{t("contact.form.name")}</label>
              <input required type="text" maxLength={160}
                     value={name} onChange={(e) => setName(e.target.value)}
                     placeholder={lang === "it" ? "Il tuo nome" : "Your name"} />
            </div>
            <div className="field">
              <label>{t("contact.form.email")}</label>
              <input required type="email" maxLength={190}
                     value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="hello@example.com" />
            </div>
          </div>
          <div className="field">
            <label>{t("contact.form.subject")}</label>
            <select required value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="" disabled>—</option>
              {subjects.map((s) => {
                const lbl = s.label?.[lang] || s.label?.it || s.label?.en || "";
                if (!lbl) return null;
                return <option key={s.id} value={lbl}>{lbl}</option>;
              })}
            </select>
          </div>
          <div className="field">
            <label>{t("contact.form.message")}</label>
            <textarea required rows="5" maxLength={5000}
                      value={message} onChange={(e) => setMessage(e.target.value)}
                      placeholder="..."></textarea>
          </div>
          {/* Honeypot anti-bot (nascosto via CSS inline + tabIndex/aria) */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px", height: 0, width: 0, overflow: "hidden" }}>
            <label>Website (do not fill)</label>
            <input type="text" tabIndex={-1} autoComplete="off"
                   value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div>
            <button className="btn btn--accent" type="submit" disabled={sending || sent}>
              {sent
                ? "✓ " + t("contact.form.sent").split("—")[0]
                : sending
                  ? (lang === "it" ? "Invio…" : "Sending…")
                  : t("contact.form.submit")}
              {!sent && !sending && <span className="btn-arrow"><Icon.Arrow /></span>}
            </button>
          </div>
        </form>

        <aside className="contact-side">
          <div className="contact-block reveal">
            <h4><Icon.Mail /> &nbsp;{t("contact.side.email")}</h4>
            <div className="val">
              <a href={`mailto:${emailVal}`}>{emailVal}</a>
            </div>
          </div>

          {/* Sezione Social: rendering condizionale. Se la lista è vuota la
              card non appare. Il titolo è modificabile via contact.side.social. */}
          {socials.length > 0 && (
            <div className="contact-block reveal">
              <h4>{t("contact.side.social")}</h4>
              <div className="social-row" style={{ marginTop: 4 }}>
                {socials.map(s => {
                  // Risolvo il componente Icon dalla mappa; fallback su Link generico.
                  const iconKey = SOCIAL_ICON_MAP[s.icon] || "Link";
                  const IconComp = Icon[iconKey] || Icon.Link;
                  return (
                    <a key={s.id} className="social-pill"
                       href={s.url}
                       target="_blank"
                       rel="noopener noreferrer">
                      <IconComp /> {s.label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Location: card visibile solo se l'admin ha scritto qualcosa.
              Se svuota il campo da pannello Testi, la card scompare. */}
          {locationVal && (
            <div className="contact-block reveal">
              <h4><Icon.Pin /> &nbsp;{t("contact.side.location")}</h4>
              <div className="val">{locationVal}</div>
            </div>
          )}

          {/* Disponibilità: due stati, ognuno con colori tematizzati.
              - On: --accent (terracotta brand, percepito come positivo)
              - Off: --fg-faint su sfondo neutro (no rosso aggressivo) */}
          {availText && (
            <div className={"contact-block reveal availability-block " + (availabilityOn ? "is-available" : "is-unavailable")}>
              <h4>
                <span className="availability-dot" aria-hidden="true"></span>
                {t("contact.side.availability")}
              </h4>
              <div className="val">{availText}</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function AdminPasswordResetPage() {
  const { lang } = useLang();

  return (
    <div className="container page-transition-enter" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div className="admin-card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginBottom: 6 }}>
          {lang === "it" ? "Reset Password Admin (temporaneo)" : "Admin Password Reset (temporary)"}
        </h3>
        <p style={{ margin: 0, color: "var(--fg-soft)", fontSize: 13 }}>
          {lang === "it"
            ? "Questa pagina carica il tool temporaneo per cambiare la password admin."
            : "This page loads the temporary tool to change admin password."}
        </p>
      </div>

      <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
        <iframe
          title="Admin Password Reset"
          src="/api/admin/set_admin_password.php"
          style={{ width: "100%", minHeight: "78vh", border: 0, background: "#fff" }}
        />
      </div>
    </div>
  );
}

Object.assign(window, { Intro, HomePage, GalleryPage, AboutPage, ContactPage, AdminPasswordResetPage });