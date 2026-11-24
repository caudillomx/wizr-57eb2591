import { describe, expect, it } from "vitest";
import { detectPlatformFromUrl, xSearchTerms } from "../../backend/src/lib/netnography/platforms";
import {
  assessAuthenticity,
  buildPseudonymizer,
  calculateSampleSize,
  drawStratifiedSample,
} from "../../backend/src/lib/netnography/sampling";
import {
  computeCohenKappa,
  computeKrippendorffAlpha,
  computeValidationMetrics,
  computeWeightedAggregates,
  marginOfError95,
} from "../../backend/src/lib/netnography/aggregates";
import { buildNetnographyInfographicSvg } from "../../backend/src/lib/netnography/infographic.service";

describe("netnography platforms", () => {
  it("detects x, instagram, tiktok, youtube and facebook URLs", () => {
    expect(detectPlatformFromUrl("https://x.com/user/status/1899999999999999999")?.platform).toBe("x");
    expect(detectPlatformFromUrl("https://www.instagram.com/reel/ABC123xyz/")?.postId).toBe("ABC123xyz");
    expect(detectPlatformFromUrl("https://www.tiktok.com/@user/video/7400000000000000000")?.platform).toBe("tiktok");
    expect(detectPlatformFromUrl("https://youtu.be/dQw4w9WgXcQ")?.postId).toBe("dQw4w9WgXcQ");
    expect(detectPlatformFromUrl("https://www.facebook.com/page/posts/12345")?.platform).toBe("facebook");
    expect(detectPlatformFromUrl("not a url")).toBeNull();
  });

  it("generates time-sliced X search terms", () => {
    const terms = xSearchTerms("1850000000000000000", 1740000000);
    expect(terms.length).toBeGreaterThan(1);
    expect(terms[0]).toContain("conversation_id:1850000000000000000");
  });
});

describe("netnography sampling v2.1", () => {
  it("pseudonymizes regular users deterministically and keeps public figures", () => {
    const pseudo = buildPseudonymizer(new Set(["gob_puebla"]));
    const a1 = pseudo("juan.perez");
    const a2 = pseudo("juan.perez");
    const b = pseudo("maria.lopez");
    const pub = pseudo("Gob_Puebla");

    expect(a1.alias).toBe("U-0001");
    expect(a2.alias).toBe("U-0001");
    expect(b.alias).toBe("U-0002");
    expect(pub.alias).toBe("Gob_Puebla");
  });

  it("calculates finite population sample size with oversampling", () => {
    const n = calculateSampleSize(5000, 0.05, 1.15);
    expect(n).toBeGreaterThanOrEqual(357);
    expect(n).toBeLessThanOrEqual(500);
  });

  it("detects coordinated copies and suspicious accounts", () => {
    const records = [
      { id: "1", stratum: "x", authorKey: "user10001", text: "Este es un mensaje exactamente repetido para prueba de coordinacion" },
      { id: "2", stratum: "x", authorKey: "user20002", text: "Este es un mensaje exactamente repetido para prueba de coordinacion" },
      { id: "3", stratum: "x", authorKey: "user30003", text: "Este es un mensaje exactamente repetido para prueba de coordinacion" },
      { id: "4", stratum: "x", authorKey: "real_person", text: "Comentario organico normal sobre el tema" },
    ];
    const assessed = assessAuthenticity(records);
    expect(assessed.get("1")?.flag).toBe("coordinated");
    expect(assessed.get("4")?.flag).toBe("organic");
  });

  it("draws stratified sample with weights and effective sample size", () => {
    const records = Array.from({ length: 500 }, (_, i) => ({
      id: `id-${i}`,
      stratum: i < 350 ? "facebook" : "x",
      authorKey: `author-${i % 150}`,
      text: `Texto de prueba numero ${i}`,
    }));
    const res = drawStratifiedSample(records, { maxTotal: 250, maxPerAuthorPerStratum: 3, seed: 42 });
    expect(res.selectedIds.size).toBeLessThanOrEqual(250);
    expect(res.effectiveSampleSize).toBeGreaterThan(0);
    expect(res.stratumSummary.length).toBe(2);
  });
});

describe("netnography aggregates and human validation", () => {
  it("computes Cohen's Kappa and Krippendorff's Alpha", () => {
    const perfect: Array<[string, string]> = [
      ["positive", "positive"],
      ["negative", "negative"],
      ["neutral", "neutral"],
    ];
    expect(computeCohenKappa(perfect)).toBe(1);
    expect(computeKrippendorffAlpha(perfect)).toBe(1);

    const partial: Array<[string, string]> = [
      ["positive", "positive"],
      ["negative", "negative"],
      ["neutral", "positive"],
      ["negative", "negative"],
      ["positive", "positive"],
    ];
    const kappa = computeCohenKappa(partial)!;
    expect(kappa).toBeGreaterThan(0.5);
    expect(kappa).toBeLessThan(1);
  });

  it("computes weighted aggregates with organicOnly filter and MoE 95%", () => {
    expect(marginOfError95(0.5, 400)).toBe(4.9);
    const rows = [
      {
        commentId: "1",
        platform: "facebook",
        weight: 1.5,
        authenticityFlag: "organic",
        sentiment: "negative",
        stance: "contra",
        narrative: "N1",
        emotion: "enojo",
        accountType: "persona",
        gender: "f",
        age: "35+",
        language: "es",
        country: "MX",
        humanSentiment: "negative",
        humanStance: "contra",
        reviewedAt: new Date(),
      },
      {
        commentId: "2",
        platform: "x",
        weight: 1.0,
        authenticityFlag: "coordinated",
        sentiment: "positive",
        stance: "favor",
        narrative: "N2",
        emotion: "orgullo",
        accountType: "persona",
        gender: "m",
        age: "18-29",
        language: "es",
        country: "MX",
      },
    ];
    const all = computeWeightedAggregates(rows, false);
    const organic = computeWeightedAggregates(rows, true);
    expect(all.totalRecords).toBe(2);
    expect(organic.totalRecords).toBe(1);
    expect(organic.sentiment.negative).toBe(100);
    const val = computeValidationMetrics(rows);
    expect(val.reviewedCount).toBe(1);
    expect(val.sentimentAgreement).toBe(100);
  });

  it("generates a valid escaped SVG infographic from study metrics", () => {
    const svg = buildNetnographyInfographicSvg({
      folio: "NET-2026-001",
      title: "Movilidad & Seguridad",
      topic: "Movilidad",
      headline: "7 de cada 10 comentarios critican el servicio",
      executiveSummary: "La conversación se concentra en páginas vecinales.",
      totalComments: 1200,
      effectiveSampleSize: 380,
      temperature: { score: 78, label: "Caliente" },
      sentiment: { positive: 12, neutral: 18, negative: 70 },
      narratives: [{ id: "N1", title: "Falta de unidades", share: 45, moe: 5 }],
      authenticity: { organic: 1100, suspicious: 60, coordinated: 40 },
      emicTerms: [{ term: "camión fantasma" }],
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("NET-2026-001");
    expect(svg).toContain("45% ± 5%");
    expect(svg).toContain("7 de cada 10 comentarios critican el servicio");
    expect(svg).toContain("&quot;camión fantasma&quot;");
  });
});
