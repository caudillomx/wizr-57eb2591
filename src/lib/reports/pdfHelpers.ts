import jsPDF from "jspdf";
import logoUrl from "@/assets/wizr-logo-full-transparent.png";

// ═══════════════════════════════════════
//  COLOR PALETTE
// ═══════════════════════════════════════
export const PDF_COLORS = {
  dark: [15, 23, 42] as const,        // #0f172a
  accent: [99, 102, 241] as const,    // #6366f1
  positive: [34, 197, 94] as const,   // #22c55e
  negative: [239, 68, 68] as const,   // #ef4444
  neutral: [148, 163, 184] as const,  // #94a3b8
  cardBg: [248, 250, 252] as const,   // #f8fafc
  white: [255, 255, 255] as const,
  textDark: [17, 24, 39] as const,
  textGray: [107, 114, 128] as const,
  border: [226, 232, 240] as const,   // #e2e8f0
  accentLight: [238, 239, 254] as const, // light indigo bg
};

export type C3 = readonly [number, number, number];

// ═══════════════════════════════════════
//  LOGO LOADER
// ═══════════════════════════════════════
let cachedLogo: string | null = null;

export async function loadLogo(): Promise<string> {
  if (cachedLogo) return cachedLogo;
  const response = await fetch(logoUrl);
  const blob = await response.blob();
  cachedLogo = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
  return cachedLogo;
}

// ═══════════════════════════════════════
//  HEADER (dark bg, logo left, title right)
// ═══════════════════════════════════════
export function drawHeader(
  doc: jsPDF,
  logoBase64: string,
  title: string,
  subtitle: string,
  pw: number,
  m: number,
) {
  const headerH = 28;
  doc.setFillColor(...PDF_COLORS.dark);
  doc.rect(0, 0, pw, headerH, "F");

  // Logo — left side, height ~8mm to fit nicely
  try {
    doc.addImage(logoBase64, "PNG", m, 6, 30, 8);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text("WIZR", m, 14);
  }

  // Title — right aligned
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...PDF_COLORS.white);
  const titleLines = doc.splitTextToSize(title, pw - m * 2 - 40);
  doc.text(titleLines[0] || title, pw - m, 12, { align: "right" });

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 210);
  doc.text(subtitle, pw - m, 20, { align: "right" });

  return headerH + 6;
}

// ═══════════════════════════════════════
//  PAGE HEADER (continuation pages)
// ═══════════════════════════════════════
export function drawPageHeader(
  doc: jsPDF,
  logoBase64: string,
  projectName: string,
  pw: number,
  m: number,
) {
  doc.setFillColor(...PDF_COLORS.dark);
  doc.rect(0, 0, pw, 14, "F");
  try {
    doc.addImage(logoBase64, "PNG", m, 3, 20, 5.5);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text("WIZR", m, 8);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(projectName, pw - m, 8, { align: "right" });
}

// ═══════════════════════════════════════
//  FOOTER (dark bg, logo left, project center, page right)
// ═══════════════════════════════════════
export function drawFooters(
  doc: jsPDF,
  logoBase64: string,
  projectName: string,
  pw: number,
  ph: number,
  m: number,
) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const footerH = 10;
    const footerY = ph - footerH;
    doc.setFillColor(...PDF_COLORS.dark);
    doc.rect(0, footerY, pw, footerH, "F");

    try {
      doc.addImage(logoBase64, "PNG", m, footerY + 2.5, 16, 4.5);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...PDF_COLORS.white);
      doc.text("WIZR", m, footerY + 6.5);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(180, 190, 210);
    doc.text(projectName, pw / 2, footerY + 6.5, { align: "center" });
    doc.text(`Pagina ${i} de ${pages}`, pw - m, footerY + 6.5, { align: "right" });
  }
}

// ═══════════════════════════════════════
//  METRICS ROW (4 metric cards)
// ═══════════════════════════════════════
export interface MetricCard {
  value: string;
  label: string;
}

export function drawMetricsRow(
  doc: jsPDF,
  metrics: MetricCard[],
  m: number,
  y: number,
  cw: number,
): number {
  const count = metrics.length;
  const gap = 3;
  const boxW = (cw - gap * (count - 1)) / count;
  const boxH = 22;

  metrics.forEach((metric, i) => {
    const x = m + i * (boxW + gap);
    // Card bg
    doc.setFillColor(...PDF_COLORS.cardBg);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
    // Border
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "S");
    // Value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...PDF_COLORS.accent);
    doc.text(metric.value, x + boxW / 2, y + 10, { align: "center" });
    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.textGray);
    doc.text(metric.label, x + boxW / 2, y + 17, { align: "center" });
  });

  return y + boxH + 4;
}

