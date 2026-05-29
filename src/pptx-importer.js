/*
 * Artstr Studio — PPTX importer
 *
 * Canonical spec: docs/PPTX_IMPORT_FEATURE.md
 *
 * Lazy-loaded on the first click of the Import PPTX button. Depends
 * on src/vendor/fflate.min.js being loaded first (window.fflate).
 *
 * Phase 1 (current): deck-shell parse — file → unzip → presentation.xml
 * → slide order → one empty Artstr deck slide per PowerPoint slide,
 * normalized to a 1920x1080 canvas. No layer extraction yet. Slide
 * count + slide order are the load-bearing things at this phase.
 */

window.ArtstrPptxImporter = (function () {
  'use strict';

  // ---- Constants --------------------------------------------------------
  const PPTX_IMAGE_PLACEHOLDER_URL =
    'https://i.postimg.cc/9fY3n60q/example-image-replace-me.png';
  const RELATIONSHIPS_NS =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  // Default to 16:9 widescreen (12192000 x 6858000 EMU = 13.33in x 7.5in)
  // when presentation.xml omits p:sldSz. Standard PowerPoint widescreen
  // template default.
  const DEFAULT_PPTX_SLIDE_SIZE = { cx: 12192000, cy: 6858000 };
  const TARGET_W = 1920;
  const TARGET_H = 1080;
  // Anything above this prints a friendly warning rather than crashing —
  // matches the spec's PPTX_MAX_SLIDES_WARN.
  const SLIDE_COUNT_WARN_AT = 100;

  // ---- Report -----------------------------------------------------------
  function makePptxImportReport(fileName) {
    return {
      fileName: fileName || '',
      slideCount: 0,
      imported: {
        text: 0,
        images: 0,
        shapes: 0,
        groups: 0,
        backgrounds: 0,
        notes: 0,
      },
      placeholders: {
        charts: 0,
        smartArt: 0,
        tables: 0,
        media: 0,
        unknown: 0,
      },
      warnings: [],
    };
  }

  function _warn(report, slideIndex, code, message) {
    if (!report || !Array.isArray(report.warnings)) return;
    report.warnings.push({ slideIndex, code, message });
  }

  // ---- XML helpers ------------------------------------------------------
  function parseXml(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    // DOMParser surfaces XML parse errors as a <parsererror> element
    // rather than throwing. Detect and re-throw so callers see a real
    // error instead of a quietly malformed document.
    const err = doc.getElementsByTagName('parsererror')[0];
    if (err) throw new Error('Could not parse PPTX XML: ' + (err.textContent || 'unknown').slice(0, 200));
    return doc;
  }

  // ---- Zip helpers ------------------------------------------------------
  async function readPptxPackage(file) {
    if (!file) throw new Error('No file provided.');
    if (!window.fflate?.unzipSync) {
      throw new Error('fflate is not loaded — call ensurePptxImporterLoaded first.');
    }
    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    // Synchronous unzip blocks the UI briefly for large decks but is
    // simpler than fflate.unzip's callback-based async API. Typical
    // 1–10 MB pptx files unzip in well under 200 ms on a modern laptop.
    return window.fflate.unzipSync(u8);
  }

  function readZipText(files, path) {
    const bytes = files[path];
    if (!bytes) return null;
    return new TextDecoder('utf-8').decode(bytes);
  }

  // Resolve an OOXML relationship Target against the part that owned the
  // relationship file. Examples:
  //   pptxTargetToZipPath('ppt/presentation.xml', 'slides/slide1.xml')
  //     => 'ppt/slides/slide1.xml'
  //   pptxTargetToZipPath('ppt/slides/slide1.xml', '../media/image1.png')
  //     => 'ppt/media/image1.png'
  //   pptxTargetToZipPath(anything, '/ppt/media/image1.png')
  //     => 'ppt/media/image1.png'   (absolute-in-package)
  function pptxTargetToZipPath(basePath, target) {
    if (!target) return '';
    if (target.startsWith('/')) return target.replace(/^\/+/, '');
    const baseDir = basePath.replace(/[^/]+$/, '');
    const combined = baseDir + target;
    const parts = [];
    for (const seg of combined.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') { parts.pop(); continue; }
      parts.push(seg);
    }
    return parts.join('/');
  }

  // ---- Presentation parsing --------------------------------------------
  function readSlideSize(presDoc) {
    const sldSz = presDoc.getElementsByTagName('p:sldSz')[0]
              || presDoc.getElementsByTagNameNS('*', 'sldSz')[0];
    if (!sldSz) return { ...DEFAULT_PPTX_SLIDE_SIZE };
    const cx = Number(sldSz.getAttribute('cx')) || DEFAULT_PPTX_SLIDE_SIZE.cx;
    const cy = Number(sldSz.getAttribute('cy')) || DEFAULT_PPTX_SLIDE_SIZE.cy;
    return { cx, cy };
  }

  // Walk <p:sldIdLst> for the canonical slide order, then resolve each
  // <p:sldId r:id="..."/> against ppt/_rels/presentation.xml.rels to get
  // the actual zip path of the slide XML.
  function readSlideRefsInOrder(presDoc, presRelsDoc) {
    const sldIdLst = presDoc.getElementsByTagName('p:sldIdLst')[0]
                 || presDoc.getElementsByTagNameNS('*', 'sldIdLst')[0];
    if (!sldIdLst) return [];

    const relIdToTarget = new Map();
    const rels = presRelsDoc.getElementsByTagName('Relationship');
    for (let i = 0; i < rels.length; i++) {
      const r = rels[i];
      const id = r.getAttribute('Id');
      const tgt = r.getAttribute('Target');
      if (id && tgt) relIdToTarget.set(id, tgt);
    }

    const refs = [];
    for (let i = 0; i < sldIdLst.children.length; i++) {
      const sldId = sldIdLst.children[i];
      if (sldId.localName !== 'sldId') continue;
      const rId = sldId.getAttributeNS(RELATIONSHIPS_NS, 'id')
              || sldId.getAttribute('r:id')
              || '';
      if (!rId) continue;
      const target = relIdToTarget.get(rId);
      if (!target) continue;
      refs.push({
        rId,
        path: pptxTargetToZipPath('ppt/presentation.xml', target),
      });
    }
    return refs;
  }

  // ---- Slide-level parsing ---------------------------------------------
  // Read the slide's direct background. PPTX backgrounds can come from
  // four places (slide, layout, master, theme). This handler covers only
  // the direct slide background with a single solidFill — the common case
  // for design-template decks. Layout / master / theme inheritance and
  // gradient / picture fills are Phase 6.
  //
  // Returns either a CSS hex string like '#fbf8f0' or null if nothing
  // usable was found (caller leaves slide.background at the default).
  function readSlideBackground(slideDoc, slideIndex, report) {
    const bg = slideDoc.getElementsByTagName('p:bg')[0]
           || slideDoc.getElementsByTagNameNS('*', 'bg')[0];
    if (!bg) return null;

    // Direct background properties live in <p:bgPr>. <p:bgRef> means the
    // slide inherits from its layout/master via a theme scheme — defer
    // to Phase 6 with a warning.
    const bgRef = bg.getElementsByTagName('p:bgRef')[0]
              || bg.getElementsByTagNameNS('*', 'bgRef')[0];
    if (bgRef) {
      _warn(report, slideIndex, 'LAYOUT_INHERITANCE_PARTIAL',
        `Slide ${slideIndex + 1}: background inherited from layout/master — not resolved in Phase 1.`);
      return null;
    }

    const bgPr = bg.getElementsByTagName('p:bgPr')[0]
             || bg.getElementsByTagNameNS('*', 'bgPr')[0];
    if (!bgPr) return null;

    // Only solidFill + srgbClr in Phase 1. gradFill, blipFill (picture),
    // pattFill, and schemeClr-based fills land in Phase 6 with the rest
    // of theme resolution.
    const solid = bgPr.getElementsByTagName('a:solidFill')[0]
              || bgPr.getElementsByTagNameNS('*', 'solidFill')[0];
    if (!solid) {
      _warn(report, slideIndex, 'THEME_COLOR_UNRESOLVED',
        `Slide ${slideIndex + 1}: non-solid background fill (gradient / picture / scheme color) — left as default for now.`);
      return null;
    }

    const srgb = solid.getElementsByTagName('a:srgbClr')[0]
              || solid.getElementsByTagNameNS('*', 'srgbClr')[0];
    if (!srgb) {
      _warn(report, slideIndex, 'THEME_COLOR_UNRESOLVED',
        `Slide ${slideIndex + 1}: background uses a scheme color — theme resolution is Phase 6.`);
      return null;
    }
    const hex = (srgb.getAttribute('val') || '').trim().toLowerCase();
    if (!/^[0-9a-f]{6}$/.test(hex)) return null;
    return '#' + hex;
  }

  function readPresentationInfo(files, report) {
    const presText = readZipText(files, 'ppt/presentation.xml');
    if (!presText) {
      throw new Error('Missing ppt/presentation.xml — file does not look like a valid .pptx package.');
    }
    const presDoc = parseXml(presText);

    const presRelsText = readZipText(files, 'ppt/_rels/presentation.xml.rels');
    if (!presRelsText) {
      throw new Error('Missing ppt/_rels/presentation.xml.rels — relationship metadata missing.');
    }
    const presRelsDoc = parseXml(presRelsText);

    const slideSize = readSlideSize(presDoc);
    const slideRefs = readSlideRefsInOrder(presDoc, presRelsDoc);

    if (slideRefs.length > SLIDE_COUNT_WARN_AT) {
      _warn(report, -1, 'LARGE_DECK',
        `Large deck: ${slideRefs.length} slides. Import may take a moment.`);
    }

    return { slideSize, slideRefs };
  }

  // ---- Phase 1: deck shell ---------------------------------------------
  async function importPptxFile(file, report) {
    if (!file) throw new Error('No file provided.');
    if (!report) report = makePptxImportReport(file.name);

    const files = await readPptxPackage(file);
    const presentation = readPresentationInfo(files, report);

    const slides = [];
    for (let i = 0; i < presentation.slideRefs.length; i++) {
      // Yield to the browser every 10 slides so a 50+ slide deck doesn't
      // freeze the UI thread during import.
      if (i && i % 10 === 0) {
        await new Promise((r) => requestAnimationFrame(r));
      }

      // Try to read the slide's direct background. Anything we can't
      // resolve (inherited, gradient, scheme color) leaves the default
      // white — the user can edit it in the Deck Builder. Read failures
      // are non-fatal: the slide still gets a shell.
      let background = '#ffffff';
      const slidePath = presentation.slideRefs[i].path;
      const slideText = slidePath ? readZipText(files, slidePath) : null;
      if (slideText) {
        try {
          const slideDoc = parseXml(slideText);
          const bg = readSlideBackground(slideDoc, i, report);
          if (bg) {
            background = bg;
            report.imported.backgrounds += 1;
          }
        } catch (err) {
          _warn(report, i, 'SLIDE_PARSE_FAILED',
            `Slide ${i + 1}: could not parse slide XML — left blank.`);
        }
      }

      slides.push({
        name: 'Slide ' + (i + 1),
        slide: {
          width: TARGET_W,
          height: TARGET_H,
          background,
          notes: '',
        },
        layers: [],
        ignoreDeckTheme: true,
      });
    }
    report.slideCount = slides.length;

    return {
      version: 5,
      templateMode: 'deck',
      templateType: 'deck',
      meta: {
        title: file.name.replace(/\.pptx$/i, ''),
        imdbId: '',
        upc: '',
        tvdbId: '',
        musicbrainzDiscId: '',
        customTag: '',
        category: 'presentation',
        language: 'en',
      },
      deck: {
        theme: { fontFamily: '', background: '' },
        slides,
      },
    };
  }

  return {
    PPTX_IMAGE_PLACEHOLDER_URL,
    makePptxImportReport,
    importPptxFile,
    // Exposed for unit tests / future phases.
    _internals: {
      parseXml,
      readPptxPackage,
      readZipText,
      pptxTargetToZipPath,
      readSlideSize,
      readSlideRefsInOrder,
      readPresentationInfo,
      readSlideBackground,
    },
  };
})();
