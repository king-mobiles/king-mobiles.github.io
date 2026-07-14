// Safety fallback in case firebase.js fails or is loaded out of order
if (typeof window.getWebsiteData === "undefined") {
  window.getWebsiteData = async function (documentName) {
    console.warn(
      `getWebsiteData called before firebase.js loaded. Returning null for ${documentName}.`,
    );
    return null;
  };
}

/* ─────────────────────────────
 NAV SCROLL
───────────────────────────── */
var navbar = document.getElementById("navbar");
window.addEventListener(
  "scroll",
  function () {
    if (window.scrollY > 60) navbar.classList.add("scrolled");
    else navbar.classList.remove("scrolled");
  },
  { passive: true },
);

/* ─────────────────────────────
 HAMBURGER & MOBILE NAV
───────────────────────────── */
var hamburger = document.getElementById("hamburger");
var navMobile = document.getElementById("nav-mobile");

function syncMobileNavPosition() {
  if (!navMobile || !navbar) return;
  var navbarRect = navbar.getBoundingClientRect();
  navMobile.style.top = navbarRect.bottom + "px";
  navMobile.style.maxHeight = "calc(100vh - " + navbarRect.bottom + "px)";
}

hamburger.addEventListener("click", function () {
  syncMobileNavPosition();
  navMobile.classList.toggle("open");
});

document.querySelectorAll(".nav-m-link").forEach(function (link) {
  link.addEventListener("click", function () {
    navMobile.classList.remove("open");
  });
});

window.addEventListener("resize", function () {
  if (navMobile.classList.contains("open")) syncMobileNavPosition();
});

// Expose syncMobileNavPosition globally so animations.js can call it for banner close callbacks
window.syncMobileNavPosition = syncMobileNavPosition;

/* ─────────────────────────────
 SERVICES SECTION DYNAMIC LOADING & SELECTION
───────────────────────────── */
function initServices() {
  const servicesContainer = document.getElementById("services-list-container");
  const detailContent = document.getElementById("service-detail-content");
  const serviceImg = document.getElementById("service-img");
  const servicePlaceholder = document.getElementById("service-img-placeholder");
  const serviceTitle = document.getElementById("service-title");
  const serviceDesc = document.getElementById("service-desc");
  const serviceBadges = document.getElementById("service-sim-badges");
  const serviceWaBtn = document.getElementById("service-wa-btn");

  if (!servicesContainer) return;

  // Fallback data in JSON format for offline/file:// protocol execution to bypass CORS restrictions
  const fallbackData = {
    default: {
      title: "Fast, Reliable & Honest Repair Service",
      description:
        "Our experienced technicians handle all brands and models. We diagnose accurately, quote transparently, and repair quickly — usually same day for most issues.",
      image: "assets/images/service_default.png",
      waMessage: "Hello King Mobiles, I need a mobile repair service...",
      showBadges: false,
    },
    services: [
      {
        id: "repair",
        name: "Mobile Repair",
        title: "Mobile Repair",
        description:
          "Professional repair services for all hardware issues including charging port fixes, battery replacements, microphone repairs, speaker changes, and motherboard issues. We use premium replacement parts and offer warranty.",
        image: "assets/images/service_repair.png",
        waMessage: "Hello King Mobiles, I need a mobile repair service...",
        showBadges: false,
      },
      {
        id: "screen",
        name: "Screen Replacement",
        title: "Screen Replacement",
        description:
          "High-quality screen replacements for all smartphone brands. We resolve issues like cracked glass, unresponsive touch screens, black screens, or display bleeding. Includes a free tempered glass!",
        image: "assets/images/service_screen.png",
        waMessage: "Hello King Mobiles, I need a screen replacement service...",
        showBadges: false,
      },
      {
        id: "glass",
        name: "Tempered Glass Replacement",
        title: "Tempered Glass Replacement",
        description:
          "Premium 9H hardness tempered glass installation to protect your display from drops and scratches. We ensure bubble-free application with precise fit for all models.",
        image: "assets/images/service_glass.png",
        waMessage: "Hello King Mobiles, I need a tempered glass replacement...",
        showBadges: false,
      },
      {
        id: "software",
        name: "Software Flashing & Change",
        title: "Software Flashing & Change",
        description:
          "Fix bootloops, system lag, and software errors with official firmware flashing. We also assist with OS updates, data backup, and resolving software glitches.",
        image: "assets/images/service_software.png",
        waMessage: "Hello King Mobiles, I need a software flashing service...",
        showBadges: false,
      },
      {
        id: "unlocking",
        name: "Mobile Unlocking",
        title: "Mobile Unlocking",
        description:
          "Safe and secure mobile unlocking for pattern, PIN, password, or network/carrier locks. Get access to your phone or use it with any carrier worldwide.",
        image: "assets/images/service_unlocking.png",
        waMessage: "Hello King Mobiles, I need a mobile unlocking service...",
        showBadges: false,
      },
      {
        id: "sim",
        name: "New SIM Card Activation",
        title: "New SIM Card Activation",
        description:
          "Get a new prepaid or postpaid SIM card activated instantly. We support Airtel, Jio, and Vi with quick Aadhaar-based digital KYC process.",
        image: "assets/images/service_sim.png",
        waMessage: "Hello King Mobiles, I want to activate a new SIM card...",
        showBadges: true,
      },
      {
        id: "porting",
        name: "SIM Operator Change",
        title: "SIM Operator Change",
        description:
          "Switch your current mobile operator to Airtel, Jio, or Vi without changing your mobile number. Benefit from exciting port-in offers and high-speed data plans.",
        image: "assets/images/service_porting.png",
        waMessage:
          "Hello King Mobiles, I want to port my SIM to another operator...",
        showBadges: true,
      },
      {
        id: "dth",
        name: "Sundirect DTH Recharge",
        title: "Sundirect DTH Recharge",
        description:
          "Quick and hassle-free Sundirect DTH recharging services. Renew your monthly packs, add channels, or upgrade packages instantly in-store or via WhatsApp.",
        image: "assets/images/service_dth.png",
        waMessage: "Hello King Mobiles, I want to recharge my Sundirect DTH...",
        showBadges: false,
      },
    ],
  };

  // Set up image load helper
  serviceImg.onload = function () {
    serviceImg.style.display = "block";
    servicePlaceholder.style.display = "none";
  };

  serviceImg.onerror = function () {
    serviceImg.style.display = "none";
    servicePlaceholder.style.display = "flex";
  };

  let activeServiceId = null;
  let previousActiveServiceId = null;
  let servicesData = fallbackData;

  // Attempt to load from external JSON
  getWebsiteData("services")
    .then((data) => {
      if (data) {
        servicesData = data;
      }
      renderUI();
    })
    .catch((err) => {
      console.error(err);
      renderUI();
    });

  function renderUI() {
    servicesContainer.innerHTML = "";
    servicesData.services.forEach((service) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "service-item";
      itemDiv.setAttribute("data-service", service.id);
      itemDiv.innerHTML = `
        <div class="service-dot"></div>
        <div class="service-name">${service.name}</div>
      `;

      itemDiv.addEventListener("click", () => {
        handleServiceSelection(service.id);
      });

      servicesContainer.appendChild(itemDiv);
    });

    // Show default item on start
    updateDetailPanel(servicesData.default);
  }

  function handleServiceSelection(serviceId) {
    const items = servicesContainer.querySelectorAll(".service-item");
    const clickedItem = Array.from(items).find(
      (el) => el.getAttribute("data-service") === serviceId,
    );

    previousActiveServiceId = activeServiceId;

    if (activeServiceId === serviceId) {
      // Deselect
      activeServiceId = null;
      items.forEach((el) => el.classList.remove("active"));
      triggerTransition(servicesData.default, null);
    } else {
      // Select new
      activeServiceId = serviceId;
      items.forEach((el) => {
        if (el.getAttribute("data-service") === serviceId) {
          el.classList.add("active");
        } else {
          el.classList.remove("active");
        }
      });
      const selectedService = servicesData.services.find(
        (s) => s.id === serviceId,
      );
      triggerTransition(selectedService, clickedItem);
    }
  }

  function triggerTransition(data, targetItem) {
    if (window.animateServiceTransition) {
      window.animateServiceTransition(
        data,
        targetItem,
        previousActiveServiceId,
        servicesContainer,
        detailContent,
        updateDetailPanel,
      );
    } else {
      updateDetailPanel(data);
    }
  }

  function updateDetailPanel(data) {
    // Update image
    if (data.image) {
      serviceImg.src = data.image;
      // Trigger onload manually in case it was already loaded/cached
      if (serviceImg.complete) {
        serviceImg.onload();
      }
    } else {
      serviceImg.style.display = "none";
      servicePlaceholder.style.display = "flex";
    }

    // Update texts
    serviceTitle.textContent = data.title;
    serviceDesc.textContent = data.description;

    // Update badges
    if (data.showBadges) {
      serviceBadges.style.display = "flex";
    } else {
      serviceBadges.style.display = "none";
    }

    // Update WhatsApp link
    const phone = window.shopWhatsappNumber || "917339480350";
    const encodedText = encodeURIComponent(data.waMessage);
    serviceWaBtn.href = `https://wa.me/${phone}?text=${encodedText}`;
  }
}

