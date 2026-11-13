/* ================================================================
   NIWA.PH — Shared UI: Nav, Footer, Lightbox, MediaCard
   ================================================================ */

function Nav() {
  const { route, go } = useRouter();
  const { lang, toggle: toggleLang } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const links = [
    { id: "home", label: "nav.home" },
    { id: "photos", label: "nav.photos" },
    { id: "videos", label: "nav.videos" },
    { id: "about", label: "nav.about" },
    { id: "contact", label: "nav.contact" }
  ];
  const { t } = useLang();

  return (
    <nav className="nav">
      <a className="nav-brand" href="#home" onClick={() => setOpen(false)}>
        <div className="nav-logo"><img src="assets/logo.jpg" alt="Niwa.ph" /></div>
        <span>Niwa<span style={{ color: "var(--accent)" }}>.</span>ph</span>
      </a>
      <div className={"nav-links " + (open ? "is-open" : "")}>
        {links.map(l => (
          <a key={l.id}
             href={"#" + l.id}
             onClick={() => setOpen(false)}
             className={"nav-link " + (route === l.id ? "is-active" : "")}>
            {t(l.label)}
          </a>
        ))}
      </div>
      <div className="nav-tools">
        <button className="icon-btn lang-btn" onClick={toggleLang} title="Language">
          <span className={lang === "it" ? "lang-active" : "lang-inactive"}>IT</span>
          <span className="lang-sep">/</span>
          <span className={lang === "en" ? "lang-active" : "lang-inactive"}>EN</span>
        </button>
        <button className="icon-btn" onClick={toggleTheme} title="Theme">
          {theme === "dark" ? <Icon.Sun /> : <Icon.Moon />}
        </button>
        <button className="icon-btn nav-burger" onClick={() => setOpen(o => !o)} title="Menu">
          <Icon.Burger />
        </button>
      </div>
    </nav>
  );
}

