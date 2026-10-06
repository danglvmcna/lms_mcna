import React, { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { fetchMaterialPdf } from "../../materialChunks";

// Read-only PDF viewer: pages are drawn on canvases, so there is no browser PDF toolbar
// (no download or print button) and it also works on phones, where a PDF in an iframe is not shown.

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfJs> | null = null;

// pdf.js is large; it is loaded only when a document is first opened.
function loadPdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
    pdfjsPromise.catch(() => { pdfjsPromise = null; });
  }
  return pdfjsPromise;
}

const MAX_PAGE_WIDTH = 1100;
const ZOOM_STEPS = [0.6, 0.8, 1, 1.25, 1.5, 2];

interface PdfViewerProps {
  url: string;
  title: string;
}

export default function PdfViewer({ url, title }: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [firstPageRatio, setFirstPageRatio] = useState(0.5625);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any;
    let loaded: any;
    setDoc(null);
    setError(null);

    (async () => {
      try {
        const data = await fetchMaterialPdf(url);
        const pdfjs = await loadPdfjs();
        if (cancelled) return;
        loadingTask = pdfjs.getDocument({ data });
        loaded = await loadingTask.promise;
        if (cancelled) {
          loaded.destroy();
          return;
        }
        const first = await loaded.getPage(1);
        const viewport = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setFirstPageRatio(viewport.height / viewport.width);
        setDoc(loaded);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Không hiển thị được tài liệu này.");
      }
    })();

    return () => {
      cancelled = true;
      // Destroying the task also releases the parsed document and its worker memory.
      Promise.resolve(loadingTask?.destroy?.()).catch(() => undefined);
    };
  }, [url]);

  // The viewer usually sits in a modal that is attached to the page just after this component mounts,
  // so the width is measured again once attached and once the document is ready, not only on resize.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => setContainerWidth(element.clientWidth);
    measure();
    const timers = [window.setTimeout(measure, 0), window.setTimeout(measure, 150)];
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, [doc]);

  const pageWidth = Math.max(240, Math.floor(Math.min(containerWidth - 24, MAX_PAGE_WIDTH) * ZOOM_STEPS[zoomIndex]));
  const numPages: number = doc?.numPages || 0;

  return (
    <div className="lms-view-only flex h-full min-h-0 flex-col" onContextMenu={event => event.preventDefault()}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        <span className="truncate font-medium">{doc ? `${numPages} trang · chỉ xem trực tuyến` : error ? "Không mở được tài liệu" : "Đang mở tài liệu..."}</span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setZoomIndex(index => Math.max(0, index - 1))}
            disabled={zoomIndex === 0}
            aria-label="Thu nhỏ"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-12 text-center font-mono">{Math.round(ZOOM_STEPS[zoomIndex] * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoomIndex(index => Math.min(ZOOM_STEPS.length - 1, index + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            aria-label="Phóng to"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-slate-200/70 p-3" aria-label={title}>
        {error ? (
          <div className="mx-auto mt-10 max-w-md rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-700">{error}</div>
        ) : !doc || containerWidth === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Đang tải tài liệu...</div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: numPages }, (_, index) => (
              <PdfPage key={index + 1} doc={doc} pageNumber={index + 1} width={pageWidth} initialRatio={firstPageRatio} scrollRoot={scrollRef} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PdfPageProps {
  doc: any;
  pageNumber: number;
  width: number;
  initialRatio: number;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
}

/** One page: drawn only while it is near the visible area, so long slide decks stay light on memory. */
function PdfPage({ doc, pageNumber, width, initialRatio, scrollRoot }: PdfPageProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nearViewport, setNearViewport] = useState(pageNumber <= 2);
  const [ratio, setRatio] = useState(initialRatio);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const observer = new IntersectionObserver(
      entries => setNearViewport(entries.some(entry => entry.isIntersecting)),
      { root: scrollRoot.current, rootMargin: "1200px 0px" }
    );
    observer.observe(holder);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!nearViewport) return;
    let cancelled = false;
    let renderTask: any;

    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        setRatio(base.height / base.width);
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: (width / base.width) * pixelRatio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
      } catch {
        // a cancelled render (scrolling away, zooming) is expected
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [doc, pageNumber, width, nearViewport]);

  return (
    <div
      ref={holderRef}
      className="mx-auto overflow-hidden rounded-sm bg-white shadow-sm"
      style={{ width, height: Math.round(width * ratio) }}
    >
      {nearViewport && <canvas ref={canvasRef} draggable={false} className="block h-full w-full select-none" />}
    </div>
  );
}