// Expose globally
window.initServices = initServices;

/* ─────────────────────────────
 WHY CHOOSE US DYNAMIC LOADER
───────────────────────────── */
function initWhy() {
  const sloganEl = document.getElementById("why-slogan");
  const gridContainer = document.getElementById("why-grid-container");
  if (!gridContainer) return;

  const fallbackData = {
    slogan:
      "We don't just sell phones — we build trust with every customer, every day.",
    cards: [
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#D4A017" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>',
        title: "Genuine Products Only",
        desc: "Every product we sell is 100% original, directly from authorised distributors. No duplicates, no compromises.",
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#D4A017" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>',
        title: "Official Brand Partners",
        desc: "Authorised dealer for 7+ premium brands including boAt, itel, Lava, Oraimo, Zebronics, Portronics & HMD Global.",
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#D4A017" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>',
        title: "Expert Mobile Service",
        desc: "Trained technicians for all repairs — software, hardware, screen replacement & more with quick turnaround.",
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#D4A017" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>',
        title: "Screen Replacement",
        desc: "Professional screen and tempered glass replacement for all major brands at honest, transparent prices.",
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#D4A017" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>',
        title: "Accessories Collection",
        desc: "Cases, chargers, earbuds, smartwatches, cables, power banks — everything you need, all under one roof.",
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#D4A017" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>',
        title: "SIM & Recharge Services",
        desc: "New SIM activations for Airtel, Jio & Vi. Sundirect DTH recharge. All operator services at one place.",
      },
    ],
  };

  getWebsiteData("why")
    .then((data) => {
      if (data) {
        renderWhy(data);
      } else {
        renderWhy(fallbackData);
      }
    })
    .catch(() => {
      renderWhy(fallbackData);
    });

  function renderWhy(data) {
    if (sloganEl && data.slogan) {
      sloganEl.textContent = data.slogan;
    }

    gridContainer.innerHTML = "";
    if (data.cards) {
      data.cards.forEach((card) => {
        const cardDiv = document.createElement("div");
        cardDiv.className = "why-card";
        cardDiv.innerHTML = `
          <div class="why-icon">
            ${card.icon}
          </div>
          <div class="why-title">${card.title}</div>
          <div class="why-desc">${card.desc}</div>
        `;
        gridContainer.appendChild(cardDiv);
      });
    }

    // Initialize/start the intersection cards trigger now that they are rendered!
    if (window.initWhyCards) {
      window.initWhyCards();
    }
  }
}

// Expose globally
window.initWhy = initWhy;

