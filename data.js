/* ================================================================
   NIWA.PH — Static data + i18n + seed media + presets
   ================================================================ */

window.NIWA_I18N = {
  it: {
    nav: {
      home: "Home",
      photos: "Foto",
      videos: "Video",
      about: "Chi Sono",
      contact: "Contatti"
    },
    common: {
      view_portfolio: "Esplora portfolio",
      get_in_touch: "Mettiti in contatto",
      since: "Attivo da",
      all: "Tutto",
      view: "Vista",
      grid: "Griglia",
      masonry: "Mosaico",
      no_results: "Nessun risultato",
      no_results_sub: "Prova un altro filtro o aggiungi nuovi contenuti dal pannello admin.",
      close: "Chiudi",
      next: "Successivo",
      prev: "Precedente"
    },
    home: {
      eyebrow: "Niwa.ph — Visual Storytelling",
      title_a: "Storie",
      title_b: "in",
      title_c: "luce",
      blurb: "Niwa.ph è il progetto fotografico di Carmine. Eventi, ritratti, paesaggi, food, animali — ovunque ci sia qualcosa da raccontare.",
      stats: {
        years: "Anni d'esperienza",
        events: "Eventi documentati"
      },
      featured: "Lavori in evidenza",
      featured_sub: "Una selezione recente / 2024-26",
      view_all: "Vedi tutti",
      hero_caption_default_it: "Niwa.ph — visual storytelling"
    },
    photos: {
      title_a: "Raccolta",
      title_b: "fotografica",
      sub: "Una raccolta in continua evoluzione — sfoglia per categoria o esplora tutto."
    },
    videos: {
      title_a: "Raccolta",
      title_b: "videografica",
      sub: "Video documentari, corti e contenuti per eventi. Cliccare per riprodurre."
    },
    about: {
      eyebrow: "Chi sono",
      name: "Carmine Gallina",
      quote: "“Ovunque ci sia qualcosa da raccontare”",
      bio_1: "Sono Carmine Gallina, fotografo indipendente di Mercato San Severino, in provincia di Salerno. Da cinque anni racconto attraverso l'obiettivo persone, animali, paesaggi e momenti — tutto ciò che merita di essere fissato nel tempo.",
      bio_2: "Niwa.ph nasce dall'idea che la fotografia sia ascolto prima di essere immagine. Il logo — una gallina con un diaframma — è un piccolo omaggio al mio cognome e al modo in cui mi avvicino al lavoro: con curiosità, calma, e attenzione a ogni dettaglio.",
      meta: {
        based: "Base operativa",
        since: "Attivo da",
        focus: "Focus principale",
        gear: "Strumenti"
      },
      based_val: "Mercato San Severino, Campania",
      focus_val: "Eventi · Natura · Food",
      gear_val: "Mirrorless full-frame",
      journey_title: "Il percorso",
      timeline: [
        { year: "2021", title: "I primi scatti", desc: "Inizia il percorso fotografico, esplorando ritratti e natura intorno alla Campania.", tag: "Inizio" },
        { year: "2022", title: "Eventi e matrimoni", desc: "Primi incarichi di documentazione di eventi, dal civile al ricevimento.", tag: "Eventi" },
        { year: "2023", title: "Espansione editoriale", desc: "Reportage di paesaggi e progetti food per attività locali.", tag: "Editoriale" },
        { year: "2024", title: "Animali e quotidianità", desc: "Una serie dedicata alla vita rurale del Sud Italia, da cui nasce anche il logo.", tag: "Serie" },
        { year: "2026", title: "Niwa.ph", desc: "Il portfolio prende forma come progetto autoriale.", tag: "Oggi" }
      ]
    },
    contact: {
      eyebrow: "Contatti",
      title_a: "Lavoriamo",
      title_b: "insieme",
      sub: "Raccontami il tuo progetto — eventi, ritratti, food, animali, paesaggi. Rispondo entro 48 ore.",
      form: {
        name: "Nome",
        email: "Email",
        subject: "Tipo di progetto",
        message: "Raccontami di cosa hai bisogno",
        submit: "Invia richiesta",
        sent: "Messaggio inviato — ti risponderò presto."
      },
      subjects: ["Matrimonio o evento", "Ritratto / famiglia", "Reportage / paesaggi", "Food / commerciale", "Animali", "Altro"],
      side: {
        email: "Email",
        email_val: "hello@niwa.ph",
        social: "Social",
        location: "Dove",
        location_val: "Mercato San Severino (SA), Italia",
        availability: "Disponibilità",
        availability_on: "on",
        availability_val: "Aperto a nuovi progetti",
        availability_off_val: "Non disponibile per nuovi progetti"
      },
      // Rate-limit modificabile dall'admin: max messaggi per IP / finestra
      // in minuti. Defaults storici 5 / 60 (= "max 5 messaggi/ora").
      rate_limit_max: "5",
      rate_limit_window: "60"
    },
    admin: {
      title: "Pannello Admin",
      login_title: "Accesso amministratore",
      login_sub: "Inserisci la password per modificare il sito.",
      login_password: "Password",
      login_submit: "Entra",
      login_hint: "Demo: usa la password ‘niwa’",
      login_error: "Password non corretta",
      logout: "Esci",
      welcome: "Benvenuto, Carmine",
      sections: {
        overview: "Panoramica",
        media: "Media",
        upload: "Carica",
        categories: "Categorie",
        copy: "Testi del sito",
        about: "Chi sono",
        contact: "Contatti",
        presets: "Preset"
      },
      tabs: { upload: "Caricamento", manage: "Gestisci", presets: "Preset" },
      drop_title: "Trascina foto o video qui",
      drop_sub: "oppure fai click per selezionare — JPG, PNG, MP4",
      empty: "Nessun media caricato",
      fields: {
        title: "Titolo",
        category: "Categoria",
        description: "Descrizione",
        tags: "Tag",
        type: "Tipo"
      },
      placeholders: {
        title: "Lascia vuoto per nessun titolo",
        description: "Lascia vuoto per nessuna descrizione",
        tags: "Premi invio per aggiungere"
      },
      preset_title: "Preset / Look",
      adjustments: "Regolazioni",
      sliders: {
        exposure: "Esposizione",
        contrast: "Contrasto",
        saturation: "Saturazione",
        warmth: "Temperatura",
        grain: "Grana",
        vignette: "Vignettatura",
        fade: "Fade"
      },
      reset: "Ripristina",
      save: "Salva",
      uploaded: "Caricato",
      seed: "Carica esempi"
    }
  },
  en: {
    nav: {
      home: "Home",
      photos: "Photos",
      videos: "Video",
      about: "About",
      contact: "Contact"
    },
    common: {
      view_portfolio: "View portfolio",
      get_in_touch: "Get in touch",
      since: "Working since",
      all: "All",
      view: "View",
      grid: "Grid",
      masonry: "Masonry",
      no_results: "No results",
      no_results_sub: "Try a different filter or add new content from the admin panel.",
      close: "Close",
      next: "Next",
      prev: "Previous"
    },
    home: {
      eyebrow: "Niwa.ph — Visual Storytelling",
      title_a: "Stories",
      title_b: "in",
      title_c: "light",
      blurb: "Niwa.ph is Carmine's photo project. Events, portraits, landscapes, food, animals — wherever there's something to tell.",
      stats: {
        years: "Years experience",
        events: "Events documented"
      },
      featured: "Featured work",
      featured_sub: "A recent selection / 2024-26",
      view_all: "View all",
      hero_caption_default_en: "Niwa.ph — visual storytelling"
    },
    photos: {
      title_a: "Photo",
      title_b: "collection",
      sub: "A constantly evolving collection — browse by category or explore everything."
    },
    videos: {
      title_a: "Video",
      title_b: "collection",
      sub: "Documentary clips, shorts and event coverage. Click to play."
    },
    about: {
      eyebrow: "About",
      name: "Carmine Gallina",
      quote: "“Wherever there's something to tell”",
      bio_1: "I'm Carmine Gallina, an independent photographer from Mercato San Severino, in the province of Salerno. For five years I've been telling stories through the lens — people, animals, landscapes and moments worth keeping.",
      bio_2: "Niwa.ph is built on the idea that photography is listening before it is image. The logo — a hen with a camera shutter — is a small nod to my surname (“Gallina” means “hen” in Italian) and to the way I approach my work: with curiosity, patience, and an eye for detail.",
      meta: {
        based: "Based in",
        since: "Working since",
        focus: "Main focus",
        gear: "Gear"
      },
      based_val: "Mercato San Severino, Campania",
      focus_val: "Events · Nature · Food",
      gear_val: "Full-frame mirrorless",
      journey_title: "The journey",
      timeline: [
        { year: "2021", title: "First frames", desc: "Photography starts, exploring portraits and nature around Campania.", tag: "Start" },
        { year: "2022", title: "Events & weddings", desc: "First event commissions — from civil ceremony to reception.", tag: "Events" },
        { year: "2023", title: "Editorial expansion", desc: "Landscape reportage and food projects for local businesses.", tag: "Editorial" },
        { year: "2024", title: "Animals & daily life", desc: "A series dedicated to rural Southern Italy — the seed of the logo.", tag: "Series" },
        { year: "2026", title: "Niwa.ph", desc: "The portfolio takes shape as an authorial project.", tag: "Today" }
      ]
    },
    contact: {
      eyebrow: "Contact",
      title_a: "Let's",
      title_b: "work together",
      sub: "Tell me about your project — events, portraits, food, animals, landscapes. I reply within 48h.",
      form: {
        name: "Name",
        email: "Email",
        subject: "Project type",
        message: "Tell me what you need",
        submit: "Send request",
        sent: "Message sent — I'll be in touch soon."
      },
      subjects: ["Wedding or event", "Portrait / family", "Reportage / landscape", "Food / commercial", "Animals", "Other"],
      side: {
        email: "Email",
        email_val: "hello@niwa.ph",
        social: "Social",
        location: "Where",
        location_val: "Mercato San Severino (SA), Italy",
        availability: "Availability",
        availability_on: "on",
        availability_val: "Open to new projects",
        availability_off_val: "Not taking new projects"
      },
      rate_limit_max: "5",
      rate_limit_window: "60"
    },
    admin: {
      title: "Admin Panel",
      login_title: "Admin access",
      login_sub: "Enter the password to edit the site.",
      login_password: "Password",
      login_submit: "Enter",
      login_hint: "Demo: use password ‘niwa’",
      login_error: "Wrong password",
      logout: "Sign out",
      welcome: "Welcome, Carmine",
      sections: {
        overview: "Overview",
        media: "Media",
        upload: "Upload",
        categories: "Categories",
        copy: "Site copy",
        about: "About",
        contact: "Contact",
        presets: "Presets"
      },
      tabs: { upload: "Upload", manage: "Manage", presets: "Presets" },
      drop_title: "Drop photos or videos here",
      drop_sub: "or click to select — JPG, PNG, MP4",
      empty: "No media uploaded",
      fields: {
        title: "Title",
        category: "Category",
        description: "Description",
        tags: "Tags",
        type: "Type"
      },
      placeholders: {
        title: "Leave empty for no title",
        description: "Leave empty for no description",
        tags: "Press enter to add"
      },
      preset_title: "Preset / Look",
      adjustments: "Adjustments",
      sliders: {
        exposure: "Exposure",
        contrast: "Contrast",
        saturation: "Saturation",
        warmth: "Warmth",
        grain: "Grain",
        vignette: "Vignette",
        fade: "Fade"
      },
      reset: "Reset",
      save: "Save",
      uploaded: "Uploaded",
      seed: "Load samples"
    }
  }
};

