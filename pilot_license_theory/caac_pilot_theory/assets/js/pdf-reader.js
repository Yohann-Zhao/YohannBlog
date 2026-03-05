(() => {
  "use strict";

  const PDF_WORKER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const MOBILE_BREAKPOINT = "(max-width: 1024px)";
  const SCALE_EPSILON = 0.015;
  const PREVIEW_QUALITY = 0.46;
  const TARGET_QUALITY = 0.8;
  const MOBILE_MAX_DPR = 1.25;
  const DESKTOP_MAX_DPR = 1.65;
  const MAX_CANVAS_PIXELS = 2400000;

  if (!window.pdfjsLib) {
    return;
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

  const isMobileViewport = () => window.matchMedia(MOBILE_BREAKPOINT).matches;

  class PdfReader {
    constructor(root) {
      this.root = root;
      this.pdfUrl = root.dataset.pdfSrc;
      this.pagesHost = root.querySelector(".pdf-pages");
      this.scrollContainer = root.querySelector(".pdf-scroll-container");
      this.statusEl = root.querySelector(".pdf-status");
      this.pageIndicator = root.querySelector("[data-role='page-indicator']");
      this.zoomValueEl = root.querySelector("[data-role='zoom-value']");
      this.zoomInButton = root.querySelector("[data-action='zoom-in']");
      this.zoomOutButton = root.querySelector("[data-action='zoom-out']");
      this.fitWidthButton = root.querySelector("[data-action='fit-width']");

      this.pdfDoc = null;
      this.pageStates = [];
      this.renderQueue = Promise.resolve();
      this.scale = 1;
      this.minScale = 0.6;
      this.maxScale = 2.2;
      this.currentPage = 1;
      this.totalPages = 0;
      this.basePageWidth = 0;
      this.lazyObserver = null;
      this.visibleObserver = null;
      this.resizeTimer = null;
      this.scrollTicking = false;
      this.idleUpgradeScheduled = false;
      this.isMobile = isMobileViewport();
    }

    getDocumentOptions() {
      return {
        url: this.pdfUrl,
        withCredentials: false,
        disableAutoFetch: true,
        rangeChunkSize: this.isMobile ? 196608 : 393216,
      };
    }

    async init() {
      if (!this.pdfUrl || !this.pagesHost || !this.scrollContainer) {
        this.showError("Reader initialization failed.");
        return;
      }

      this.bindToolbar();
      this.bindResize();
      this.bindScrollWarmup();

      try {
        this.showStatus("Loading PDF...");
        const task = window.pdfjsLib.getDocument(this.getDocumentOptions());
        this.pdfDoc = await task.promise;
        this.totalPages = this.pdfDoc.numPages;

        const firstPage = await this.pdfDoc.getPage(1);
        this.basePageWidth = firstPage.getViewport({ scale: 1 }).width;

        await this.buildPageShells();
        this.setupPageTracking();
        this.setupLazyRender();
        await this.renderLeadingPage();

        this.updatePageIndicator(1);
        this.updateZoomLabel();
      } catch (error) {
        console.error("PDF loading failed:", error);
        this.showError("Failed to load PDF.");
      }
    }

    bindToolbar() {
      this.zoomInButton?.addEventListener("click", () => this.changeZoom(0.15));
      this.zoomOutButton?.addEventListener("click", () => this.changeZoom(-0.15));
      this.fitWidthButton?.addEventListener("click", () => this.fitWidth());
    }

    bindResize() {
      window.addEventListener("resize", () => {
        const nextIsMobile = isMobileViewport();
        if (nextIsMobile !== this.isMobile) {
          this.isMobile = nextIsMobile;
        }

        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
          this.fitWidth();
        }, 180);
      });
    }

    bindScrollWarmup() {
      this.scrollContainer?.addEventListener(
        "scroll",
        () => {
          if (this.scrollTicking) {
            return;
          }
          this.scrollTicking = true;
          window.requestAnimationFrame(() => {
            this.scrollTicking = false;
            this.renderNearbyPages();
            this.scheduleIdleUpgrade();
          });
        },
        { passive: true }
      );
    }

    async buildPageShells() {
      this.pagesHost.innerHTML = "";
      this.pageStates = [];

      for (let pageNum = 1; pageNum <= this.totalPages; pageNum += 1) {
        const wrapper = document.createElement("section");
        wrapper.className = "pdf-page";
        wrapper.dataset.page = String(pageNum);

        const canvas = document.createElement("canvas");
        canvas.className = "pdf-canvas";
        canvas.dataset.page = String(pageNum);

        wrapper.appendChild(canvas);
        this.pagesHost.appendChild(wrapper);

        this.pageStates.push({
          pageNum,
          wrapper,
          canvas,
          renderedScale: 0,
          renderedQuality: 0,
          rendering: false,
        });
      }

      await this.fitWidth(true);
    }

    async renderLeadingPage() {
      this.showStatus("Rendering preview...");
      if (this.pageStates.length > 0) {
        await this.renderPage(this.pageStates[0]);
      }
      this.scheduleIdleUpgrade();
      this.hideStatus();
    }

    setupLazyRender() {
      this.lazyObserver = new IntersectionObserver(
        (entries) => {
          entries
            .filter((entry) => entry.isIntersecting)
            .forEach((entry) => {
              const pageNum = Number(entry.target.dataset.page);
              const state = this.pageStates[pageNum - 1];
              this.renderPage(state).then(() => {
                this.hideStatus();
                this.scheduleIdleUpgrade();
              });
            });
        },
        {
          root: this.scrollContainer,
          rootMargin: "30% 0px",
          threshold: 0.01,
        }
      );

      this.pageStates.forEach((state) => this.lazyObserver.observe(state.wrapper));
    }

    setupPageTracking() {
      this.visibleObserver = new IntersectionObserver(
        (entries) => {
          let best = null;
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              continue;
            }
            if (!best || entry.intersectionRatio > best.intersectionRatio) {
              best = entry;
            }
          }
          if (best) {
            const pageNum = Number(best.target.dataset.page);
            this.updatePageIndicator(pageNum);
          }
        },
        {
          root: this.scrollContainer,
          threshold: [0.25, 0.5, 0.75],
        }
      );

      this.pageStates.forEach((state) => this.visibleObserver.observe(state.wrapper));
    }

    changeZoom(delta) {
      const next = Math.min(this.maxScale, Math.max(this.minScale, this.scale + delta));
      if (Math.abs(next - this.scale) < SCALE_EPSILON) {
        return;
      }
      this.scale = next;
      this.updateZoomLabel();
      this.rerenderAtScale();
    }

    async fitWidth(silent = false) {
      try {
        if (!this.basePageWidth) {
          const firstPage = await this.pdfDoc.getPage(1);
          this.basePageWidth = firstPage.getViewport({ scale: 1 }).width;
        }

        const availableWidth = Math.max(300, this.scrollContainer.clientWidth - 20);
        const targetScale = Math.min(this.maxScale, Math.max(this.minScale, availableWidth / this.basePageWidth));

        if (Math.abs(targetScale - this.scale) < SCALE_EPSILON && !silent) {
          return;
        }

        this.scale = targetScale;
        this.updateZoomLabel();
        await this.rerenderAtScale();
      } catch (error) {
        console.error("Fit width failed:", error);
      }
    }

    async rerenderAtScale() {
      if (!this.pdfDoc) {
        return;
      }

      for (const state of this.pageStates) {
        state.renderedScale = 0;
        state.renderedQuality = 0;
      }

      await this.renderNearbyPages();
      this.scheduleIdleUpgrade();
    }

    isElementNearViewport(element) {
      const rect = element.getBoundingClientRect();
      const hostRect = this.scrollContainer.getBoundingClientRect();
      return rect.bottom >= hostRect.top - hostRect.height && rect.top <= hostRect.bottom + hostRect.height;
    }

    async renderNearbyPages() {
      const candidates = this.pageStates.filter((state) => this.isElementNearViewport(state.wrapper));
      for (const state of candidates) {
        await this.renderPage(state);
      }
    }

    scheduleIdleUpgrade() {
      if (this.idleUpgradeScheduled) {
        return;
      }

      this.idleUpgradeScheduled = true;
      const idleCallback =
        window.requestIdleCallback ||
        ((cb) =>
          window.setTimeout(() => {
            cb({ didTimeout: false, timeRemaining: () => 0 });
          }, 60));

      idleCallback(() => {
        this.idleUpgradeScheduled = false;
        this.upgradeVisiblePages();
      });
    }

    async upgradeVisiblePages() {
      const candidates = this.pageStates.filter((state) => this.isElementNearViewport(state.wrapper));
      for (const state of candidates) {
        await this.renderPage(state, TARGET_QUALITY);
      }
    }

    getOutputScale(viewport) {
      let dpr = window.devicePixelRatio || 1;
      dpr = Math.min(dpr, this.isMobile ? MOBILE_MAX_DPR : DESKTOP_MAX_DPR);

      const expectedPixels = viewport.width * viewport.height * dpr * dpr;
      if (expectedPixels > MAX_CANVAS_PIXELS) {
        const ratio = Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height));
        dpr = Math.max(1, Math.min(dpr, ratio));
      }

      return dpr;
    }

    async renderPage(state, quality = PREVIEW_QUALITY) {
      if (!state || state.rendering) {
        return;
      }

      const targetScale = this.scale;
      if (Math.abs(state.renderedScale - targetScale) < SCALE_EPSILON && state.renderedQuality >= quality - 0.01) {
        return;
      }

      state.rendering = true;

      this.renderQueue = this.renderQueue.then(async () => {
        try {
          const page = await this.pdfDoc.getPage(state.pageNum);
          const displayViewport = page.getViewport({ scale: targetScale });
          const renderViewport = page.getViewport({ scale: targetScale * quality });
          const canvas = state.canvas;
          const context = canvas.getContext("2d", { alpha: false });
          const outputScale = this.getOutputScale(renderViewport);

          canvas.width = Math.floor(renderViewport.width * outputScale);
          canvas.height = Math.floor(renderViewport.height * outputScale);
          canvas.style.width = `${displayViewport.width}px`;
          canvas.style.height = `${displayViewport.height}px`;

          context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
          await page.render({ canvasContext: context, viewport: renderViewport }).promise;

          state.renderedScale = targetScale;
          state.renderedQuality = quality;
        } catch (error) {
          console.error(`Render failed for page ${state.pageNum}:`, error);
          this.showError("Failed to render PDF page.");
        } finally {
          state.rendering = false;
        }
      });

      return this.renderQueue;
    }

    updatePageIndicator(pageNum) {
      this.currentPage = pageNum;
      if (this.pageIndicator) {
        this.pageIndicator.textContent = `Page ${this.currentPage} / ${this.totalPages}`;
      }
    }

    updateZoomLabel() {
      if (this.zoomValueEl) {
        this.zoomValueEl.textContent = `${Math.round(this.scale * 100)}%`;
      }
    }

    showStatus(message) {
      if (!this.statusEl) {
        return;
      }
      this.statusEl.textContent = message;
      this.statusEl.hidden = false;
    }

    hideStatus() {
      if (!this.statusEl) {
        return;
      }
      this.statusEl.hidden = true;
    }

    showError(message) {
      this.showStatus(message);
      this.root.classList.add("pdf-reader-error");
    }
  }

  const readers = document.querySelectorAll(".pdf-reader[data-pdf-src]");
  readers.forEach((node) => {
    const reader = new PdfReader(node);
    reader.init();
  });
})();