/* ─────────────────────────────
 COUNTDOWN TIMERS
───────────────────────────── */
/* ─────────────────────────────
 COUNTDOWN TIMERS & OFFERS LOADER
───────────────────────────── */
function initOffers() {
  const sloganEl = document.getElementById("offers-slogan");
  const gridContainer = document.getElementById("offers-grid-container");
  if (!gridContainer) return;

  const fallbackData = {
    slogan:
      "Grab these deals before they expire. Walk in or WhatsApp us to avail.",
    cards: [
      {
        id: "cd1",
        fire: false,
        badge: "Limited Time",
        badgeClass: "hot",
        title: "Accessories Sale",
        desc: "Get up to 20% off on all mobile accessories — cases, chargers, earbuds & cables.",
        expiresAt: "2026-06-26T18:00:00+05:30",
        showEndDate: true,
        showDateCount: false,
        enabled: true,
        waText:
          "Hello King Mobiles, I want to know about the accessories offer",
        waBtnText: "Avail Offer",
      },
      {
        id: "cd2",
        fire: true,
        badge: "Special Deal",
        badgeClass: "",
        title: "Screen Replacement",
        desc: "Free tempered glass with every screen replacement. Valid on all major brands.",
        expiresAt: "2026-06-21T15:00:00+05:30",
        showEndDate: true,
        showDateCount: false,
        enabled: true,
        waText:
          "Hello King Mobiles, I want to know about the screen replacement offer",
        waBtnText: "Book Now",
      },
      {
        id: "cd3",
        fire: false,
        badge: "Weekend Only",
        badgeClass: "",
        title: "boAt Earbuds Deal",
        desc: "Special weekend pricing on boAt earbuds & TWS earphones. Limited stock available.",
        expiresAt: "2026-06-25T20:00:00+05:30",
        showEndDate: false,
        showDateCount: false,
        enabled: true,
        waText: "Hello King Mobiles, I want to know about the boAt offer",
        waBtnText: "WhatsApp Us",
      },
    ],
  };

  getWebsiteData("offers")
    .then((data) => {
      if (data) {
        renderOffers(data);
      } else {
        renderOffers(fallbackData);
      }
    })
    .catch(() => {
      renderOffers(fallbackData);
    });

  function formatOfferDate(dateString) {
    try {
      const dateObj = new Date(dateString);
      if (isNaN(dateObj.getTime())) return "";
      const options = {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      };
      return dateObj.toLocaleString("en-US", options);
    } catch (e) {
      return "";
    }
  }

  function checkOffersSectionVisibility() {
    const offersSection = document.getElementById("offers");
    if (!offersSection) return;

    // Count visible cards
    const visibleCards = gridContainer.querySelectorAll(".offer-card");
    let hasVisible = false;
    visibleCards.forEach((card) => {
      if (card.style.display !== "none") {
        hasVisible = true;
      }
    });

    if (!hasVisible) {
      offersSection.style.display = "none";
    } else {
      offersSection.style.display = "block";
    }
  }

  function renderOffers(data) {
    if (sloganEl && data.slogan) {
      sloganEl.textContent = data.slogan;
    }

    gridContainer.innerHTML = "";
    if (data.cards) {
      data.cards.forEach((card, index) => {
        // If card is disabled (enabled is false), don't render it at all.
        if (card.enabled === false) {
          return;
        }

        const endTime = new Date(card.expiresAt).getTime();
        const now = Date.now();

        // If the timing has already over, don't show the card at all.
        if (now >= endTime) {
          return;
        }

        // Programmatic year-end detection
        const expDate = new Date(card.expiresAt);
        const isYearEnd = expDate.getMonth() === 11 && expDate.getDate() === 31;
        const isYearRound = card.type === "year_round" || isYearEnd;
        const isSeasonal = card.type === "seasonal";

        const cardDiv = document.createElement("div");
        cardDiv.className = "offer-card";
        cardDiv.setAttribute("data-aos", "fade-up");
        cardDiv.setAttribute("data-aos-delay", (index * 120).toString());

        const fireHtml = card.fire ? `<div class="offer-fire">🔥</div>` : "";
        const badgeClass = card.badgeClass ? ` ${card.badgeClass}` : "";

        // Dynamic badge naming depending on type
        let badgeText = card.badge || "Limited Time";
        if (isYearRound && badgeText === "Limited Time") {
          badgeText = "🏆 Annual Offer";
        } else if (isSeasonal && badgeText === "Limited Time") {
          badgeText = "⚡ Season Deal";
        }

        const phone = window.shopWhatsappNumber || "917339480350";
        const encodedText = encodeURIComponent(card.waText);
        const waUrl = `https://wa.me/${phone}?text=${encodedText}`;

        // Dynamic End Date Display (hide for year-round/seasonal specials unless requested)
        let endDateHtml = "";
        if (card.showEndDate && !isYearRound && !isSeasonal) {
          const formattedDate = formatOfferDate(card.expiresAt);
          if (formattedDate) {
            endDateHtml = `<div class="offer-end-date" style="font-size: 0.8rem; color: var(--gold); margin: -0.5rem 0 1rem 0; text-align: start; font-weight: 500; opacity: 0.9;">Ends: ${formattedDate}</div>`;
          }
        }

        // Timer Area / Static Badges display mode
        let timerHtml = "";
        if (isYearRound) {
          timerHtml = `
            <div class="countdown" id="countdown-${card.id}"></div>
            <div class="year-round-badge" style="font-size: 0.82rem; font-weight: 700; color: var(--gold); background: rgba(212, 160, 23, 0.1); border: 1px dashed rgba(212, 160, 23, 0.3); border-radius: var(--radius-sm); padding: 8px 12px; margin: 0.75rem 0; text-transform: uppercase; letter-spacing: 0.05em; display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%;">
              <span>✨</span> Year-Round Special
            </div>`;
        } else if (isSeasonal) {
          timerHtml = `<div class="seasonal-badge" style="font-size: 0.82rem; font-weight: 700; color: #ff6b6b; background: rgba(255, 107, 107, 0.1); border: 1px dashed rgba(255, 107, 107, 0.3); border-radius: var(--radius-sm); padding: 8px 12px; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 0.05em; display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%;">
            <span>⚡</span> Season Special Deal
          </div>`;
        } else {
          timerHtml = `<div class="countdown" id="countdown-${card.id}"></div>`;
        }

        cardDiv.innerHTML = `
          ${fireHtml}
          <div class="offer-badge${badgeClass}">${badgeText}</div>
          <div class="offer-title">${card.title}</div>
          <div class="offer-desc">${card.desc}</div>
          ${timerHtml}
          ${endDateHtml}
          <a href="${waUrl}" class="offer-wa dynamic-wa-href" data-wa-text="${card.waText}" target="_blank">${card.waBtnText}</a>
        `;

        gridContainer.appendChild(cardDiv);

        // Start countdown for standard ticking timers and year-round days counters
        if (!isSeasonal) {
          const countdownEl = cardDiv.querySelector(`#countdown-${card.id}`);
          if (countdownEl) {
            startCardCountdown(
              cardDiv,
              countdownEl,
              endTime,
              isYearRound,
              card.showDateCount,
            );
          }
        }
      });
    }

    // Adjust visibility based on active cards loaded
    checkOffersSectionVisibility();

    // Refresh AOS so the new elements get their scroll animations triggered
    if (typeof AOS !== "undefined" && AOS.refresh) {
      AOS.refresh();
    }
  }

  function startCardCountdown(
    cardDiv,
    countdownEl,
    endTime,
    isYearRound,
    showDateCount,
  ) {
    function update() {
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        cardDiv.style.display = "none";
        // Recalculate if we need to hide the section
        checkOffersSectionVisibility();
        // Refresh AOS to update layout
        if (typeof AOS !== "undefined" && AOS.refresh) {
          AOS.refresh();
        }
        clearInterval(intervalId);
        return;
      }

      if (isYearRound) {
        // Show days left counter for year round offer
        const d = Math.ceil(diff / 86400000);
        countdownEl.innerHTML = `
          <div class="cd-block" style="width: 100%; max-width: 185px; margin: 0 auto;"><div class="cd-num">${d}</div><div class="cd-label">DAYS LEFT</div></div>
        `;
      } else if (showDateCount) {
        // Show DAYS/HRS/MIN counter if the admin enabled showDateCount option
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        countdownEl.innerHTML = `
          <div class="cd-block"><div class="cd-num">${String(d).padStart(2, "0")}</div><div class="cd-label">DAYS</div></div>
          <div class="cd-block"><div class="cd-num">${String(h).padStart(2, "0")}</div><div class="cd-label">HRS</div></div>
          <div class="cd-block"><div class="cd-num">${String(m).padStart(2, "0")}</div><div class="cd-label">MIN</div></div>
        `;
      } else {
        // Otherwise, show standard ticking HRS/MIN/SEC counter (hours based countdown)
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        countdownEl.innerHTML = `
          <div class="cd-block"><div class="cd-num">${String(h).padStart(2, "0")}</div><div class="cd-label">HRS</div></div>
          <div class="cd-block"><div class="cd-num">${String(m).padStart(2, "0")}</div><div class="cd-label">MIN</div></div>
          <div class="cd-block"><div class="cd-num">${String(s).padStart(2, "0")}</div><div class="cd-label">SEC</div></div>
        `;
      }
    }

    update();
    const intervalId = setInterval(update, 1000);
  }
}
window.initOffers = initOffers;