// Categories — keys map to translated labels
window.NIWA_CATEGORIES = {
  weddings: { it: "Matrimoni & Eventi", en: "Weddings & Events" },
  nature:   { it: "Paesaggi & Natura",  en: "Landscapes & Nature" },
  animals:  { it: "Animali",             en: "Animals" },
  food:     { it: "Food",                en: "Food" },
  portrait: { it: "Ritratti",            en: "Portraits" },
  street:   { it: "Reportage",           en: "Reportage" }
};

// Filter Look presets — applied via CSS filters
window.NIWA_PRESETS = {
  none:     { label: { it: "Nessuno",     en: "None"      }, exposure: 0, contrast: 0, saturation: 0, warmth: 0, grain: 0, vignette: 0, fade: 0 },
  niwa:     { label: { it: "Niwa Signature",   en: "Niwa Signature"   }, exposure: 5, contrast: 12, saturation: -8, warmth: 18, grain: 12, vignette: 18, fade: 6 },
  warm:     { label: { it: "Caldo",       en: "Warm"      }, exposure: 4, contrast: 8,  saturation: 6,  warmth: 30, grain: 6, vignette: 8, fade: 0 },
  matte:    { label: { it: "Matte film",  en: "Matte film"}, exposure: 6, contrast: -8, saturation: -10, warmth: 8, grain: 18, vignette: 12, fade: 22 },
  bw:       { label: { it: "B/N",         en: "B&W"       }, exposure: 2, contrast: 18, saturation: -100, warmth: 0, grain: 14, vignette: 14, fade: 0 },
  airy:     { label: { it: "Arioso",      en: "Airy"      }, exposure: 12, contrast: -4, saturation: -6, warmth: 4, grain: 4, vignette: -8, fade: 14 },
  cinema:   { label: { it: "Cinema",      en: "Cinema"    }, exposure: -4, contrast: 22, saturation: -14, warmth: -10, grain: 16, vignette: 24, fade: 4 }
};

