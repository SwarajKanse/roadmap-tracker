/**
 * ============================================================================
 * Quote & Animated Dot-Matrix Engine (अभ्यास Wisdom Component)
 * ============================================================================
 * Features:
 * - Hidden canvas image analysis with brightness-to-dot-grid mapping
 * - High-contrast thresholding for silhouettes and portraits
 * - requestAnimationFrame loop with subtle sine-wave pulsing
 * - Dynamic theme color inheritance via CSS custom properties
 * - 10-second auto-rotation with graceful cross-fade transitions
 * - Interactive pause/resume on hover & quick-jump indicator dots
 */

(function () {
  'use strict';

  // 1. Exact 6 Quote Objects as required
  const QUOTES = [
    {
      author: "Shri Krishna",
      quote: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।",
      imagePath: "assets/quotes/krishna.png",
      note: "Bhagavad Gita 2.47 • Karma Yoga",
      isSanskrit: true
    },
    {
      author: "Swami Vivekananda",
      quote: "Arise, awake, and stop not till the goal is reached.",
      imagePath: "assets/quotes/vivekananda.png",
      note: "Katha Upanishad • Infinite Will",
      isSanskrit: false
    },
    {
      author: "Dr. A.P.J. Abdul Kalam",
      quote: "You have to dream before your dreams can come true.",
      imagePath: "assets/quotes/kalam.png",
      note: "Wings of Fire • Relentless Aspiration",
      isSanskrit: false
    },
    {
      author: "Andrew Ng",
      quote: "Don't worry about being the best. Worry about being better than you were yesterday.",
      imagePath: "assets/quotes/andrew_ng.png",
      note: "DeepLearning.AI • Continuous Iteration",
      isSanskrit: false
    },
    {
      author: "Linus Torvalds",
      quote: "Talk is cheap. Show me the code.",
      imagePath: "assets/quotes/linus.png",
      note: "Linux Kernel • Uncompromising Craft",
      isSanskrit: false
    },
    {
      author: "Jensen Huang",
      quote: "Run, don't walk. Remember, either you're running for food, or you are running from becoming food.",
      imagePath: "assets/quotes/jensen.png",
      note: "NVIDIA • High-Velocity Drive",
      isSanskrit: false
    }
  ];

  // Merge precomputed data URIs from quotes-data.js if available
  if (window.MOTIVATIONAL_QUOTES && Array.isArray(window.MOTIVATIONAL_QUOTES)) {
    window.MOTIVATIONAL_QUOTES.forEach((item, idx) => {
      if (QUOTES[idx]) {
        if (item.imageDataUri) QUOTES[idx].imageDataUri = item.imageDataUri;
        if (item.note) QUOTES[idx].note = item.note;
      }
    });
  }

  // Expose array globally if needed by other components
  window.MOTIVATIONAL_QUOTES = QUOTES;

  // Configuration constants
  const ROTATION_INTERVAL_MS = 10000; // 10 seconds
  const GRID_SPACING = 6;            // ~5-8px spacing
  const CANVAS_LOGICAL_WIDTH = 280;
  const CANVAS_LOGICAL_HEIGHT = 350;
  const CONTRAST_THRESHOLD = 85;     // Darkness threshold for ink pixels (0-255)

  // State
  let currentIndex = 0;
  let rotationTimer = null;
  let isPaused = false;
  let animFrameId = null;
  let activeDots = [];
  const dotsCache = new Map(); // Cache parsed dot arrays per quote index

  // DOM references
  let cardEl = null;
  let textContainerEl = null;
  let quoteTextEl = null;
  let quoteAuthorEl = null;
  let quoteNoteEl = null;
  let statusBadgeEl = null;
  let dotsIndicatorEl = null;
  let visibleCanvas = null;
  let visibleCtx = null;
  let hiddenCanvas = null;
  let hiddenCtx = null;

  /**
   * Initializes the offscreen and visible canvas elements with HiDPI support
   */
  function initCanvases() {
    visibleCanvas = document.getElementById('quote-dot-canvas');
    if (!visibleCanvas) return false;

    visibleCtx = visibleCanvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    visibleCanvas.width = Math.round(CANVAS_LOGICAL_WIDTH * dpr);
    visibleCanvas.height = Math.round(CANVAS_LOGICAL_HEIGHT * dpr);
    visibleCanvas.style.width = `${CANVAS_LOGICAL_WIDTH}px`;
    visibleCanvas.style.height = `${CANVAS_LOGICAL_HEIGHT}px`;
    visibleCtx.scale(dpr, dpr);

    // Offscreen scratch canvas for pixel brightness extraction
    hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.width = CANVAS_LOGICAL_WIDTH;
    hiddenCanvas.height = CANVAS_LOGICAL_HEIGHT;
    hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

    return true;
  }

  /**
   * Reads theme primary color dynamically from CSS custom properties
   */
  function getThemePrimaryColor() {
    try {
      const style = getComputedStyle(document.documentElement);
      const color = style.getPropertyValue('--accent-primary').trim() ||
                    style.getPropertyValue('--primary').trim();
      if (color) return color;
    } catch (e) {
      // fallback
    }
    return '#c0c1ff'; // Soft electric lavender matching Obsidian Dark palette
  }

  /**
   * Extracts dot matrix from an Image element using pixel brightness mapping
   */
  function processImageToDots(img) {
    if (!hiddenCtx) return [];

    const W = CANVAS_LOGICAL_WIDTH;
    const H = CANVAS_LOGICAL_HEIGHT;

    // Reset hidden canvas to pure white background
    hiddenCtx.fillStyle = '#ffffff';
    hiddenCtx.fillRect(0, 0, W, H);

    // Calculate aspect-ratio contained bounds
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = W / H;
    let drawW, drawH, drawX, drawY;

    if (imgAspect > canvasAspect) {
      drawW = W;
      drawH = W / imgAspect;
      drawX = 0;
      drawY = (H - drawH) / 2;
    } else {
      drawH = H;
      drawW = H * imgAspect;
      drawX = (W - drawW) / 2;
      drawY = 0;
    }

    // Draw to hidden canvas
    hiddenCtx.drawImage(img, drawX, drawY, drawW, drawH);

    let imgData;
    try {
      imgData = hiddenCtx.getImageData(0, 0, W, H).data;
    } catch (e) {
      console.warn('Canvas getImageData restricted:', e);
      return [];
    }

    const dots = [];
    const step = GRID_SPACING;

    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const idx = (y * W + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const a = imgData[idx + 3];

        if (a < 50) continue; // transparent pixel

        // Perceived luminance (ITU-R BT.601)
        const brightness = r * 0.299 + g * 0.587 + b * 0.114;
        const darkness = 255 - brightness;

        // Only draw dots where the underlying pixel is dark/opaque enough
        if (darkness > CONTRAST_THRESHOLD) {
          const normStrength = (darkness - CONTRAST_THRESHOLD) / (255 - CONTRAST_THRESHOLD);
          const baseRadius = 0.9 + normStrength * 1.65; // ~1.0px to 2.6px
          const baseAlpha = 0.45 + normStrength * 0.55;  // ~0.45 to 1.0

          dots.push({
            x: x + (step / 2),
            y: y + (step / 2),
            baseRadius,
            baseAlpha,
            darkness,
            normX: x / W,
            normY: y / H
          });
        }
      }
    }

    return dots;
  }

  /**
   * Preloads an image and extracts its dot matrix, with data URI fallback
   */
  function loadQuoteDots(index) {
    return new Promise((resolve) => {
      if (dotsCache.has(index)) {
        resolve(dotsCache.get(index));
        return;
      }

      const item = QUOTES[index];
      const img = new Image();

      img.onload = () => {
        const dots = processImageToDots(img);
        dotsCache.set(index, dots);
        resolve(dots);
      };

      img.onerror = () => {
        // If imagePath fails (e.g. file:/// restrictions or network), attempt webp / data URI
        if (item.imageDataUri && img.src !== item.imageDataUri) {
          img.src = item.imageDataUri;
        } else if (item.imagePath.endsWith('.png')) {
          img.src = item.imagePath.replace('.png', '.webp');
        } else {
          resolve([]);
        }
      };

      // Prioritize data URI to ensure zero taint on file:/// protocol
      if (item.imageDataUri) {
        img.src = item.imageDataUri;
      } else {
        const globalQuotes = window.MOTIVATIONAL_QUOTES && window.MOTIVATIONAL_QUOTES[index];
        if (globalQuotes && globalQuotes.imageDataUri) {
          img.src = globalQuotes.imageDataUri;
        } else {
          img.src = item.imagePath;
        }
      }
    });
  }

  /**
   * Animation Loop using requestAnimationFrame
   * Applies subtle sine wave pulsation to radius and opacity
   */
  function renderLoop() {
    if (visibleCtx && activeDots.length > 0) {
      visibleCtx.clearRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT);

      const primaryColor = getThemePrimaryColor();
      visibleCtx.fillStyle = primaryColor;

      const now = Date.now();
      const time = now * 0.0022; // subtle temporal pace

      for (let i = 0; i < activeDots.length; i++) {
        const dot = activeDots[i];

        // Spatial sine wave propagating diagonally across the dot matrix
        const wave = Math.sin(time + dot.normX * 3.4 + dot.normY * 4.0);

        // Gentle breathing modulation of radius and opacity
        const dynamicRadius = dot.baseRadius * (0.86 + 0.14 * wave);
        const dynamicAlpha = Math.max(0.08, Math.min(1.0, dot.baseAlpha * (0.80 + 0.20 * wave)));

        visibleCtx.globalAlpha = dynamicAlpha;
        visibleCtx.beginPath();
        visibleCtx.arc(dot.x, dot.y, Math.max(0.4, dynamicRadius), 0, Math.PI * 2);
        visibleCtx.fill();
      }
    }

    animFrameId = requestAnimationFrame(renderLoop);
  }

  /**
   * Renders the indicators at the bottom of the card
   */
  function renderDotsIndicator() {
    if (!dotsIndicatorEl) return;
    dotsIndicatorEl.innerHTML = '';

    QUOTES.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `transition-all duration-300 rounded-full cursor-pointer ${
        idx === currentIndex
          ? 'w-7 h-1.5 bg-primary shadow-sm'
          : 'w-1.5 h-1.5 bg-outline-variant/40 hover:bg-on-surface-variant'
      }`;
      btn.title = `${q.author}`;
      btn.setAttribute('aria-label', `View quote by ${q.author}`);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        rotateTo(idx, false);
      });
      dotsIndicatorEl.appendChild(btn);
    });
  }

  /**
   * Graceful cross-fade transition to a target quote index
   */
  async function rotateTo(targetIndex) {
    if (targetIndex < 0) targetIndex = QUOTES.length - 1;
    if (targetIndex >= QUOTES.length) targetIndex = 0;

    const item = QUOTES[targetIndex];

    // 1. Begin fade-out of text container & canvas
    if (textContainerEl) {
      textContainerEl.style.opacity = '0';
      textContainerEl.style.transform = 'translateY(6px)';
    }
    if (visibleCanvas) {
      visibleCanvas.style.opacity = '0';
    }

    // 2. Preload/fetch dot data during the fade-out window
    const newDots = await loadQuoteDots(targetIndex);

    // 3. Update DOM content after fade-out transition duration (~350ms)
    setTimeout(() => {
      currentIndex = targetIndex;
      activeDots = newDots;

      if (quoteTextEl) {
        quoteTextEl.textContent = item.quote;
        if (item.isSanskrit) {
          quoteTextEl.className = "font-calligraphy text-2xl sm:text-3xl text-on-surface font-normal leading-snug tracking-wide";
        } else {
          quoteTextEl.className = "font-headline text-lg sm:text-xl text-on-surface font-semibold leading-relaxed tracking-tight";
        }
      }

      if (quoteAuthorEl) quoteAuthorEl.textContent = item.author;
      if (quoteNoteEl) quoteNoteEl.textContent = item.note || '';

      renderDotsIndicator();

      // 4. Fade back in
      if (textContainerEl) {
        textContainerEl.style.opacity = '1';
        textContainerEl.style.transform = 'translateY(0)';
      }
      if (visibleCanvas) {
        visibleCanvas.style.opacity = '1';
      }
    }, 350);
  }

  /**
   * Starts the 10-second automatic rotation loop
   */
  function startRotationTimer() {
    clearInterval(rotationTimer);
    rotationTimer = setInterval(() => {
      if (!isPaused) {
        rotateTo((currentIndex + 1) % QUOTES.length);
      }
    }, ROTATION_INTERVAL_MS);

    if (statusBadgeEl && !isPaused) {
      statusBadgeEl.textContent = 'AUTO 10S';
      statusBadgeEl.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container border border-outline-variant/20 text-on-surface-variant/70 transition-all';
    }
  }

  /**
   * Pauses the rotation timer on hover
   */
  function pauseRotationTimer() {
    clearInterval(rotationTimer);
    if (statusBadgeEl) {
      statusBadgeEl.textContent = 'PAUSED';
      statusBadgeEl.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary font-semibold transition-all';
    }
  }

  /**
   * Main Component Bootstrapper
   */
  function initQuoteMatrixComponent() {
    cardEl = document.getElementById('quote-matrix-card');
    if (!cardEl) return;

    textContainerEl = document.getElementById('quote-text-container');
    quoteTextEl = document.getElementById('quote-text');
    quoteAuthorEl = document.getElementById('quote-author');
    quoteNoteEl = document.getElementById('quote-note');
    statusBadgeEl = document.getElementById('quote-status-badge');
    dotsIndicatorEl = document.getElementById('quote-dots-indicator');

    const prevBtn = document.getElementById('quote-prev-btn');
    const nextBtn = document.getElementById('quote-next-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        rotateTo((currentIndex - 1 + QUOTES.length) % QUOTES.length);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        rotateTo((currentIndex + 1) % QUOTES.length);
      });
    }

    if (!initCanvases()) return;

    // Hover pause and resume listeners
    cardEl.addEventListener('mouseenter', () => {
      isPaused = true;
      pauseRotationTimer();
    });

    cardEl.addEventListener('mouseleave', () => {
      isPaused = false;
      startRotationTimer();
    });

    // Start render loop
    if (!animFrameId) {
      renderLoop();
    }

    // Load initial quote immediately
    loadQuoteDots(0).then((dots) => {
      activeDots = dots;
      renderDotsIndicator();
      startRotationTimer();
    });

    // Preload remaining quotes in background for instant responsiveness
    setTimeout(() => {
      for (let i = 1; i < QUOTES.length; i++) {
        loadQuoteDots(i);
      }
    }, 1200);
  }

  // Self-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuoteMatrixComponent);
  } else {
    initQuoteMatrixComponent();
  }

  window.initQuoteMatrixComponent = initQuoteMatrixComponent;
})();