/* ─────────────────────────────
 OUR PARTNERS (BRANDS) DYNAMIC LOADER
 ───────────────────────────── */
function initPartners() {
  const sloganEl = document.getElementById("partners-slogan");
  const swiperWrapper = document.getElementById("partners-swiper-wrapper");
  const gridContainer = document.getElementById("partners-grid-container");
  if (!swiperWrapper || !gridContainer) return;

  const fallbackData = {
    slogan:
      "Authorised dealer for India's leading brands — genuine products, official warranty.",
    sliding_images: [
      "assets/images/zebronics-horizontal-logo.png",
      "assets/images/itel-horizontal-logo.png",
      "assets/images/oraimo-horizontal-logo.png",
      "assets/images/portronics-horizontal-logo.png",
      "assets/images/lava-international-horizontal-logo.png",
      "assets/images/hmd-horizontal-logo.png",
      "assets/images/boat-horizontal-logo.png",
    ],
    cards: [
      {
        name: "boAt",
        logo: "assets/images/boat-logo-transparent.png",
        badge: "Official Partner",
      },
      {
        name: "itel",
        logo: "assets/images/itel-logo-transparent.png",
        badge: "Official Partner",
      },
      {
        name: "Zebronics",
        logo: "assets/images/zebronics-white-logo-transparent.png",
        badge: "Official Partner",
      },
      {
        name: "Oraimo",
        logo: "assets/images/oraimo-logo-transparent.png",
        badge: "Official Partner",
      },
      {
        name: "Portronics",
        logo: "assets/images/portronics-logo-transparent.png",
        badge: "Official Partner",
      },
      {
        name: "Lava",
        logo: "assets/images/lava-international-logo-transparent.png",
        badge: "Official Partner",
      },
      {
        name: "HMD Global",
        logo: "assets/images/hmd-logo-transparent.png",
        badge: "Official Partner",
      },
    ],
  };

  getWebsiteData("partners")
    .then((data) => {
      if (data) {
        renderPartners(data);
      } else {
        renderPartners(fallbackData);
      }
    })
    .catch(() => {
      renderPartners(fallbackData);
    });

  function renderPartners(data) {
    if (sloganEl && data.slogan) {
      sloganEl.textContent = data.slogan;
    }

    // Populate swiper slides (sliding_images compiled dynamically from cards if sliderImage is present)
    swiperWrapper.innerHTML = "";
    const slidingImages = [];
    if (data.cards) {
      data.cards.forEach((card) => {
        if (card.sliderImage) {
          slidingImages.push(card.sliderImage);
        }
      });
    }

    const allSlidingImages =
      slidingImages.length > 0 ? slidingImages : data.sliding_images || [];

    if (allSlidingImages.length > 0) {
      // Loop twice to duplicate slides for seamless Swiper looping
      const allImages = [...allSlidingImages, ...allSlidingImages];
      allImages.forEach((imgUrl) => {
        const brandName = imgUrl.split("/").pop().split("-")[0];
        const slideDiv = document.createElement("div");
        slideDiv.className = "swiper-slide brand-slide";
        slideDiv.innerHTML = `
          <img src="${imgUrl}" alt="${brandName} official brand partner" loading="lazy" />
        `;
        swiperWrapper.appendChild(slideDiv);
      });
    }

    // Populate cards grid
    gridContainer.innerHTML = "";
    if (data.cards) {
      data.cards.forEach((card) => {
        const cardDiv = document.createElement("div");
        cardDiv.className = "brand-card";
        cardDiv.innerHTML = `
          <div class="brand-logo-placeholder">
            <img src="${card.logo}" alt="${card.name} Logo" loading="lazy" />
          </div>
          <div class="brand-name">${card.name}</div>
          <div class="brand-badge">${card.badge}</div>
        `;
        gridContainer.appendChild(cardDiv);
      });
    }

    // Append the "More brands coming soon" card
    const comingSoonCard = document.createElement("div");
    comingSoonCard.className = "brand-card";
    comingSoonCard.style.cssText =
      "border: 1px dashed rgba(255, 255, 255, 0.1); background: transparent; justify-content: center;";
    comingSoonCard.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--gray); text-align: center">
        More brands<br />coming soon
      </div>
    `;
    gridContainer.appendChild(comingSoonCard);

    // Initialize Swiper brands now that slides are rendered
    new Swiper(".swiper-brands", {
      loop: true,
      speed: 3000,
      autoplay: {
        delay: 0,
        disableOnInteraction: false,
      },
      slidesPerView: "auto",
      spaceBetween: 0,
      allowTouchMove: false,
      freeMode: true,
      breakpoints: {
        320: { slidesPerView: 3 },
        480: { slidesPerView: 4 },
        768: { slidesPerView: 5 },
        1024: { slidesPerView: 7 },
      },
    });

    if (window.revealBrandCards) {
      window.revealBrandCards();
    }
  }
}

// Expose globally
// Expose globally
window.initPartners = initPartners;

/* ─────────────────────────────
 PRODUCTS SECTION DYNAMIC LOADER
 ───────────────────────────── */
function initProducts() {
  const sloganEl = document.getElementById("products-slogan");
  const gridContainer = document.getElementById("products-grid-container");
  if (!gridContainer) return;

  const fallbackData = {
    slogan:
      "From flagship smartphones to everyday accessories — we have what you need.",
    cards: [
      {
        name: "Smartphones and",
        desc: "Budget to flagship, all major brands",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>',
      },
      {
        name: "Smart Watches",
        desc: "Fitness tracking, notifications & more",
        icon: '<svg viewBox="0 0 500 500"><path d="M 190,10 H 305 c 12,0 20,15 20,30 v 70 c -15,5 -35,15 -50,15 H 220 c -15,0 -35,-10 -50,-15 V 40 c 0,-15 8,-30 20,-30 Z M 190,490 H 305 c 12,0 20,-15 20,-30 v -70 c -15,-5 -35,-15 -50,-15 H 220 c -15,0 -35,10 -50,15 v 60 c 0,30 9,40 30,40 Z" fill="#aaa" /><rect x="90" y="105" width="320" height="290" rx="95" fill="#aaa" /><rect x="404" y="160" width="16" height="45" rx="6" fill="#aaa" /><rect x="404" y="240" width="12" height="65" rx="5" fill="#aaa" /><rect x="108" y="123" width="284" height="254" rx="90" fill="#242424" /></svg>',
      },
      {
        name: "Earbuds",
        desc: "True wireless with great sound quality",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6" /><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" /></svg>',
      },
      {
        name: "Speakers",
        desc: "Portable and home Bluetooth speakers",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2" ry="2" /><circle cx="12" cy="8" r="2" /><circle cx="12" cy="15" r="3.5" /><circle cx="12" cy="15" r="0.5" fill="#aaa" /></svg>',
      },
      {
        name: "Chargers",
        desc: "Fast charging, original & compatible",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="2" x2="9" y2="5" /><line x1="15" y1="2" x2="15" y2="5" /><rect x="6" y="5" width="12" height="10" rx="2" ry="2" /><line x1="10" y1="10" x2="14" y2="10" /><path d="M12 15c0 2-3 1-3 3s4 1 4 3s-3 1-3 2" /></svg>',
      },
      {
        name: "Power Banks",
        desc: "High capacity, lightweight options",
        icon: '<svg viewBox="0 0 500 500"><path d="M 190,110 L 310,110 A 45,45 0 0,1 352,143 L 416,295 A 45,45 0 0,1 393,356 L 107,356 A 45,45 0 0,1 84,295 L 148,143 A 45,45 0 0,1 190,110 Z" fill="#333537" /><rect x="110" y="278" width="280" height="64" rx="32" fill="#ffffff" /><rect x="156" y="299" width="48" height="22" rx="3" fill="#333537" /><path d="M 243,305 H 257 A 6,6 0 0,1 263,311 L 261,317 A 4,4 0 0,1 257,321 H 243 A 4,4 0 0,1 239,317 L 237,311 A 6,6 0 0,1 243,305 Z" fill="#333537" /><rect x="296" y="299" width="48" height="22" rx="3" fill="#333537" /><path d="M 258,148 L 216,233 H 246 L 234,316 L 284,217 H 252 Z" fill="#ffffff" /></svg>',
      },
      {
        name: "Keypad Phones",
        desc: "Feature phones for every budget",
        icon: '<svg viewBox="0 0 500 500"><rect x="100" y="50" width="300" height="415" rx="20" ry="20" fill="#aaa" /><rect x="130" y="80" width="240" height="180" fill="#242424" /><rect x="150" y="100" width="200" height="140" fill="none" stroke="#aaa" stroke-width="4" /><rect x="130" y="280" width="60" height="30" fill="#242424" /><rect x="220" y="280" width="60" height="30" fill="#242424" /><rect x="310" y="280" width="60" height="30" fill="#242424" /><rect x="130" y="325" width="60" height="30" fill="#242424" /><rect x="220" y="325" width="60" height="30" fill="#242424" /><rect x="310" y="325" width="60" height="30" fill="#242424" /><rect x="130" y="370" width="60" height="30" fill="#242424" /><rect x="220" y="370" width="60" height="30" fill="#242424" /><rect x="310" y="370" width="60" height="30" fill="#242424" /><rect x="130" y="415" width="60" height="30" fill="#242424" /><rect x="220" y="415" width="60" height="30" fill="#242424" /><rect x="310" y="415" width="60" height="30" fill="#242424" /></svg>',
      },
      {
        name: "Accessories",
        desc: "Cases, cables, screen guards & more",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>',
      },
    ],
  };

  getWebsiteData("products")
    .then((data) => {
      if (data) {
        renderProducts(data);
      } else {
        renderProducts(fallbackData);
      }
    })
    .catch(() => {
      renderProducts(fallbackData);
    });

  function renderProducts(data) {
    if (sloganEl && data.slogan) {
      sloganEl.textContent = data.slogan;
    }

    gridContainer.innerHTML = "";
    if (data.cards) {
      data.cards.forEach((card) => {
        const cardDiv = document.createElement("div");
        cardDiv.className = "product-card";
        cardDiv.innerHTML = `
          <div class="product-img-wrap">
            ${card.icon}
          </div>
          <div class="product-name">${card.name}</div>
          <div class="product-desc">${card.desc}</div>
        `;
        gridContainer.appendChild(cardDiv);
      });
    }

    if (window.initProductSection) {
      window.initProductSection();
    }
  }
}

// Expose globally
window.initProducts = initProducts;

/* ─────────────────────────────
 ACCESSORIES SECTION DYNAMIC LOADER
 ───────────────────────────── */
function initAccessories() {
  const sloganEl = document.getElementById("accessories-slogan");
  const gridContainer = document.getElementById("accessories-grid-container");
  if (!gridContainer) return;

  const fallbackData = {
    slogan:
      "Complete your mobile experience with our handpicked accessories range.",
    cards: [
      {
        name: "Mobile Cases",
        desc: "Protective covers for all major phone models. Plain, designer & rugged options.",
        image: "assets/images/mobile-case-image.avif",
        alt: "Mobile phone cases",
        waText: "Hello, I need a mobile case",
      },
      {
        name: "Chargers",
        desc: "Fast chargers, travel adapters & wireless charging pads from trusted brands.",
        image: "assets/images/mobile-charger-image.avif",
        alt: "Mobile chargers and adapters",
        waText: "Hello, I need a charger",
      },
      {
        name: "Earbuds & Earphones",
        desc: "TWS earbuds, wired earphones & over-ear headphones from boAt, Zebronics & more.",
        image: "assets/images/earbuds-image.avif",
        alt: "Wireless earbuds and earphones",
        waText: "Hello, I need earbuds",
      },
      {
        name: "Smart Watches",
        desc: "Fitness bands & smartwatches with health tracking, call & notification support.",
        image: "assets/images/smartwatch-image.avif",
        alt: "Smart watches and fitness bands",
        waText: "Hello, I need a smartwatch",
      },
      {
        name: "Power Banks",
        desc: "10000mAh to 20000mAh options with fast charging support. Portable & durable.",
        image: "assets/images/powerbank-image.avif",
        alt: "Portable power banks",
        waText: "Hello, I need a power bank",
      },
      {
        name: "Cables & More",
        desc: "USB-C, Lightning, Micro-USB cables. Screen protectors, OTG adapters & more.",
        image: "assets/images/cables-image.avif",
        alt: "USB cables and mobile accessories",
        waText: "Hello, I need mobile cables",
      },
    ],
  };

  getWebsiteData("accessories")
    .then((data) => {
      if (data) {
        renderAccessories(data);
      } else {
        renderAccessories(fallbackData);
      }
    })
    .catch(() => {
      renderAccessories(fallbackData);
    });

  function renderAccessories(data) {
    if (sloganEl && data.slogan) {
      sloganEl.textContent = data.slogan;
    }

    gridContainer.innerHTML = "";
    if (data.cards) {
      data.cards.forEach((card) => {
        const cardDiv = document.createElement("div");
        cardDiv.className = "acc-card";

        const phone = window.shopWhatsappNumber || "917339480350";
        const encodedText = encodeURIComponent(card.waText);
        const waUrl = `https://wa.me/${phone}?text=${encodedText}`;

        cardDiv.innerHTML = `
          <div class="acc-img">
            <img src="${card.image}" alt="${card.alt}" loading="lazy" />
          </div>
          <div class="acc-body">
            <div class="acc-name">${card.name}</div>
            <div class="acc-sub">${card.desc}</div>
            <a href="${waUrl}" class="acc-btn dynamic-wa-href" data-wa-text="${card.waText}" target="_blank">Enquire →</a>
          </div>
        `;
        gridContainer.appendChild(cardDiv);
      });
    }

    if (window.initAccessoriesSection) {
      window.initAccessoriesSection();
    }
  }
}