// ═══════════════════════════════════════
//  SENTIMENT BAR
// ═══════════════════════════════════════
export function drawSentimentBar(
  doc: jsPDF,
  positive: number,
  neutral: number,
  negative: number,
  m: number,
  y: number,
  cw: number,
): number {
  const total = positive + neutral + negative || 1;
  const barH = 6;
  const posW = Math.max((positive / total) * cw, 0.5);
  const neuW = Math.max((neutral / total) * cw, 0.5);
  const negW = Math.max((negative / total) * cw, 0.5);

  const posPct = Math.round((positive / total) * 100);
  const neuPct = Math.round((neutral / total) * 100);
  const negPct = Math.round((negative / total) * 100);

  // Positive segment
  doc.setFillColor(...PDF_COLORS.positive);
  doc.roundedRect(m, y, posW, barH, 2, 2, "F");
  if (posW > 12) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text(`${posPct}%`, m + posW / 2, y + barH / 2 + 1.5, { align: "center" });
  }

  // Neutral segment
  doc.setFillColor(...PDF_COLORS.neutral);
  doc.rect(m + posW, y, neuW, barH, "F");
  if (neuW > 12) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text(`${neuPct}%`, m + posW + neuW / 2, y + barH / 2 + 1.5, { align: "center" });
  }

  // Negative segment
  doc.setFillColor(...PDF_COLORS.negative);
  doc.roundedRect(m + posW + neuW, y, negW, barH, 2, 2, "F");
  if (negW > 12) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text(`${negPct}%`, m + posW + neuW + negW / 2, y + barH / 2 + 1.5, { align: "center" });
  }

  y += barH + 3;

  // Legend
  doc.setFontSize(6.5);
  const legends = [
    { c: PDF_COLORS.positive, l: `Positivo ${posPct}%` },
    { c: PDF_COLORS.neutral, l: `Neutral ${neuPct}%` },
    { c: PDF_COLORS.negative, l: `Negativo ${negPct}%` },
  ];
  const legendSpacing = cw / 3;
  legends.forEach(({ c, l }, i) => {
    const lx = m + i * legendSpacing;
    doc.setFillColor(c[0], c[1], c[2]);
    doc.circle(lx + 1.5, y + 1, 1.5, "F");
    doc.setTextColor(...PDF_COLORS.textGray);
    doc.text(l, lx + 5, y + 2);
  });

  return y + 7;
}

// ═══════════════════════════════════════
//  SECTION TITLE (accent bg bar with white text)
// ═══════════════════════════════════════
export function drawSectionTitle(
  doc: jsPDF,
  title: string,
  m: number,
  y: number,
  cw: number,
): number {
  doc.setFillColor(...PDF_COLORS.accent);
  doc.roundedRect(m, y, cw, 9, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(title.toUpperCase(), m + 5, y + 6.2);
  return y + 13;
}

// ═══════════════════════════════════════
//  PARAGRAPH TEXT
// ═══════════════════════════════════════
export function drawParagraph(
  doc: jsPDF,
  text: string,
  m: number,
  y: number,
  cw: number,
  ph: number,
  logoBase64: string,
  projectName: string,
  fontSize = 10,
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...PDF_COLORS.textDark);
  const lines = doc.splitTextToSize(text, cw - 4);
  const lineH = fontSize * 0.45;
  for (const line of lines) {
    if (y + lineH > ph - 18) {
      doc.addPage();
      y = 20;
      drawPageHeader(doc, logoBase64, projectName, doc.internal.pageSize.getWidth(), m);
    }
    doc.text(line, m + 2, y);
    y += lineH;
  }
  return y + 3;
}

// ═══════════════════════════════════════
//  NUMBERED ITEMS
// ═══════════════════════════════════════
export function drawNumberedItem(
  doc: jsPDF,
  text: string,
  num: number,
  m: number,
  y: number,
  cw: number,
  ph: number,
  logoBase64: string,
  projectName: string,
): number {
  if (y + 14 > ph - 18) {
    doc.addPage();
    y = 20;
    drawPageHeader(doc, logoBase64, projectName, doc.internal.pageSize.getWidth(), m);
  }

  // Number circle
  doc.setFillColor(...PDF_COLORS.accent);
  doc.circle(m + 5, y + 1, 3.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(`${num}`, m + 5, y + 2.5, { align: "center" });

  // Text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_COLORS.textDark);
  const lines = doc.splitTextToSize(text, cw - 18);
  const lineH = 4.4;
  for (let i = 0; i < lines.length; i++) {
    const ly = y + i * lineH;
    if (ly + lineH > ph - 18) {
      doc.addPage();
      y = 20;
      drawPageHeader(doc, logoBase64, projectName, doc.internal.pageSize.getWidth(), m);
    }
    doc.text(lines[i], m + 13, y + i * lineH + 2);
  }

  return y + lines.length * lineH + 5;
}

// ═══════════════════════════════════════
//  PAGE BREAK CHECK
// ═══════════════════════════════════════
export function needPage(
  doc: jsPDF,
  y: number,
  required: number,
  ph: number,
  logoBase64: string,
  projectName: string,
  m: number,
): number {
  if (y + required > ph - 18) {
    doc.addPage();
    drawPageHeader(doc, logoBase64, projectName, doc.internal.pageSize.getWidth(), m);
    return 20;
  }
  return y;
}

// ═══════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════
export function formatBigNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function normalizePlatform(domain: string): string {
  const map: Record<string, string> = {
    "twitter": "X/Twitter", "twitter.com": "X/Twitter", "x.com": "X/Twitter",
    "facebook": "Facebook", "facebook.com": "Facebook",
    "instagram": "Instagram", "instagram.com": "Instagram",
    "tiktok": "TikTok", "tiktok.com": "TikTok",
    "youtube": "YouTube", "youtube.com": "YouTube",
    "reddit": "Reddit", "reddit.com": "Reddit",
    "linkedin": "LinkedIn", "linkedin.com": "LinkedIn",
  };
  return map[domain] || domain.replace(/^www\./, "");
}

export function sentimentLabel(s: string): string {
  if (s === "negativo") return "Negativo";
  if (s === "positivo") return "Positivo";
  return "Mixto";
}