function Footer({ compact = false }) {
  const { t, lang } = useLang();
  const yr = new Date().getFullYear();

  // Modalità compatta: usata nella home, mostra solo la riga del copyright.
  // Le altre pagine vedono il footer completo con link, contatti, ecc.
  if (compact) {
    return (
      <footer className="footer footer--compact">
        <div className="container">
          <div className="footer-bottom">
            <span>© {yr} Niwa.ph · Carmine</span>
            <span>{lang === "it" ? "Tutti i diritti riservati" : "All rights reserved"}</span>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <div className="footer-mark">
              Niwa<span className="light">.ph</span>
            </div>
            <p style={{ color: "var(--fg-soft)", maxWidth: 360, marginTop: 16 }}>
              {t("home.blurb")}
            </p>
          </div>
          <div>
            <h5>{t("nav.home").toUpperCase()}</h5>
            <ul className="footer-list">
              <li><a href="#home">{t("nav.home")}</a></li>
              <li><a href="#photos">{t("nav.photos")}</a></li>
              <li><a href="#videos">{t("nav.videos")}</a></li>
              <li><a href="#about">{t("nav.about")}</a></li>
              <li><a href="#contact">{t("nav.contact")}</a></li>
            </ul>
          </div>
          <div>
            <h5>Connect</h5>
            <ul className="footer-list">
              <li><a href="#contact">hello@niwa.ph</a></li>
              <li><a href="#contact">@niwa.ph</a></li>
              <li><a href="#contact">{lang === "it" ? "Mercato S. Severino, IT" : "Mercato S. Severino, IT"}</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {yr} Niwa.ph · Carmine</span>
          <span>{lang === "it" ? "Tutti i diritti riservati" : "All rights reserved"}</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- Media Card (used in galleries) ---------------- */
function MediaCard({ item, onOpen, sizeClass, idx = 0 }) {
  const { lang } = useLang();
  const cat = window.NIWA_CATEGORIES[item.category]?.[lang] || "";
  const title = localized(item.title, lang);
  // Filter, grain e vignette applicati sempre — qualità massima è il default.
  const filter   = window.niwaFilterStr({ ...window.NIWA_PRESETS[item.preset || "none"], ...item.adj });
  const grain    = ((item.adj?.grain    ?? window.NIWA_PRESETS[item.preset || "none"].grain)    || 0) / 100;
  const vignette = ((item.adj?.vignette ?? window.NIWA_PRESETS[item.preset || "none"].vignette) || 0) / 100;
  const ref = useRef(null);

  // Per i video: il poster di copertina è prima di tutto il frame scelto
  // dall'admin (carousel_frame_url), se presente. Altrimenti ricade sul
  // poster standard del media. Questo modo l'admin vede la stessa
  // copertina sia nel carosello home sia nella galleria video pubblica.
  const videoPoster = item.carousel_frame_url
    ? window.niwaAssetUrl(item.carousel_frame_url, 800)
    : window.niwaAssetUrl(item.poster, 800);

  // Hover-play attivo sempre per i video del portfolio
  const onMouseEnter = (e) => e.currentTarget.play().catch(() => {});
  const onMouseLeave = (e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; };

  return (
    <div
      ref={ref}
      className={"photo-card " + (sizeClass || "s-sq")}
      style={{ animationDelay: (idx % 12) * 50 + "ms" }}
      onClick={() => onOpen(item)}>
      <div className="photo-card-media">
        {item.type === "video" ? (
          <video src={window.niwaAssetUrl(item.src)}
                 poster={videoPoster}
                 muted loop preload="metadata"
                 playsInline
                 style={{ filter }}
                 onMouseEnter={onMouseEnter}
                 onMouseLeave={onMouseLeave} />
        ) : (
          <img src={window.niwaAssetUrl(item.src, 800)}
               alt={title || "photo"}
               loading="lazy"
               decoding="async"
               style={{ filter }} />
        )}
        {grain > 0 && <div style={grainStyle(grain)} />}
        {vignette > 0 && <div style={vignetteStyle(vignette)} />}
        {item.type === "video" && (
          <div className="play-icon"><Icon.Play /></div>
        )}
      </div>
      {(title || cat) && (
        <div className="overlay">
          <div className="meta">
            {cat && <div className="meta-cat">{cat}</div>}
            {title && <div className="meta-title">{title}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function grainStyle(intensity) {
  return {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23g)'/></svg>\")",
    opacity: Math.min(intensity * 0.55, 0.5),
    mixBlendMode: "overlay"
  };
}

function vignetteStyle(intensity) {
  return {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background: `radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${intensity * 0.65}) 100%)`
  };
}

/* Heuristica mobile: pointer "coarse" (touch primario) E viewport corto.
   Evitiamo userAgent sniffing — pointer/hover sono molto più affidabili. */
function isMobileViewport() {
  if (typeof window === "undefined") return false;
  // matchMedia con pointer:coarse copre iPad, Android, telefoni iOS.
  // Aggiungiamo width per escludere tablet grandi in landscape (dove il
  // fullscreen auto è meno utile e a volte fastidioso).
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 900px)").matches;
  return coarse && narrow;
}

/* Entra in fullscreen sul tag <video> in modo cross-browser, ma SOLO
   se siamo su mobile. Su desktop il fullscreen è sempre disponibile
   tramite il pulsante nativo dei controls, non vogliamo forzarlo.

   Strategia mobile:
   - iOS Safari: HTMLVideoElement ha webkitEnterFullscreen() nativo
     (NB: l'iOS standard requestFullscreen() su element generici è
     supportato solo da iPadOS 12+; webkitEnterFullscreen() è più
     ampiamente disponibile sui video iOS).
   - Android/altri: requestFullscreen() standard sul video element.

   Nota: questa funzione viene chiamata da onPlay che è una user gesture
   (l'autoplay che parte conta come "innescato dall'utente che ha
   cliccato per aprire la lightbox"), quindi il browser non bloccherà
   la richiesta. Se l'utente esce dal fullscreen (gesto pinch o tap
   X), può rientrare manualmente dai controls del video. Non forziamo
   il fullscreen ad ogni play successivo per non essere invasivi. */
function maybeEnterFullscreen(videoEl) {
  if (!videoEl || !isMobileViewport()) return;
  // Già in fullscreen? non rifare la richiesta
  const fsActive = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    videoEl.webkitDisplayingFullscreen
  );
  if (fsActive) return;
  // Solo al primo play di questo elemento, per evitare di "saltarci dentro"
  // ogni volta che l'utente esce e rimette play.
  if (videoEl.dataset.niwaFsAttempted === "1") return;
  videoEl.dataset.niwaFsAttempted = "1";

  try {
    if (typeof videoEl.webkitEnterFullscreen === "function") {
      // iOS Safari — apre il player fullscreen nativo
      videoEl.webkitEnterFullscreen();
    } else if (typeof videoEl.requestFullscreen === "function") {
      // Standard
      videoEl.requestFullscreen().catch(() => {});
    } else if (typeof videoEl.webkitRequestFullscreen === "function") {
      videoEl.webkitRequestFullscreen();
    }
  } catch (_) {
    // Silenzioso: se il browser blocca per qualunque ragione, l'utente
    // può comunque andare in fullscreen dai controls.
  }
}

/* ---------------- Lightbox ---------------- */
function Lightbox({ items, currentId, onClose, onChange }) {
  const { lang, t } = useLang();
  const idx = items.findIndex(m => m.id === currentId);
  const item = items[idx];

  // Lock scroll robusto:
  //  - su molti browser body{overflow:hidden} non basta (iOS, alcuni mobile)
  //  - usiamo position:fixed sul body con top=-scrollY e ripristiniamo al close
  // Ricordiamo la posizione di scroll per restituirla esattamente quando si chiude.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const html = document.documentElement;
    const body = document.body;
    // Salva i valori precedenti per ripristinare con precisione
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
    html.style.scrollBehavior = "auto"; // evita scroll smooth durante il restore
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    window.addEventListener("keydown", onKey);
    return () => {
      // Ripristina e riposiziona lo scroll
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
  }, [idx, items.length]);

  const next = () => { if (idx < items.length - 1) onChange(items[idx + 1].id); };
  const prev = () => { if (idx > 0) onChange(items[idx - 1].id); };

  if (!item) return null;
  const cat = window.NIWA_CATEGORIES[item.category]?.[lang] || "";
  const title = localized(item.title, lang);
  const desc = localized(item.desc, lang);
  // Filter / grain / vignette sempre applicati: qualità massima per il
  // visitatore, niente modalità ridotta.
  const filter   = window.niwaFilterStr({ ...window.NIWA_PRESETS[item.preset || "none"], ...item.adj });
  const grain    = ((item.adj?.grain    ?? window.NIWA_PRESETS[item.preset || "none"].grain)    || 0) / 100;
  const vignette = ((item.adj?.vignette ?? window.NIWA_PRESETS[item.preset || "none"].vignette) || 0) / 100;
  const presetLabel = window.NIWA_PRESETS[item.preset || "none"].label[lang];

  // Se l'admin ha disattivato show_info per questo media, il visitatore
  // vede SOLO la foto/video pulita: niente categoria, titolo, descrizione,
  // tag o metadati. La classe "lb-fullscreen" sul container permette
  // al CSS di estendere lo stage a tutto lo schermo.
  const showInfo = item.show_info !== false;
  const hasMeta = showInfo && (title || desc || (item.tags && item.tags.length) || cat);

  // Touch: blocco lo scroll del body anche durante swipe, ma permetto lo scroll
  // interno al pannello laterale .lb-side (gestito via CSS overflow-y:auto).
  const stopBackgroundScroll = (e) => {
    // Se l'evento parte dal pannello info, lascialo scrollare; altrove blocca.
    if (e.target.closest(".lb-side")) return;
    // Solo se c'è effettivamente un movimento touch su area non scrollabile
    if (e.cancelable) e.preventDefault();
  };

  // RENDER VIA PORTAL:
  // Il rendering della lightbox NON deve essere figlio della pagina,
  // perché la pagina ha animation (.page-transition-enter) che applica
  // un transform — e qualsiasi `transform` su un antenato fa sì che
  // `position: fixed` interno NON sia più relativo al viewport ma
  // all'antenato trasformato. Risultato: la lightbox finisce ancorata
  // alla posizione originale della pagina e non al centro dello schermo.
  //
  // Il portal monta il sub-tree direttamente in document.body, fuori
  // da ogni containing block creato dai suoi predecessori naturali.
  const lightboxNode = (
    <div className={"lightbox " + (showInfo ? "" : "lb-fullscreen")}
         onClick={(e) => { if (e.target.classList.contains("lightbox") || e.target.classList.contains("lb-stage")) onClose(); }}
         onTouchMove={stopBackgroundScroll}>
      <div className="lb-stage">
        <button className="lb-close" onClick={onClose} title={t("common.close")}><Icon.Close /></button>
        {idx > 0 && <button className="lb-nav prev" onClick={prev}><Icon.ChevL /></button>}
        {idx < items.length - 1 && <button className="lb-nav next" onClick={next}><Icon.ChevR /></button>}
        <div className="lb-media-wrap">
          {item.type === "video" ? (
            <video key={item.id}
                   src={window.niwaAssetUrl(item.src)}
                   poster={item.carousel_frame_url
                     ? window.niwaAssetUrl(item.carousel_frame_url)
                     : window.niwaAssetUrl(item.poster)}
                   controls
                   autoPlay
                   playsInline
                   onPlay={(e) => maybeEnterFullscreen(e.currentTarget)}
                   style={{ filter }} />
          ) : (
            <img key={item.id} src={window.niwaAssetUrl(item.src)} alt={title || "photo"} style={{ filter }} />
          )}
          {grain > 0 && <div style={grainStyle(grain)} />}
          {vignette > 0 && <div style={vignetteStyle(vignette)} />}
        </div>
      </div>
      {/* Pannello info: nascosto del tutto se l'admin ha disattivato
          show_info su questo media. Il CSS `.lb-fullscreen` allarga lo
          stage per occupare lo spazio liberato. */}
      {showInfo && (
        <div className="lb-side">
        {cat && <div className="lb-cat">{cat}</div>}
        {title && <h3 className="lb-title">{title}</h3>}
        {desc && <p className="lb-desc">{desc}</p>}
        {item.tags && item.tags.length > 0 && (
          <div className="lb-tags">
            {item.tags.map((tg, i) => <span key={i} className="lb-tag">#{tg}</span>)}
          </div>
        )}
        {hasMeta && <div className="lb-divider" />}
        <div className="lb-meta-grid">
          <div>
            <div>Look</div>
            <div style={{ fontSize: 14 }}>{presetLabel}</div>
          </div>
          <div>
            <div>{lang === "it" ? "Tipo" : "Type"}</div>
            <div style={{ fontSize: 14, textTransform: "capitalize" }}>{item.type}</div>
          </div>
          <div>
            <div>{lang === "it" ? "Indice" : "Index"}</div>
            <div style={{ fontSize: 14, fontFamily: "var(--font-mono)" }}>{String(idx + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</div>
          </div>
          <div>
            <div>ID</div>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--fg-faint)" }}>{item.id}</div>
          </div>
        </div>
      </div>
      )}
    </div>
  );

  return ReactDOM.createPortal(lightboxNode, document.body);
}

Object.assign(window, { Nav, Footer, MediaCard, Lightbox, grainStyle, vignetteStyle });