// Expose globally
window.initAccessories = initAccessories;

/* ─────────────────────────────
 SWIPER INIT — TESTIMONIALS (REVIEWS)
───────────────────────────── */
const fallbackReviewsData = [
  {
    stars: "★★★★★",
    text: '"Best mobile shop in Uchipuli! Got my screen replaced in under an hour. The staff was very helpful and the price was reasonable. Definitely recommending to everyone."',
    avatar: "RK",
    name: "Ravi Kumar",
    verified: "✓ Verified Customer",
  },
  {
    stars: "★★★★★",
    text: '"Bought a boAt earbuds and they gave me original packaging with all accessories. Very genuine shop. I also got my Jio SIM activated the same day. Great service!"',
    avatar: "PM",
    name: "Priya M.",
    verified: "✓ Verified Customer",
  },
  {
    stars: "★★★★★",
    text: '"My phone had software issue and they fixed it perfectly. Very knowledgeable staff. Good collection of mobiles and accessories. Prices are competitive too."',
    avatar: "SA",
    name: "Senthil A.",
    verified: "✓ Verified Customer",
  },
  {
    stars: "★★★★★",
    text: '"Excellent shop with genuine products. I purchased an itel smartphone and they helped me set it up nicely. After-sales support is also very good."',
    avatar: "MJ",
    name: "Muthu J.",
    verified: "✓ Verified Customer",
  },
  {
    stars: "★★★★★",
    text: '"King Mobiles is my go-to shop for everything mobile. From small accessories to phone repairs — they handle everything professionally. Highly recommended!"',
    avatar: "LV",
    name: "Lakshmi V.",
    verified: "✓ Verified Customer",
  },
];

