/*
 * Artstr Studio — PPTX importer
 *
 * Canonical spec: docs/PPTX_IMPORT_FEATURE.md
 *
 * This module is lazy-loaded on first click of the Import PPTX
 * button. It depends on src/vendor/fflate.min.js being loaded
 * first (window.fflate).
 *
 * Phase 0: module shell + report data model only. importPptxFile
 * throws "not implemented yet" so the lazy-load + UI plumbing can
 * be verified end-to-end before Phase 1 lands the deck-shell
 * parser.
 */

window.ArtstrPptxImporter = (function () {
  'use strict';

  const PPTX_IMAGE_PLACEHOLDER_URL =
    'https://i.postimg.cc/9fY3n60q/example-image-replace-me.png';

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

  async function importPptxFile(_file, _report) {
    throw new Error(
      'PPTX import is not implemented yet — Phase 1 lands the deck-shell parser.'
    );
  }

  return {
    PPTX_IMAGE_PLACEHOLDER_URL,
    makePptxImportReport,
    importPptxFile,
  };
})();