window.NIWA_PRESET_KEYS = ["none", "niwa", "warm", "matte", "bw", "airy", "cinema"];

// Build CSS filter string from adjustments
window.niwaFilterStr = function(adj) {
  if (!adj) return "none";
  const exposure   = (adj.exposure   ?? 0);
  const contrast   = (adj.contrast   ?? 0);
  const saturation = (adj.saturation ?? 0);
  const warmth     = (adj.warmth     ?? 0);
  const fade       = (adj.fade       ?? 0);
  // brightness 1+exposure/100, contrast 1+contrast/100, saturate 1+sat/100, sepia for warmth
  const b = 1 + exposure / 100;
  const c = 1 + contrast / 100;
  const s = Math.max(0, 1 + saturation / 100);
  const sep = Math.max(0, warmth / 100); // 0..0.4 typical
  // fade reduces contrast, lifts blacks via brightness
  const fadeC = 1 - fade / 200;
  const fadeB = 1 + fade / 400;
  return `brightness(${(b * fadeB).toFixed(3)}) contrast(${(c * fadeC).toFixed(3)}) saturate(${s.toFixed(3)}) sepia(${sep.toFixed(3)})`;
};

// Trasforma URL esterne in URL via proxy (gli endpoint /api/proxy_asset.php
// scaricano la risorsa lato server). Le URL relative restano invariate.
// Definita qui in data.js (script sincrono) per essere disponibile prima che
// qualsiasi script <text/babel> venga compilato/eseguito.
// Secondo argomento: larghezza desiderata in px (400, 800 o 1600).
// Le foto in /uploads/ passano da /api/thumb.php, che le ridimensiona e le
// mette in cache: gli originali sono da 5-14 MB e non servono a nessuno.
window.niwaAssetUrl = function(url, w) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) {
    return "/api/proxy_asset.php?url=" + encodeURIComponent(url);
  }
  if (/^\/uploads\/photos\//i.test(url)) {
    return "/api/thumb.php?w=" + (w || 1600) + "&src=" + encodeURIComponent(url);
  }
  return url;
};