getWebsiteData("reviews")
  .then((data) => {
    if (data) {
      renderReviews(data.reviews);
    } else {
      renderReviews(fallbackReviewsData);
    }
  })
  .catch(() => {
    renderReviews(fallbackReviewsData);
  });

function renderReviews(data) {
  const reviewsWrapper = document.getElementById("reviews-wrapper");
  if (reviewsWrapper) {
    reviewsWrapper.innerHTML = "";
    data.forEach((review) => {
      const slide = document.createElement("div");
      slide.className = "swiper-slide";
      slide.innerHTML = `
        <div class="review-card">
          <div class="review-stars">${review.stars}</div>
          <div class="review-text">${review.text}</div>
          <div class="review-author">
            <div class="review-avatar">${review.avatar}</div>
            <div>
              <div class="review-name">${review.name}</div>
              <div class="review-verified">${review.verified}</div>
            </div>
          </div>
        </div>
      `;
      reviewsWrapper.appendChild(slide);
    });
  }

  new Swiper(".swiper-reviews", {
    slidesPerView: 1,
    spaceBetween: 24,
    loop: true,
    autoplay: { delay: 4000, disableOnInteraction: false },
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },
    pagination: { el: ".swiper-pagination", clickable: true },
    breakpoints: { 640: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } },
  });
}

