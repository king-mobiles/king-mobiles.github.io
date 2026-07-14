/* ─────────────────────────────
 LOADER & INIT
 ───────────────────────────── */
document.addEventListener("DOMContentLoaded", function () {
  const tl = gsap.timeline({
    onComplete: function () {
      gsap.to("#loader", {
        opacity: 0,
        duration: 0.2,
        ease: "power2.inOut",
        onComplete: function () {
          const loader = document.getElementById("loader");
          if (loader) loader.style.display = "none";
          document.body.style.overflow = "";
          initHero();
        },
      });
    },
  });
  document.body.style.overflow = "hidden";
  tl.to(
    "#loader-king",
    { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" },
    0.1,
  )
    .to(
      "#loader-line",
      { width: "100%", duration: 0.3, ease: "power2.inOut" },
      0.3,
    )
    .to(
      "#loader-mobiles",
      { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" },
      0.4,
    )
    .to(
      "#loader-tagline",
      { opacity: 1, duration: 0.2, ease: "power2.out" },
      0.6,
    )
    .to({}, { duration: 0.2 }, 1.2);
});

/* ─────────────────────────────
 HERO ANIMATIONS
───────────────────────────── */
function initHero() {
  gsap.to("#h-eyebrow", {
    opacity: 1,
    y: 0,
    duration: 0.7,
    ease: "power3.out",
    delay: 0.1,
  });
  gsap.to("#h-heading", {
    opacity: 1,
    y: 0,
    duration: 0.8,
    ease: "power3.out",
    delay: 0.3,
  });
  gsap.to("#h-sub", {
    opacity: 1,
    y: 0,
    duration: 0.7,
    ease: "power3.out",
    delay: 0.5,
  });
  gsap.to("#h-ctas", {
    opacity: 1,
    y: 0,
    duration: 0.6,
    ease: "power3.out",
    delay: 0.65,
  });
  gsap.to("#h-trust", {
    opacity: 1,
    y: 0,
    duration: 0.6,
    ease: "power3.out",
    delay: 0.8,
  });

  initThree();

  AOS.init({
    once: true,
    offset: 80,
    duration: 650,
    easing: "ease-out-cubic",
  });

  if (window.initWhy) {
    window.initWhy();
  }

  if (window.initPartners) {
    window.initPartners();
  }

  if (window.initProducts) {
    window.initProducts();
  }

  if (window.initAccessories) {
    window.initAccessories();
  }

  initBrandSection();
  initProductSection();
  initAccessoriesSection();

  if (window.initOfferBanner) {
    window.initOfferBanner();
  }

  if (window.initServices) {
    window.initServices();
  }

  if (window.initOffers) {
    window.initOffers();
  }

  if (window.initGallery) {
    window.initGallery();
  }

  if (window.initFaq) {
    window.initFaq();
  }
}

/* ─────────────────────────────
 INTERSECTION OBSERVERS FOR CARDS/SECTIONS
 ───────────────────────────── */
function initWhyCards() {
  var whySection = document.getElementById("why");
  if (!whySection) return;

  var revealed = false;
  function revealCards() {
    if (revealed) return;
    var whyCards = whySection.querySelectorAll(".why-card");
    if (whyCards.length === 0) return;
    revealed = true;
    whyCards.forEach(function (card, index) {
      window.setTimeout(function () {
        card.classList.add("why-card-visible");
      }, index * 140);
    });
  }

  var whyObserver = new IntersectionObserver(
    function (entries) {
      if (!entries[0].isIntersecting) return;
      revealCards();
      if (revealed) whyObserver.disconnect();
    },
    { threshold: 0.05, rootMargin: "50px" },
  );

  whyObserver.observe(whySection);

  window.setTimeout(function () {
    revealCards();
    if (revealed) whyObserver.disconnect();
  }, 2500);
}
window.initWhyCards = initWhyCards;

function initBrandSection() {
  var brandsSection = document.getElementById("brands");
  if (!brandsSection) return;

  var carouselWrap = brandsSection.querySelector(".brands-carousel-wrap");
  var revealed = false;

  function revealBrands() {
    if (revealed) return;
    var brandCards = brandsSection.querySelectorAll(".brand-card");
    if (brandCards.length === 0) return;
    revealed = true;

    if (carouselWrap) {
      window.setTimeout(function () {
        carouselWrap.classList.add("brand-section-visible");
      }, 0);
    }

    brandCards.forEach(function (card, index) {
      window.setTimeout(
        function () {
          card.classList.add("brand-card-visible");
        },
        180 + index * 120,
      );
    });
  }

  // Expose reveal function globally for immediate trigger in main.js
  window.revealBrandCards = revealBrands;

  var brandsObserver = new IntersectionObserver(
    function (entries) {
      if (!entries[0].isIntersecting) return;
      revealBrands();
      if (revealed) brandsObserver.disconnect();
    },
    { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
  );

  brandsObserver.observe(brandsSection);

  // Fallback timeout in case observer fires before database loads
  window.setTimeout(function () {
    revealBrands();
    if (revealed) brandsObserver.disconnect();
  }, 2500);
}

function initProductSection() {
  var productsSection = document.getElementById("products");
  if (!productsSection) return;

  var revealed = false;
  function revealCards() {
    if (revealed) return;
    var productCards = productsSection.querySelectorAll(".product-card");
    if (productCards.length === 0) return;
    revealed = true;
    productCards.forEach(function (card, index) {
      window.setTimeout(function () {
        card.classList.add("product-card-visible");
      }, index * 120);
    });
  }

  var productsObserver = new IntersectionObserver(
    function (entries) {
      if (!entries[0].isIntersecting) return;
      revealCards();
      if (revealed) productsObserver.disconnect();
    },
    { threshold: 0.05, rootMargin: "50px" },
  );

  productsObserver.observe(productsSection);

  window.setTimeout(function () {
    revealCards();
    if (revealed) productsObserver.disconnect();
  }, 2500);
}
window.initProductSection = initProductSection;

function initAccessoriesSection() {
  var accessoriesSection = document.getElementById("accessories");
  if (!accessoriesSection) return;

  var revealed = false;
  function revealCards() {
    if (revealed) return;
    var accessoryCards = accessoriesSection.querySelectorAll(".acc-card");
    if (accessoryCards.length === 0) return;
    revealed = true;
    accessoryCards.forEach(function (card, index) {
      window.setTimeout(function () {
        card.classList.add("acc-card-visible");
      }, index * 120);
    });
  }

  var accessoriesObserver = new IntersectionObserver(
    function (entries) {
      if (!entries[0].isIntersecting) return;
      revealCards();
      if (revealed) accessoriesObserver.disconnect();
    },
    { threshold: 0.05, rootMargin: "50px" },
  );

  accessoriesObserver.observe(accessoriesSection);

  window.setTimeout(function () {
    revealCards();
    if (revealed) accessoriesObserver.disconnect();
  }, 2500);
}
window.initAccessoriesSection = initAccessoriesSection;

/* ─────────────────────────────
 SERVICES SLIDE-IN TRANSITIONS
───────────────────────────── */
window.animateServiceTransition = function (
  data,
  targetItem,
  previousActiveServiceId,
  servicesContainer,
  detailContent,
  updateDetailPanel,
) {
  // Calculate offset of the previous active item
  let exitYDiff = 0;
  if (previousActiveServiceId) {
    const prevItemEl = servicesContainer.querySelector(
      `.service-item[data-service="${previousActiveServiceId}"]`,
    );
    if (prevItemEl) {
      const rectItem = prevItemEl.getBoundingClientRect();
      const rectDetail = detailContent.getBoundingClientRect();
      exitYDiff =
        rectItem.top +
        rectItem.height / 2 -
        (rectDetail.top + rectDetail.height / 2);
    }
  }

  // Apply exit animation:
  detailContent.style.transition =
    "opacity 0.22s cubic-bezier(0.25, 1, 0.5, 1), transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)";
  detailContent.style.opacity = "0";

  if (targetItem === null) {
    // Deselect: Slide-out towards the active item to the left
    detailContent.style.transform = `translate(-100px, ${exitYDiff}px) scale(0.95)`;
  } else {
    // Item change: Just fade out in-place (no horizontal slide-out)
    detailContent.style.transform = "scale(0.98)";
  }

  setTimeout(() => {
    // Update contents while invisible
    updateDetailPanel(data);

    // Calculate offset of the new target item to slide-in from it
    let entryYDiff = 0;
    if (targetItem) {
      const rectItem = targetItem.getBoundingClientRect();
      const rectDetail = detailContent.getBoundingClientRect();
      entryYDiff =
        rectItem.top +
        rectItem.height / 2 -
        (rectDetail.top + rectDetail.height / 2);
    }

    // Disable transition to instantly position at starting point
    detailContent.style.transition = "none";
    detailContent.style.opacity = "0";
    detailContent.style.transform = `translate(-100px, ${entryYDiff}px) scale(0.95)`;
    detailContent.style.transformOrigin = "left center";

    // Force reflow
    detailContent.offsetHeight;

    // Enable transition and animate in to center with premium easing
    detailContent.style.transition =
      "opacity 0.48s cubic-bezier(0.16, 1, 0.3, 1), transform 0.48s cubic-bezier(0.16, 1, 0.3, 1)";
    detailContent.style.opacity = "1";
    detailContent.style.transform = "translate(0, 0) scale(1)";
  }, 220);
};

/* ─────────────────────────────
 STATS COUNTER ANIMATION
───────────────────────────── */
function animateCounter(el) {
  var target = parseInt(el.dataset.target);
  var suffix = el.dataset.suffix || "";
  var start = 0;
  var duration = 2000;
  var startTime = null;

  function step(ts) {
    if (!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var val = Math.round(eased * target);
    el.textContent = val + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target + suffix;
  }
  requestAnimationFrame(step);
}
window.animateCounter = animateCounter;

window.countersDone = false;
var statsSection = document.getElementById("stats");
var counterObserver = new IntersectionObserver(
  function (entries) {
    if (entries[0].isIntersecting && !window.countersDone) {
      window.countersDone = true;
      document.querySelectorAll(".stat-num").forEach(function (el) {
        animateCounter(el);
      });
    }
  },
  { threshold: 0.3 },
);
if (statsSection) {
  counterObserver.observe(statsSection);
}

/* ─────────────────────────────
 HERO PARTICLE FIELD (LIGHTWEIGHT 2D CANVAS)
 ───────────────────────────── */
function initThree() {
  if (window.matchMedia("(max-width: 768px)").matches) return;
  var canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var particles = [];
  var count = 100;
  var animId;

  var width = (canvas.width = window.innerWidth);
  var height = (canvas.height = window.innerHeight);

  for (var i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.4 + 0.1,
      opacity: Math.random() * 0.4 + 0.1,
    });
  }

  function draw() {
    animId = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, width, height);

    for (var i = 0; i < count; i++) {
      var p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(212, 160, 23, " + p.opacity + ")";
      ctx.fill();

      // Move particle upwards
      p.y -= p.speed;

      // Reset when particle goes off screen
      if (p.y < -10) {
        p.y = height + 10;
        p.x = Math.random() * width;
      }
    }
  }

  draw();

  window.addEventListener("resize", function () {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });
}

/* ─────────────────────────────
 BANNER CLOSE GSAP TIMELINE
───────────────────────────── */
var bannerCloseBtn = document.getElementById("banner-close");
if (bannerCloseBtn) {
  bannerCloseBtn.addEventListener("click", function () {
    var banner = document.getElementById("offer-banner");
    var navbar = document.getElementById("navbar");
    var body = document.body;
    gsap.to(banner, {
      height: 0,
      opacity: 0,
      duration: 0.3,
      ease: "power2.in",
      onComplete: function () {
        banner.style.display = "none";
      },
    });
    gsap.to(navbar, {
      top: 0,
      duration: 0.3,
      ease: "power2.in",
      onComplete: function () {
        if (window.syncMobileNavPosition) {
          window.syncMobileNavPosition();
        }
      },
    });
    gsap.to(body, {
      paddingTop: "68px",
      duration: 0.3,
      ease: "power2.in",
    });
  });
}