// Demo seed media: uses Unsplash source URLs that map to Carmine's genres
window.NIWA_SEED = [
  // Animals
  { id: "s1", type: "photo", category: "animals", title: { it: "Cortile", en: "Backyard" }, desc: { it: "Una mattina con le galline.", en: "A morning with the hens." }, tags: ["gallina", "campagna", "alba"], src: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=1400&q=80", aspect: "tall", preset: "niwa", adj: {} },
  { id: "s2", type: "photo", category: "animals", title: { it: "Sguardo", en: "Gaze" }, desc: { it: "", en: "" }, tags: ["ritratto", "animali"], src: "https://images.unsplash.com/photo-1518882570152-251e289fc60a?w=1400&q=80", aspect: "sq", preset: "warm", adj: {} },
  // Nature / landscape
  { id: "s3", type: "photo", category: "nature", title: { it: "Costa d'Amalfi", en: "Amalfi coast" }, desc: { it: "Tramonto sulla costiera.", en: "Sundown over the coast." }, tags: ["paesaggio", "tramonto", "campania"], src: "https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=1600&q=80", aspect: "wide", preset: "matte", adj: {} },
  { id: "s4", type: "photo", category: "nature", title: { it: "", en: "" }, desc: { it: "", en: "" }, tags: ["bosco"], src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80", aspect: "tall", preset: "cinema", adj: {} },
  { id: "s5", type: "photo", category: "nature", title: { it: "Vesuvio", en: "Vesuvius" }, desc: { it: "All'orizzonte da Cilento.", en: "On the horizon from Cilento." }, tags: ["paesaggio", "italia"], src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80", aspect: "pano", preset: "airy", adj: {} },
  // Weddings
  { id: "s6", type: "photo", category: "weddings", title: { it: "Promessa", en: "Vow" }, desc: { it: "", en: "" }, tags: ["matrimonio"], src: "https://images.unsplash.com/photo-1519741497674-611481863552?w=1400&q=80", aspect: "port", preset: "warm", adj: {} },
  { id: "s7", type: "photo", category: "weddings", title: { it: "Brindisi", en: "Toast" }, desc: { it: "Ricevimento al tramonto.", en: "Reception at sundown." }, tags: ["matrimonio", "evento"], src: "https://images.unsplash.com/photo-1530023367847-a683933f4172?w=1400&q=80", aspect: "sq", preset: "niwa", adj: {} },
  { id: "s8", type: "photo", category: "weddings", title: { it: "", en: "" }, desc: { it: "", en: "" }, tags: ["matrimonio", "fiori"], src: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1400&q=80", aspect: "tall", preset: "matte", adj: {} },
  // Food
  { id: "s9", type: "photo", category: "food", title: { it: "Pomodoro", en: "Tomato" }, desc: { it: "Insalata di fine estate.", en: "Late summer salad." }, tags: ["food", "still life"], src: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1200&q=80", aspect: "sq", preset: "niwa", adj: {} },
  { id: "s10", type: "photo", category: "food", title: { it: "Pasta", en: "Pasta" }, desc: { it: "", en: "" }, tags: ["food"], src: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=1400&q=80", aspect: "wide", preset: "warm", adj: {} },
  // Portrait
  { id: "s11", type: "photo", category: "portrait", title: { it: "Marta", en: "Marta" }, desc: { it: "", en: "" }, tags: ["ritratto"], src: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1200&q=80", aspect: "port", preset: "cinema", adj: {} },
  // Video samples (using public sample mp4s)
  { id: "v1", type: "video", category: "weddings", title: { it: "Highlights matrimonio", en: "Wedding highlights" }, desc: { it: "", en: "" }, tags: ["matrimonio", "video"], src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4", poster: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1400&q=80", aspect: "wide", preset: "niwa", adj: {} },
  { id: "v2", type: "video", category: "nature", title: { it: "Costa al mattino", en: "Coast at morning" }, desc: { it: "", en: "" }, tags: ["natura", "mare"], src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", poster: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1400&q=80", aspect: "sq", preset: "cinema", adj: {} },
  { id: "v3", type: "video", category: "food", title: { it: "", en: "" }, desc: { it: "", en: "" }, tags: ["food"], src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4", poster: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=1200&q=80", aspect: "tall", preset: "warm", adj: {} }
];