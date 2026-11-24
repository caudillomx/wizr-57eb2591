export interface InfographicInput {
  folio: string | null;
  title: string;
  topic: string;
  headline: string;
  executiveSummary: string;
  totalComments: number;
  effectiveSampleSize: number;
  temperature: { score: number; label: string };
  sentiment: { positive: number; neutral: number; negative: number };
  stance?: {
    target?: string;
    favor: { share: number; moe: number };
    contra: { share: number; moe: number };
  };
  narratives: Array<{ id: string; title: string; share: number; moe: number }>;
  authenticity?: { organic: number; suspicious: number; coordinated: number };
  emicTerms?: Array<{ term: string }>;
  generatedAt?: string;
}

const PALETTE = {
  ink: "#141a24",
  ink2: "#3c4553",
  muted: "#6f7784",
  paper: "#ffffff",
  surface: "#f8fafc",
  accent: "#1f3fd8",
  red: "#e0392b",
  green: "#16a34a",
  amber: "#d97706",
  line: "#e2e8f0",
};

function esc(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length <= maxChars) {
      current = (current + " " + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Generador determinista de infografía editorial SVG (inspirado en Newsloom/svgInfographic.js).
 * Todas las cifras y textos provienen directamente del resultado verificado del estudio.
 */
export function buildNetnographyInfographicSvg(data: InfographicInput): string {
  const W = 1024;
  const M = 48;
  const INNER = W - 2 * M;
  const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  let y = 44;
  const parts: string[] = [];

  // Header editorial + regla tricolor
  parts.push(
    `<text x="${M}" y="${y}" font-family="${FONT}" font-size="13" font-weight="700" letter-spacing="2" fill="${PALETTE.muted}">WIZR · NETNOGRAFÍA HÍBRIDA v2.1 · ${esc(data.folio || "ESTUDIO")}</text>`
  );
  parts.push(
    `<text x="${W - M}" y="${y}" font-family="${FONT}" font-size="13" text-anchor="end" fill="${PALETTE.muted}">${esc((data.generatedAt || new Date().toISOString()).slice(0, 10))}</text>`
  );
  y += 14;
  const third = INNER / 3;
  parts.push(`<rect x="${M}" y="${y}" width="${third}" height="4" fill="${PALETTE.accent}"/>`);
  parts.push(`<rect x="${M + third}" y="${y}" width="${third}" height="4" fill="${PALETTE.ink}"/>`);
  parts.push(`<rect x="${M + 2 * third}" y="${y}" width="${third}" height="4" fill="${PALETTE.red}"/>`);
  y += 42;

  // Titular
  const titleLines = wrapText(data.headline || data.title, 48).slice(0, 3);
  for (const line of titleLines) {
    parts.push(
      `<text x="${M}" y="${y}" font-family="${FONT}" font-size="34" font-weight="800" fill="${PALETTE.ink}">${esc(line)}</text>`
    );
    y += 42;
  }

  // Resumen ejecutivo
  const sumLines = wrapText(data.executiveSummary, 88).slice(0, 3);
  for (const line of sumLines) {
    parts.push(
      `<text x="${M}" y="${y}" font-family="${FONT}" font-size="17" fill="${PALETTE.ink2}">${esc(line)}</text>`
    );
    y += 24;
  }
  y += 20;

  // Módulo 1: Cifras Clave (4 tarjetas)
  const cardW = (INNER - 36) / 4;
  const kpis = [
    { label: "REGISTROS", value: data.totalComments.toLocaleString("es-MX"), sub: `n_ef = ${data.effectiveSampleSize}`, color: PALETTE.accent },
    { label: "TEMPERATURA", value: `${data.temperature.score}/100`, sub: data.temperature.label, color: data.temperature.score >= 70 ? PALETTE.red : PALETTE.amber },
    { label: "SENTIMIENTO", value: `${data.sentiment.negative}% Neg`, sub: `+${data.sentiment.positive}% / =${data.sentiment.neutral}%`, color: PALETTE.ink },
    {
      label: "POSTURA",
      value: data.stance ? `${data.stance.favor.share}% Favor` : "N/A",
      sub: data.stance ? `Contra ${data.stance.contra.share}% (±${data.stance.contra.moe}%)` : "Sin target",
      color: PALETTE.green,
    },
  ];

  kpis.forEach((k, idx) => {
    const x = M + idx * (cardW + 12);
    parts.push(`<rect x="${x}" y="${y}" width="${cardW}" height="104" rx="8" fill="${PALETTE.surface}" stroke="${PALETTE.line}" stroke-width="1"/>`);
    parts.push(`<text x="${x + 16}" y="${y + 26}" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="1" fill="${PALETTE.muted}">${esc(k.label)}</text>`);
    parts.push(`<text x="${x + 16}" y="${y + 62}" font-family="${FONT}" font-size="26" font-weight="800" fill="${k.color}">${esc(k.value)}</text>`);
    parts.push(`<text x="${x + 16}" y="${y + 86}" font-family="${FONT}" font-size="12" fill="${PALETTE.ink2}">${esc(k.sub)}</text>`);
  });
  y += 136;

  // Módulo 2: Barras horizontales de Narrativas Dominantes
  parts.push(
    `<text x="${M}" y="${y}" font-family="${FONT}" font-size="14" font-weight="700" letter-spacing="1.2" fill="${PALETTE.ink}">NARRATIVAS DOMINANTES (% PONDERADO ± MARGEN DE ERROR 95%)</text>`
  );
  y += 22;

  const topNarratives = data.narratives.slice(0, 6);
  const barMaxW = INNER - 280;
  for (const n of topNarratives) {
    const label = n.title.length > 34 ? `${n.title.slice(0, 32)}…` : n.title;
    const barW = Math.max(8, Math.round((Math.min(100, n.share) / 100) * barMaxW));
    parts.push(`<text x="${M}" y="${y + 20}" font-family="${FONT}" font-size="15" font-weight="600" fill="${PALETTE.ink}">${esc(label)}</text>`);
    parts.push(`<rect x="${M + 260}" y="${y + 4}" width="${barMaxW}" height="22" rx="4" fill="${PALETTE.surface}"/>`);
    parts.push(`<rect x="${M + 260}" y="${y + 4}" width="${barW}" height="22" rx="4" fill="${PALETTE.accent}"/>`);
    parts.push(
      `<text x="${M + 268 + barW}" y="${y + 20}" font-family="${FONT}" font-size="13" font-weight="700" fill="${PALETTE.ink}">${n.share}% ± ${n.moe}%</text>`
    );
    y += 38;
  }
  y += 18;

  // Módulo 3: Autenticidad y Lenguaje Émico
  const halfW = (INNER - 20) / 2;
  const auth = data.authenticity || { organic: data.totalComments, suspicious: 0, coordinated: 0 };
  parts.push(`<rect x="${M}" y="${y}" width="${halfW}" height="108" rx="8" fill="${PALETTE.surface}" stroke="${PALETTE.line}"/>`);
  parts.push(`<text x="${M + 18}" y="${y + 28}" font-family="${FONT}" font-size="12" font-weight="700" fill="${PALETTE.muted}">AUTENTICIDAD DE LA CONVERSACIÓN</text>`);
  parts.push(`<text x="${M + 18}" y="${y + 58}" font-family="${FONT}" font-size="20" font-weight="700" fill="${PALETTE.ink}">${auth.organic} orgánicos</text>`);
  parts.push(
    `<text x="${M + 18}" y="${y + 84}" font-family="${FONT}" font-size="13" fill="${PALETTE.ink2}">${auth.suspicious} cuentas sospechosas · ${auth.coordinated} copias coordinadas</text>`
  );

  const emic = (data.emicTerms || []).slice(0, 5).map((t) => `"${t.term}"`).join(", ") || "Sin términos destacados";
  const emicLines = wrapText(emic, 44).slice(0, 2);
  const rx = M + halfW + 20;
  parts.push(`<rect x="${rx}" y="${y}" width="${halfW}" height="108" rx="8" fill="${PALETTE.surface}" stroke="${PALETTE.line}"/>`);
  parts.push(`<text x="${rx + 18}" y="${y + 28}" font-family="${FONT}" font-size="12" font-weight="700" fill="${PALETTE.muted}">LENGUAJE NATIVO / ÉMICO</text>`);
  emicLines.forEach((line, idx) => {
    parts.push(`<text x="${rx + 18}" y="${y + 56 + idx * 22}" font-family="${FONT}" font-size="15" font-weight="600" fill="${PALETTE.ink}">${esc(line)}</text>`);
  });
  y += 136;

  // Footer metodológico
  parts.push(`<line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="${PALETTE.line}" stroke-width="1"/>`);
  y += 24;
  parts.push(
    `<text x="${M}" y="${y}" font-family="${FONT}" font-size="12" fill="${PALETTE.muted}">Alcance: cifras válidas para la conversación digital pública del universo estudiado (95% confianza); no representa encuesta poblacional.</text>`
  );
  const H = y + 32;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PALETTE.paper}"/>
  ${parts.join("\n  ")}
</svg>`;
}
