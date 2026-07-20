/* 句存 - 应用内 PDF 排版与生成 */

(function () {
  'use strict';

  const PAPER_SIZES = {
    a4: { width: 794, height: 1123, pdfWidth: 595.28, pdfHeight: 841.89 },
    letter: { width: 816, height: 1056, pdfWidth: 612, pdfHeight: 792 },
    a5: { width: 559, height: 794, pdfWidth: 419.53, pdfHeight: 595.28 }
  };

  const MARGIN_RATIOS = { compact: .066, standard: .086, wide: .118 };
  const LINE_HEIGHTS = { compact: 1.52, comfortable: 1.78, relaxed: 2.02 };
  const SANS_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif';
  const SERIF_FONT = '"Songti SC", "SimSun", "STSong", serif';

  function renderDocument(model, options, pixelRatio = 1) {
    const page = getPageSize(options);
    const ratio = Math.max(1, pixelRatio);
    const margin = Math.round(Math.min(page.width, page.height) * (MARGIN_RATIOS[options.margin] || MARGIN_RATIOS.standard));
    const footerSpace = options.pageNumber ? 30 : 12;
    const contentBottom = page.height - margin - footerSpace;
    const bodyFont = options.fontFamily === 'serif' ? SERIF_FONT : SANS_FONT;
    const lineHeight = Math.round(options.fontSize * (LINE_HEIGHTS[options.lineHeight] || LINE_HEIGHTS.comfortable));
    const pages = [];
    let current;
    let y;

    function addPage() {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(page.width * ratio);
      canvas.height = Math.round(page.height * ratio);
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, page.width, page.height);
      current = { canvas, ctx };
      pages.push(current);
      y = drawPageHeader(ctx, model, options, page, margin, pages.length);
      return current;
    }

    addPage();
    const availableWidth = page.width - margin * 2;

    model.notes.forEach((note, noteIndex) => {
      const category = note.category || { name: '未分类', color: '#8e8e93' };
      const ctx = current.ctx;
      setFont(ctx, options.fontSize, 400, bodyFont);
      const horizontalPadding = options.template === 'cards' ? 18 : options.template === 'manuscript' ? 15 : 0;
      const textWidth = availableWidth - horizontalPadding * 2;
      const lines = wrapText(ctx, note.content || '', textWidth);
      const badgeHeight = options.category ? 28 : 0;
      const metaHeight = options.time || (options.source && (note.sourceTitle || note.sourceUrl)) ? 24 : 0;
      const topPadding = options.template === 'cards' ? 16 : 7;
      const bottomPadding = options.template === 'cards' ? 15 : 8;
      const headerGap = badgeHeight ? 10 : 0;
      const fullHeight = topPadding + badgeHeight + headerGap + lines.length * lineHeight + metaHeight + bottomPadding;
      const fullPageCapacity = contentBottom - yStartForPage(options, margin) - 12;

      if (fullHeight > contentBottom - y && fullHeight <= fullPageCapacity && y > yStartForPage(options, margin) + 8) addPage();

      let lineIndex = 0;
      let firstChunk = true;
      while (lineIndex < lines.length || (lines.length === 0 && firstChunk)) {
        const chunkTop = topPadding + (firstChunk ? badgeHeight + headerGap : 0);
        const reserveMeta = metaHeight + bottomPadding;
        let capacity = Math.floor((contentBottom - y - chunkTop - reserveMeta) / lineHeight);
        if (capacity < 1 && lines.length) {
          addPage();
          firstChunk = false;
          continue;
        }

        const remaining = Math.max(1, lines.length - lineIndex);
        let take = Math.min(remaining, capacity || 1);
        let finishes = lineIndex + take >= lines.length;
        if (!finishes) {
          capacity = Math.floor((contentBottom - y - chunkTop - bottomPadding) / lineHeight);
          take = Math.max(1, Math.min(remaining, capacity));
          finishes = lineIndex + take >= lines.length;
        }

        const chunkLines = lines.slice(lineIndex, lineIndex + take);
        const chunkHeight = chunkTop + Math.max(1, chunkLines.length) * lineHeight + (finishes ? metaHeight : 0) + bottomPadding;
        drawNoteChunk(current.ctx, note, category, chunkLines, {
          x: margin,
          y,
          width: availableWidth,
          height: chunkHeight,
          horizontalPadding,
          topPadding,
          lineHeight,
          bodyFont,
          fontSize: options.fontSize,
          template: options.template,
          showCategory: options.category && firstChunk,
          showTime: options.time && finishes,
          showSource: options.source && finishes,
          continuation: !firstChunk,
          finishes
        });

        y += chunkHeight + (options.template === 'cards' ? 14 : 10);
        lineIndex += take;
        firstChunk = false;

        if (!finishes) addPage();
      }

      if (noteIndex < model.notes.length - 1 && y > contentBottom - 66) addPage();
    });

    pages.forEach((item, index) => drawPageFooter(item.ctx, options, page, margin, index + 1, pages.length));
    return { canvases: pages.map(item => item.canvas), page };
  }

  function getPageSize(options) {
    const base = PAPER_SIZES[options.paperSize] || PAPER_SIZES.a4;
    if (options.orientation !== 'landscape') return { ...base };
    return { width: base.height, height: base.width, pdfWidth: base.pdfHeight, pdfHeight: base.pdfWidth };
  }

  function yStartForPage(options, margin) {
    return margin + (options._pageNumber === 1 ? 96 : 42);
  }

  function drawPageHeader(ctx, model, options, page, margin, pageNumber) {
    options._pageNumber = pageNumber;
    const font = options.fontFamily === 'serif' ? SERIF_FONT : SANS_FONT;
    if (pageNumber === 1) {
      setFont(ctx, 28, 720, font);
      ctx.fillStyle = '#1d1d1f';
      ctx.fillText(model.title || '句存笔记', margin, margin + 28);
      setFont(ctx, 10.5, 400, SANS_FONT);
      ctx.fillStyle = '#8e8e93';
      ctx.fillText(`共 ${model.notes.length} 条笔记  ·  导出于 ${formatDate(new Date())}`, margin, margin + 50);
      ctx.fillStyle = '#0071e3';
      ctx.fillRect(margin, margin + 68, page.width - margin * 2, 2);
      return margin + 94;
    }
    setFont(ctx, 10, 600, font);
    ctx.fillStyle = '#6e6e73';
    ctx.fillText(model.title || '句存笔记', margin, margin + 9);
    ctx.fillStyle = '#e5e5e7';
    ctx.fillRect(margin, margin + 23, page.width - margin * 2, 1);
    return margin + 42;
  }

  function drawNoteChunk(ctx, note, category, lines, layout) {
    const { x, y, width, height, horizontalPadding, topPadding, lineHeight, bodyFont, fontSize, template } = layout;
    const innerX = x + horizontalPadding;
    let cursorY = y + topPadding;

    if (template === 'cards') {
      roundRect(ctx, x, y, width, height, 12);
      ctx.fillStyle = '#f8f9fb';
      ctx.fill();
      ctx.strokeStyle = '#e8e9ec';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (template === 'manuscript') {
      ctx.fillStyle = category.color || '#0071e3';
      ctx.globalAlpha = .82;
      ctx.fillRect(x, y + 2, 3, Math.max(24, height - 8));
      ctx.globalAlpha = 1;
    }

    if (layout.showCategory) {
      drawBadge(ctx, innerX, cursorY, category.name || '未分类', category.color || '#8e8e93', bodyFont);
      cursorY += 38;
    } else if (layout.continuation) {
      setFont(ctx, 9, 500, SANS_FONT);
      ctx.fillStyle = '#aeaeb2';
      ctx.fillText('续', innerX, cursorY + 10);
      cursorY += 20;
    }

    setFont(ctx, fontSize, 400, bodyFont);
    ctx.fillStyle = '#2c2c2e';
    lines.forEach(line => {
      cursorY += lineHeight;
      ctx.fillText(line || ' ', innerX, cursorY - Math.max(4, Math.round(lineHeight * .25)));
    });

    if (layout.finishes && (layout.showTime || layout.showSource)) {
      cursorY += 8;
      setFont(ctx, Math.max(9, fontSize - 4), 400, SANS_FONT);
      ctx.fillStyle = '#9a9aa0';
      const pieces = [];
      if (layout.showTime) pieces.push(note.timestamp || '时间未知');
      if (layout.showSource && (note.sourceTitle || note.sourceUrl)) pieces.push(`来源：${note.sourceTitle || note.sourceUrl}`);
      const meta = truncateText(ctx, pieces.join('  ·  '), width - horizontalPadding * 2);
      ctx.fillText(meta, innerX, cursorY + 10);
    }

    if (template === 'minimal' && layout.finishes) {
      ctx.fillStyle = '#ededf0';
      ctx.fillRect(x, y + height - 1, width, 1);
    }
  }

  function drawBadge(ctx, x, y, text, color, font) {
    setFont(ctx, 10, 650, font);
    const label = truncateText(ctx, text, 100);
    const width = Math.ceil(ctx.measureText(label).width) + 22;
    roundRect(ctx, x, y, width, 24, 12);
    ctx.fillStyle = withAlpha(color, .12);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 9, y + 12, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(label, x + 15, y + 16);
  }

  function drawPageFooter(ctx, options, page, margin, number, total) {
    if (!options.pageNumber) return;
    setFont(ctx, 9, 400, SANS_FONT);
    ctx.fillStyle = '#b0b0b5';
    const label = `${number} / ${total}`;
    const width = ctx.measureText(label).width;
    ctx.fillText(label, page.width - margin - width, page.height - Math.max(20, margin * .35));
    ctx.fillText('句存', margin, page.height - Math.max(20, margin * .35));
  }

  function wrapText(ctx, text, maxWidth) {
    const result = [];
    String(text || '').split(/\r?\n/).forEach((paragraph, paragraphIndex, paragraphs) => {
      if (!paragraph) result.push('');
      else {
        let line = '';
        for (const character of paragraph) {
          const candidate = line + character;
          if (line && ctx.measureText(candidate).width > maxWidth) {
            result.push(line);
            line = character;
          } else line = candidate;
        }
        if (line) result.push(line);
      }
      if (paragraphIndex < paragraphs.length - 1 && paragraph) result.push('');
    });
    return result.length ? result : [''];
  }

  function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let value = text;
    while (value.length && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
    return `${value}…`;
  }

  function setFont(ctx, size, weight, family) {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.textBaseline = 'alphabetic';
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function withAlpha(hex, alpha) {
    const value = String(hex || '#8e8e93').replace('#', '');
    const normalized = value.length === 3 ? value.split('').map(char => char + char).join('') : value;
    const number = Number.parseInt(normalized, 16);
    const red = (number >> 16) & 255;
    const green = (number >> 8) & 255;
    const blue = number & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function formatDate(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  async function buildPdf(canvases, page) {
    const images = await Promise.all(canvases.map(canvas => canvasToJpeg(canvas)));
    const encoder = new TextEncoder();
    const chunks = [];
    const offsets = [0];
    let length = 0;

    function append(value) {
      const bytes = typeof value === 'string' ? encoder.encode(value) : value;
      chunks.push(bytes);
      length += bytes.length;
    }

    function addObject(number, dictionary, stream) {
      offsets[number] = length;
      append(`${number} 0 obj\n${dictionary}`);
      if (stream) {
        append('\nstream\n');
        append(stream);
        append('\nendstream');
      }
      append('\nendobj\n');
    }

    append('%PDF-1.4\n%JUCUN\n');
    const objectCount = 2 + images.length * 3;
    addObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const pageRefs = images.map((_, index) => `${3 + index * 3} 0 R`).join(' ');
    addObject(2, `<< /Type /Pages /Kids [${pageRefs}] /Count ${images.length} >>`);

    images.forEach((image, index) => {
      const pageObject = 3 + index * 3;
      const imageObject = pageObject + 1;
      const contentObject = pageObject + 2;
      const content = encoder.encode(`q\n${page.pdfWidth.toFixed(2)} 0 0 ${page.pdfHeight.toFixed(2)} 0 0 cm\n/Im0 Do\nQ`);
      addObject(pageObject, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.pdfWidth.toFixed(2)} ${page.pdfHeight.toFixed(2)}] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`);
      addObject(imageObject, `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>`, image.bytes);
      addObject(contentObject, `<< /Length ${content.length} >>`, content);
    });

    const xrefOffset = length;
    append(`xref\n0 ${objectCount + 1}\n`);
    append('0000000000 65535 f \n');
    for (let number = 1; number <= objectCount; number += 1) append(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`);
    append(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  function canvasToJpeg(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(async blob => {
        if (!blob) {
          reject(new Error('页面图像生成失败'));
          return;
        }
        resolve({ width: canvas.width, height: canvas.height, bytes: new Uint8Array(await blob.arrayBuffer()) });
      }, 'image/jpeg', .94);
    });
  }

  window.JucunPdf = { renderDocument, buildPdf };
}());
