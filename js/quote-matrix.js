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

  // Merge precomputed data URIs and dot arrays from quotes-data.js if available
  if (window.MOTIVATIONAL_QUOTES && Array.isArray(window.MOTIVATIONAL_QUOTES)) {
    window.MOTIVATIONAL_QUOTES.forEach((item, idx) => {
      if (QUOTES[idx]) {
        if (item.imageDataUri) QUOTES[idx].imageDataUri = item.imageDataUri;
        if (item.note) QUOTES[idx].note = item.note;
        if (item.dots) QUOTES[idx].dots = item.dots;
      }
    });
  }

  // Expose array globally if needed by other components
  window.MOTIVATIONAL_QUOTES = QUOTES;

  // Configuration constants
  const ROTATION_INTERVAL_MS = 10000; // 10 seconds
  const GRID_SPACING = 2.0;            // Fine 2.0px Dithered / Halftone dot grid for maximum photographic detail
  const CANVAS_LOGICAL_WIDTH = 320;    // Exact 4:5 aspect ratio (320x400)
  const CANVAS_LOGICAL_HEIGHT = 400;
  const MAX_DOT_RADIUS = (GRID_SPACING / 2.0) * 0.95; // ~0.95px radius for fine crisp dot points

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
    visibleCanvas.style.width = '100%';
    visibleCanvas.style.height = '100%';
    visibleCanvas.style.maxWidth = `${CANVAS_LOGICAL_WIDTH}px`;
    visibleCanvas.style.maxHeight = `${CANVAS_LOGICAL_HEIGHT}px`;
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
   * Extracts Halftone / Rasterbation dot matrix from an Image element
   * Uses circular dots on a 5px grid with varying radius and intensity based on tone
   */
  function processImageToDots(img) {
    if (!hiddenCtx) return [];

    const W = CANVAS_LOGICAL_WIDTH;
    const H = CANVAS_LOGICAL_HEIGHT;

    // Reset hidden canvas to black background (matching photo studio backgrounds)
    hiddenCanvas.width = W;
    hiddenCanvas.height = H;
    hiddenCtx.fillStyle = '#000000';
    hiddenCtx.fillRect(0, 0, W, H);

    // Padding inside canvas to prevent any edge clipping
    const pad = 6;
    const targetW = W - pad * 2;
    const targetH = H - pad * 2;

    const naturalW = img.naturalWidth || img.width || 320;
    const naturalH = img.naturalHeight || img.height || 400;
    const imgAspect = naturalW / naturalH;
    const containerAspect = targetW / targetH;
    let drawW, drawH, drawX, drawY;

    // Preserve 1:1 aspect ratio strictly - never stretch or flatten character
    if (imgAspect > containerAspect) {
      drawW = targetW;
      drawH = targetW / imgAspect;
      drawX = pad;
      drawY = pad + (targetH - drawH) / 2;
    } else {
      drawH = targetH;
      drawW = targetH * imgAspect;
      drawX = pad + (targetW - drawW) / 2;
      drawY = pad;
    }

    // Draw to hidden scratch canvas for pixel analysis
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
    const cols = Math.floor(W / step);
    const rows = Math.floor(H / step);
    const maxR = MAX_DOT_RADIUS;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * step;
        const cy = (r + 0.5) * step;

        // 3x3 local neighborhood luminance average
        let totalLum = 0;
        let count = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const sx = Math.min(W - 1, Math.max(0, Math.round(cx + dx)));
            const sy = Math.min(H - 1, Math.max(0, Math.round(cy + dy)));
            const idx = (sy * W + sx) * 4;
            const red = imgData[idx];
            const green = imgData[idx + 1];
            const blue = imgData[idx + 2];
            const alpha = imgData[idx + 3];

            const pixelLum = alpha < 20 ? 0 : (red * 0.299 + green * 0.587 + blue * 0.114);
            totalLum += pixelLum;
            count++;
          }
        }

        const avgLum = totalLum / count;
        const normLum = avgLum / 255.0; // 0.0 (background) to 1.0 (highlights)

        // Emit dots where character lighting is present
        if (normLum > 0.06) {
          const intensity = Math.pow(normLum, 1.0);
          const baseRadius = Math.max(0.4, maxR * (0.65 + 0.35 * intensity));
          const baseAlpha = Math.min(1.0, 0.40 + 0.60 * intensity);

          dots.push({
            x: cx,
            y: cy,
            baseRadius,
            baseAlpha,
            intensity,
            normX: cx / W,
            normY: cy / H
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

      // Fast-path: If precomputed high-detail dithered dot array is present, map directly
      if (item && item.dots && Array.isArray(item.dots) && item.dots.length > 0) {
        const dots = item.dots.map(d => {
          const x = d[0];
          const y = d[1];
          // Independent non-synchronized phase and frequency for organic sub-pixel drift
          const phase = (x * 12.9898 + y * 78.233) % 6.28318;
          const twinklePhase = (x * 37.19 + y * 91.73) % 6.28318;
          const speed = 0.7 + (((x * 5.3 + y * 11.7) % 1.0)) * 0.6;
          // Initial slight scatter for magnetic particle assembly
          const scatterX = (Math.random() - 0.5) * 8;
          const scatterY = (Math.random() - 0.5) * 8;
          return {
            x: x,
            y: y,
            baseRadius: d[2],
            baseAlpha: d[3],
            normX: d[4],
            normY: d[5],
            offsetX: scatterX,
            offsetY: scatterY,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            phase: phase,
            twinklePhase: twinklePhase,
            speed: speed
          };
        });
        dotsCache.set(index, dots);
        resolve(dots);
        return;
      }

      const img = new Image();

      img.onload = () => {
        const rawDots = processImageToDots(img);
        const dots = rawDots.map(d => {
          const phase = (d.x * 12.9898 + d.y * 78.233) % 6.28318;
          const twinklePhase = (d.x * 37.19 + d.y * 91.73) % 6.28318;
          const speed = 0.7 + (((d.x * 5.3 + d.y * 11.7) % 1.0)) * 0.6;
          return {
            ...d,
            offsetX: (Math.random() - 0.5) * 8,
            offsetY: (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            phase: phase,
            twinklePhase: twinklePhase,
            speed: speed
          };
        });
        dotsCache.set(index, dots);
        resolve(dots);
      };

      img.onerror = () => {
        // If imagePath fails, attempt webp / data URI
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

  // Interactive mouse/touch cursor state
  const mouse = {
    x: -9999,
    y: -9999,
    active: false,
    radius: 75, // magnetic repulsion radius in logical pixels
    currentTiltX: 0,
    currentTiltY: 0,
    targetTiltX: 0,
    targetTiltY: 0
  };

  /**
   * Animation Loop using requestAnimationFrame
   * Features:
   * 1. ZERO blinking wave: dots remain crisp, stable, and highly legible without strobing
   * 2. Interactive magnetic repulsion & glow wake on mouse/touch hover
   * 3. Fluid spring damping returns particles to their home coordinates
   * 4. Meditative living breath (slow volumetric cadence, 7.5s cycle)
   * 5. 3D holographic parallax tilt based on luminance depth
   * 6. Sub-pixel Brownian micro-float for an organic, living presence
   * 7. Sporadic micro-star twinkle (individual celestial dust sparkles)
   */
  function renderLoop() {
    if (visibleCtx && activeDots.length > 0) {
      visibleCtx.clearRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT);

      const primaryColor = getThemePrimaryColor();
      visibleCtx.fillStyle = primaryColor;

      const now = Date.now();
      const time = now * 0.0016; // elegant temporal pacing

      // Smooth 3D tilt interpolation
      mouse.currentTiltX += (mouse.targetTiltX - mouse.currentTiltX) * 0.07;
      mouse.currentTiltY += (mouse.targetTiltY - mouse.currentTiltY) * 0.07;

      // Meditative, slow living breath rhythm (7.5s cycle, NO blinking, just subtle volumetric life)
      const breathScale = Math.sin(time * 0.85) * 0.0035;
      const centerX = CANVAS_LOGICAL_WIDTH * 0.5;
      const centerY = CANVAS_LOGICAL_HEIGHT * 0.5;

      const mouseRadius = mouse.radius;
      const isMouseActive = mouse.active;
      const mouseX = mouse.x;
      const mouseY = mouse.y;

      for (let i = 0; i < activeDots.length; i++) {
        const dot = activeDots[i];

        // 1. Interactive cursor repulsion with spring physics
        if (isMouseActive) {
          const curX = dot.x + dot.offsetX;
          const curY = dot.y + dot.offsetY;
          const dx = curX - mouseX;
          const dy = curY - mouseY;
          const dist = Math.hypot(dx, dy);

          if (dist < mouseRadius && dist > 0.05) {
            const force = Math.pow(1.0 - dist / mouseRadius, 1.8) * 14.0;
            const angle = Math.atan2(dy, dx);
            dot.vx += Math.cos(angle) * force * 0.38;
            dot.vy += Math.sin(angle) * force * 0.38;
          }
        }

        // 2. Spring damping: smoothly returns dot to its home (0, 0 offset)
        dot.vx += (0 - dot.offsetX) * 0.12;
        dot.vy += (0 - dot.offsetY) * 0.12;
        dot.vx *= 0.78; // fluid damping friction
        dot.vy *= 0.78;
        dot.offsetX += dot.vx;
        dot.offsetY += dot.vy;

        // 3. Sub-pixel organic Brownian micro-drift (each dot has unique phase, ZERO wave blinking)
        const floatX = Math.sin(time * dot.speed + dot.phase) * 0.30;
        const floatY = Math.cos(time * dot.speed * 0.85 + dot.phase * 1.35) * 0.30;

        // 4. Subtle living breath (gentle volumetric expansion from portrait center)
        const breathX = (dot.x - centerX) * breathScale;
        const breathY = (dot.y - centerY) * breathScale;

        // 5. 3D holographic parallax based on luminance depth
        const depth = (dot.baseAlpha - 0.45) * 5.5;
        const px = mouse.currentTiltX * depth;
        const py = mouse.currentTiltY * depth;

        const rx = dot.x + breathX + dot.offsetX + floatX + px;
        const ry = dot.y + breathY + dot.offsetY + floatY + py;

        // 6. Mouse proximity luminescence (magnetic aura under cursor)
        let proximityGlow = 0;
        if (isMouseActive) {
          const distMouse = Math.hypot(rx - mouseX, ry - mouseY);
          if (distMouse < mouseRadius) {
            proximityGlow = (1.0 - distMouse / mouseRadius) * 0.32;
          }
        }

        // 7. Sporadic micro-star twinkle (subtle celestial dust, individual dots only)
        let starSparkle = 0;
        const tw = Math.sin(time * 2.0 + dot.twinklePhase);
        if (tw > 0.93) {
          starSparkle = (tw - 0.93) * 2.8 * 0.22;
        }

        // Final radius & alpha (steady, clear, never flashing or blinking out)
        const finalRadius = Math.max(0.38, dot.baseRadius * (1.0 + proximityGlow * 0.35 + starSparkle * 0.15));
        const finalAlpha = Math.min(1.0, dot.baseAlpha + proximityGlow + starSparkle);

        visibleCtx.globalAlpha = finalAlpha;
        visibleCtx.beginPath();
        visibleCtx.arc(rx, ry, finalRadius, 0, Math.PI * 2);
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
   * Graceful cross-fade transition to a target quote index with particle assembly
   */
  async function rotateTo(targetIndex) {
    if (targetIndex < 0) targetIndex = QUOTES.length - 1;
    if (targetIndex >= QUOTES.length) targetIndex = 0;

    const item = QUOTES[targetIndex];

    // 1. Particle scatter pulse on transition
    for (let i = 0; i < activeDots.length; i++) {
      const dot = activeDots[i];
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 5.0;
      dot.vx += Math.cos(angle) * speed;
      dot.vy += Math.sin(angle) * speed;
    }

    // 2. Fade text container & canvas
    if (textContainerEl) {
      textContainerEl.style.opacity = '0';
      textContainerEl.style.transform = 'translateY(6px)';
    }
    if (visibleCanvas) {
      visibleCanvas.style.opacity = '0.2';
    }

    // 3. Preload/fetch dot data during the fade-out window
    const newDots = await loadQuoteDots(targetIndex);

    // 4. Update DOM content after fade-out transition duration (~320ms)
    setTimeout(() => {
      currentIndex = targetIndex;

      // Initialize incoming particles with dynamic assemble spring
      for (let i = 0; i < newDots.length; i++) {
        const dot = newDots[i];
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 22;
        dot.offsetX = Math.cos(angle) * dist;
        dot.offsetY = Math.sin(angle) * dist;
        dot.vx = -dot.offsetX * 0.14;
        dot.vy = -dot.offsetY * 0.14;
      }

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

      // 5. Fade back in
      if (textContainerEl) {
        textContainerEl.style.opacity = '1';
        textContainerEl.style.transform = 'translateY(0)';
      }
      if (visibleCanvas) {
        visibleCanvas.style.opacity = '1';
      }
    }, 320);
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

    // Pointer interaction handling on the canvas
    function handlePointerMove(e) {
      if (!visibleCanvas) return;
      const rect = visibleCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const lx = (clientX - rect.left) * (CANVAS_LOGICAL_WIDTH / rect.width);
      const ly = (clientY - rect.top) * (CANVAS_LOGICAL_HEIGHT / rect.height);

      mouse.x = lx;
      mouse.y = ly;
      mouse.active = true;

      if (cardEl) {
        const cardRect = cardEl.getBoundingClientRect();
        mouse.targetTiltX = ((clientX - cardRect.left) / cardRect.width - 0.5) * 2;
        mouse.targetTiltY = ((clientY - cardRect.top) / cardRect.height - 0.5) * 2;
      }
    }

    function handlePointerLeave() {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
      mouse.targetTiltX = 0;
      mouse.targetTiltY = 0;
    }

    visibleCanvas.addEventListener('mousemove', handlePointerMove);
    visibleCanvas.addEventListener('mouseleave', handlePointerLeave);
    visibleCanvas.addEventListener('touchstart', handlePointerMove, { passive: true });
    visibleCanvas.addEventListener('touchmove', handlePointerMove, { passive: true });
    visibleCanvas.addEventListener('touchend', handlePointerLeave);
    visibleCanvas.addEventListener('touchcancel', handlePointerLeave);

    // Track card tilt when cursor is anywhere on the card
    cardEl.addEventListener('mousemove', (e) => {
      if (!mouse.active) {
        const cardRect = cardEl.getBoundingClientRect();
        mouse.targetTiltX = ((e.clientX - cardRect.left) / cardRect.width - 0.5) * 2;
        mouse.targetTiltY = ((e.clientY - cardRect.top) / cardRect.height - 0.5) * 2;
      }
    });

    // Hover pause and resume listeners
    cardEl.addEventListener('mouseenter', () => {
      isPaused = true;
      pauseRotationTimer();
    });

    cardEl.addEventListener('mouseleave', () => {
      isPaused = false;
      startRotationTimer();
      handlePointerLeave();
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