/* ─────────────────────────────
 FAQ ACCORDION & LOADER
───────────────────────────── */
function initFaq() {
  const sloganEl = document.getElementById("faq-slogan");
  const listContainer = document.getElementById("faq-list-container");
  if (!listContainer) return;

  const fallbackData = {
    slogan: "Everything you need to know before visiting us.",
    items: [
      {
        question: "Do you sell original and genuine mobile phones?",
        answer:
          "Yes, absolutely. All products at King Mobiles are 100% original and sourced directly from authorised distributors. We do not sell refurbished or duplicate products of any kind.",
      },
      {
        question: "Do you provide screen replacement services?",
        answer:
          "Yes, we provide professional screen replacement for all major brands including Samsung, Redmi, Realme, Oppo, Vivo & more. We also offer free tempered glass installation with every screen replacement.",
      },
      {
        question: "Do you sell original accessories?",
        answer:
          "Yes, we stock original accessories from brands like boAt, Zebronics, Oraimo, Portronics & more. All accessories come with manufacturer warranty and original packaging.",
      },
      {
        question: "Do you support Airtel, Jio and Vi SIM services?",
        answer:
          "Yes, we provide new SIM card activations and operator changes for Airtel, Jio, and Vi (Vodafone Idea). Bring your Aadhaar card for same-day SIM activation.",
      },
      {
        question: "Do you provide Sundirect DTH recharge?",
        answer:
          "Yes, we offer Sundirect DTH recharge services. You can walk in or WhatsApp us your customer ID and preferred plan for quick recharge.",
      },
      {
        question: "Do you provide mobile unlocking services?",
        answer:
          "Yes, we provide mobile unlocking services for network-locked and pattern/PIN-locked phones. Please WhatsApp us with your phone model for a quick quote.",
      },
      {
        question: "Do you offer any warranty on repairs?",
        answer:
          "Yes, we provide a service warranty on all repairs. The duration varies based on the type of repair. Please ask our technician at the time of service for specific warranty details.",
      },
      {
        question: "What are your business hours?",
        answer:
          "We are open every day from 9:00 AM to 9:30 PM. You can also reach us on WhatsApp at any time for queries, and we'll respond during business hours.",
      },
    ],
  };

  getWebsiteData("faq")
    .then((data) => {
      if (data) {
        renderFaq(data);
      } else {
        renderFaq(fallbackData);
      }
    })
    .catch(() => {
      renderFaq(fallbackData);
    });

  function renderFaq(data) {
    if (sloganEl && data.slogan) {
      sloganEl.textContent = data.slogan;
    }

    listContainer.innerHTML = "";
    if (data.items) {
      data.items.forEach((item) => {
        const faqDiv = document.createElement("div");
        faqDiv.className = "faq-item";
        faqDiv.innerHTML = `
          <div class="faq-q">
            <span class="faq-q-text">${item.question}</span><span class="faq-icon">+</span>
          </div>
          <div class="faq-a">
            <div class="faq-a-inner">
              ${item.answer}
            </div>
          </div>
        `;
        listContainer.appendChild(faqDiv);
      });
    }

    // Attach click handlers to newly loaded items
    listContainer.querySelectorAll(".faq-q").forEach(function (q) {
      q.addEventListener("click", function () {
        var item = q.parentElement;
        var answer = item.querySelector(".faq-a");
        var isOpen = item.classList.contains("open");

        listContainer
          .querySelectorAll(".faq-item.open")
          .forEach(function (openItem) {
            openItem.classList.remove("open");
            openItem.querySelector(".faq-a").style.maxHeight = "0";
          });

        if (!isOpen) {
          item.classList.add("open");
          answer.style.maxHeight = answer.scrollHeight + "px";
        }
      });
    });
  }
}
window.initFaq = initFaq;

/* ─────────────────────────────
 CONTACT FORM
───────────────────────────── */
function submitForm() {
  // Obsolete function, form uses submit event listener
}

/* ─────────────────────────────
 CONTACT FORM & SUCCESS POPUP
 ───────────────────────────── */
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("contact-form");
  if (form) {
    const submitBtn = form.querySelector(".form-submit");

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Prevent duplicate submissions
      if (submitBtn.disabled) return;

      // Loading state
      submitBtn.disabled = true;
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="loading-spinner"></span> Sending...';

      // Form data
      const formData = new FormData(form);
      const data = new URLSearchParams(formData);

      try {
        const response = await fetch(
          "https://script.google.com/macros/s/AKfycbzJiiUoYwPGC6gRGuBKRRBQIsxO-pjKeWLqY4NmxJAxevVUl1zmXb7au3LrnVN8rdya/exec",
          {
            method: "POST",
            body: data,
          },
        );

        // Clear form fields
        form.reset();

        // Show premium success popup
        const modal = document.getElementById("contact-success-modal");
        if (modal) {
          modal.classList.add("show");
        }
      } catch (error) {
        console.error("Error submitting contact form:", error);
        alert(
          "Something went wrong. Please try again later or contact us directly on WhatsApp!",
        );
      } finally {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Handle modal backdrop click to close
  const modal = document.getElementById("contact-success-modal");
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        closeSuccessModal();
      }
    });
  }
});

// Close modal helper exposed globally
window.closeSuccessModal = function () {
  const modal = document.getElementById("contact-success-modal");
  if (modal) {
    modal.classList.remove("show");
  }
};

