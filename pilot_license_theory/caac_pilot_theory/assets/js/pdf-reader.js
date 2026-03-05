(() => {
  "use strict";

  const PDF_WORKER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  if (!window.pdfjsLib) {
    return;
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

  const isMobileViewport = () => window.matchMedia("(max-width: 1024px)").matches;

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
      this.maxScale = 3;
      this.currentPage = 1;
      this.totalPages = 0;
      this.lazyObserver = null;
      this.visibleObserver = null;
      this.resizeTimer = null;
      this.isMobile = isMobileViewport();
    }

    async init() {
      if (!this.pdfUrl || !this.pagesHost || !this.scrollContainer) {
        this.showError("Reader initialization failed.");
        return;
      }

      this.bindToolbar();
      this.bindResize();

      try {
        this.showStatus("Loading PDF...");
        const task = window.pdfjsLib.getDocument({ url: this.pdfUrl, withCredentials: false });
        this.pdfDoc = await task.promise;
        this.totalPages = this.pdfDoc.numPages;

        await this.buildPageShells();
        this.setupPageTracking();

        if (this.isMobile) {
          this.setupLazyRender();
        } else {
          await this.renderAllPages();
          this.hideStatus();
        }

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
          this.resetObservers();
          if (this.isMobile) {
            this.setupLazyRender();
          } else {
            this.renderAllPages().catch((error) => {
              console.error("PDF rerender failed:", error);
              this.showError("Failed to render PDF.");
            });
          }
        }

        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
          this.fitWidth();
        }, 150);
      });
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
          rendering: false,
        });
      }

      await this.fitWidth(true);
    }

    async renderAllPages() {
      this.showStatus("Rendering pages...");
      for (const state of this.pageStates) {
        await this.renderPage(state);
      }
      this.hideStatus();
    }

    setupLazyRender() {
      this.showStatus("Rendering visible pages...");
      this.lazyObserver = new IntersectionObserver(
        (entries) => {
          entries
            .filter((entry) => entry.isIntersecting)
            .forEach((entry) => {
              const pageNum = Number(entry.target.dataset.page);
              const state = this.pageStates[pageNum - 1];
              this.renderPage(state).then(() => {
                if (this.pageStates.every((item) => item.renderedScale > 0)) {
                  this.hideStatus();
                }
              });
            });
        },
        {
          root: this.scrollContainer,
          rootMargin: "150% 0px",
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

    resetObservers() {
      if (this.lazyObserver) {
        this.lazyObserver.disconnect();
        this.lazyObserver = null;
      }
      if (this.visibleObserver) {
        this.visibleObserver.disconnect();
        this.visibleObserver = null;
      }
      this.setupPageTracking();
    }

    changeZoom(delta) {
      const next = Math.min(this.maxScale, Math.max(this.minScale, this.scale + delta));
      if (Math.abs(next - this.scale) < 0.001) {
        return;
      }
      this.scale = next;
      this.updateZoomLabel();
      this.rerenderAtScale();
    }

    async fitWidth(silent = false) {
      try {
        const firstPage = await this.pdfDoc.getPage(1);
        const baseViewport = firstPage.getViewport({ scale: 1 });
        const availableWidth = Math.max(320, this.scrollContainer.clientWidth - 24);
        this.scale = Math.min(this.maxScale, Math.max(this.minScale, availableWidth / baseViewport.width));
        this.updateZoomLabel();
        await this.rerenderAtScale();
        if (!silent && this.isMobile) {
          this.hideStatus();
        }
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
      }

      if (this.isMobile) {
        this.pageStates
          .filter((state) => this.isElementNearViewport(state.wrapper))
          .forEach((state) => {
            this.renderPage(state);
          });
      } else {
        await this.renderAllPages();
      }
    }

    isElementNearViewport(element) {
      const rect = element.getBoundingClientRect();
      const hostRect = this.scrollContainer.getBoundingClientRect();
      return rect.bottom >= hostRect.top - hostRect.height && rect.top <= hostRect.bottom + hostRect.height;
    }

    async renderPage(state) {
      if (!state || state.rendering) {
        return;
      }
      if (Math.abs(state.renderedScale - this.scale) < 0.001) {
        return;
      }

      state.rendering = true;

      this.renderQueue = this.renderQueue.then(async () => {
        try {
          const page = await this.pdfDoc.getPage(state.pageNum);
          const viewport = page.getViewport({ scale: this.scale });
          const canvas = state.canvas;
          const context = canvas.getContext("2d", { alpha: false });

          const outputScale = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

          await page.render({ canvasContext: context, viewport }).promise;
          state.renderedScale = this.scale;
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