/* ─────────────────────────────
 GALLERY HOVER
───────────────────────────── */
document.querySelectorAll(".gallery-item").forEach(function (item) {
  var overlay = item.querySelector(".gallery-overlay");
  if (overlay) {
    item.addEventListener("mouseenter", function () {
      overlay.style.opacity = "1";
    });
    item.addEventListener("mouseleave", function () {
      overlay.style.opacity = "0";
    });
  }
});

/* ─────────────────────────────
 SMOOTH ANCHOR SCROLL
───────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(function (a) {
  a.addEventListener("click", function (e) {
    var target = document.querySelector(a.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

/* ─────────────────────────────
 EMAIL POPUP INTERACTIVE HANDLER
 ───────────────────────────── */
function initEmailPopup() {
  const trigger = document.getElementById("email-popup-trigger");
  const card = document.getElementById("email-popup-card");
  const copyBtn = document.getElementById("email-popup-copy-btn");

  if (!trigger || !card) return;

  // Toggle popup on click
  trigger.addEventListener("click", function (e) {
    e.stopPropagation();
    card.classList.toggle("show");
  });

  // Prevent closing when clicking inside the card
  card.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  // Close popup when clicking anywhere else
  document.addEventListener("click", function () {
    card.classList.remove("show");
  });

  // Copy to clipboard functionality
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      const addressEl = card.querySelector(".email-popup-address");
      if (!addressEl) return;

      const emailText = addressEl.textContent || "kingmobiles@gmail.com";

      navigator.clipboard
        .writeText(emailText.trim())
        .then(() => {
          copyBtn.classList.add("copied");

          const originalTitle = copyBtn.getAttribute("title");
          copyBtn.setAttribute("title", "Copied!");

          const originalSvg = copyBtn.innerHTML;
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;

          setTimeout(() => {
            copyBtn.classList.remove("copied");
            copyBtn.setAttribute("title", originalTitle || "Copy Email");
            copyBtn.innerHTML = originalSvg;
          }, 2000);
        })
        .catch((err) => {
          console.error("Could not copy text: ", err);
        });
    });
  }
}

initEmailPopup();

/* ─────────────────────────────
 GALLERY SECTION DYNAMIC LOADER
 ───────────────────────────── */
function initGallery() {
  const container = document.getElementById("gallery-masonry-container");
  if (!container) return;

  const fallbackData = {
    cards: [
      {
        image: "assets/images/king-mobiles-and-communications-front-view.jpg",
        title: "Store Front — Uchipuli",
        heightClass: "h1",
      },
      {
        image: "assets/images/king-mobiles-and-communications-front-view.jpg",
        title: "Smartphone Showroom",
        heightClass: "h2",
      },
      {
        image: "",
        title: "Premium Accessories Rack",
        heightClass: "h3",
      },
      {
        image: "",
        title: "Expert Service Center",
        heightClass: "h2",
      },
      {
        image: "",
        title: "Friendly Customer Service",
        heightClass: "h4",
      },
    ],
  };

  getWebsiteData("gallery")
    .then((data) => {
      if (data) {
        renderGallery(data);
      } else {
        renderGallery(fallbackData);
      }
    })
    .catch(() => {
      renderGallery(fallbackData);
    });

  function renderGallery(data) {
    container.innerHTML = "";
    if (data.cards) {
      data.cards.forEach((card, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "m-item";
        itemDiv.setAttribute("data-aos", "fade-up");
        itemDiv.setAttribute("data-aos-delay", (index * 100).toString());

        let imgHtml = "";
        if (card.image) {
          imgHtml = `<img src="${card.image}" alt="${card.title || "Gallery Image"}" class="m-img ${card.heightClass || ""}" loading="lazy">`;
        } else {
          const placeholderText = card.title
            ? card.title.toUpperCase()
            : `IMAGE ${index + 1}`;
          imgHtml = `<div class="m-img ${card.heightClass || ""}">${placeholderText}</div>`;
        }

        itemDiv.innerHTML = `
          ${imgHtml}
          <div class="m-overlay">${card.title || ""}</div>
        `;
        container.appendChild(itemDiv);
      });
    }

    if (typeof AOS !== "undefined" && AOS.refresh) {
      AOS.refresh();
    }
  }
}
window.initGallery = initGallery;

/* ─────────────────────────────
 DYNAMIC OFFER BANNER TICKER LOADER
 ───────────────────────────── */
function initOfferBanner() {
  const bannerEl = document.getElementById("offer-banner");
  const navbarEl = document.getElementById("navbar");
  const bodyEl = document.body;
  const tickerEl = document.getElementById("ticker");
  if (!bannerEl || !tickerEl) return;

  const fallbackData = {
    enabled: true,
    items: [
      { text: "Weekend Offer — Accessories up to 20% Off" },
      { text: "Free Tempered Glass on all Screen Replacements" },
      { text: "Authorised dealer for Zebronics, Oraimo, Itel, HMD & more" },
      { text: "All products are 100% Original & Genuine" },
    ],
  };

  getWebsiteData("offer-banner")
    .then((data) => {
      const bannerData = data || fallbackData;
      renderBanner(bannerData);
    })
    .catch(() => {
      renderBanner(fallbackData);
    });

  function renderBanner(data) {
    if (!data.enabled) {
      bannerEl.style.display = "none";
      if (navbarEl) navbarEl.style.top = "0";
      if (bodyEl) bodyEl.style.paddingTop = "68px";
      return;
    }

    // Set layout parameters when enabled
    bannerEl.style.display = "block";
    if (navbarEl) navbarEl.style.top = "40px";
    if (bodyEl) bodyEl.style.paddingTop = "110px";

    tickerEl.innerHTML = "";
    if (data.items && data.items.length > 0) {
      // Loop twice for seamless scrolling
      const allItems = [...data.items, ...data.items];
      allItems.forEach((item) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "ticker-item";
        itemDiv.innerHTML = `
          <span class="ticker-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="#D4A017">
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
            </svg>
          </span>
          <span>${item.text}</span>
        `;
        tickerEl.appendChild(itemDiv);
      });
    }
  }
}
window.initOfferBanner = initOfferBanner;
document.getElementById("currentYear").textContent = new Date().getFullYear();
