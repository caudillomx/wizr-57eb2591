export interface NetnographySource {
  id: string;
  study_id: string;
  url: string;
  platform: "instagram" | "tiktok" | "youtube" | "facebook" | "x" | "fanpage_karma";
  post_id: string | null;
  community_name: string | null;
  status: string;
  max_comments: number;
  include_replies: boolean;
  comment_count: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface NetnographyNarrative {
  id: string;
  title: string;
  description: string;
  traction: "alta" | "media" | "baja";
  framing?: { problema?: string; causa?: string; juicio?: string; solucion?: string } | null;
  count: number;
  share: number;
  moe: number;
  examples: Array<{
    text: string;
    author: string | null;
    likes: number;
    platform: string;
    url: string | null;
    is_reply: boolean;
  }>;
}

export interface NetnographyAnalysisResult {
  topic_label: string;
  headline: string;
  executive_summary: string;
  temperature: { score: number; label: string; summary: string };
  total_comments: number;
  analyzed_comments: number;
  effective_sample_size: number;
  sentiment: { positive: number; neutral: number; negative: number };
  stance?: {
    target?: string;
    total: number;
    no_aplica: number;
    n_base: number;
    favor: { share: number; count: number; moe: number };
    contra: { share: number; count: number; moe: number };
    ambigua: { share: number; count: number; moe: number };
  };
  narratives: NetnographyNarrative[];
  emotions: Array<{ key: string; count: number; share: number }>;
  organicOnly?: {
    sentiment: { positive: number; neutral: number; negative: number };
    narratives: NetnographyNarrative[];
    emotions: Array<{ key: string; count: number; share: number }>;
  };
  authenticity?: {
    total: number;
    organic: number;
    suspicious: number;
    coordinated: number;
  };
  archetypes: Array<{
    name: string;
    description: string;
    stance: string;
    tone: string;
    arguments: string[];
    share: number;
  }>;
  emic_terms: Array<{ term: string; meaning: string; platform: string; recommendation: string }>;
  alerts: Array<{ type: string; level: string; description: string; signal: string; horizon: string }>;
  recommendations: Array<{ action: string; owner: string; when: string; narrative_id: string }>;
  keywords: Array<{ term: string; weight: number }>;
  stats?: { timeline: Array<{ day: string; count: number }> };
  news_context?: Array<{ title: string; url: string; outlet: string; publishedAt: string | null }>;
  methodology?: {
    generated_at: string;
    is_census: boolean;
    stratum_summary: Array<{ stratum: string; populationN: number; sampleN: number; weight: number }>;
    sources: Array<{ platform: string; url: string; target: number; collected: number; finished_at: string | null }>;
  };
}

export interface NetnographyValidationMetrics {
  reviewedCount: number;
  sentimentAgreement: number | null;
  sentimentKappa: number | null;
  sentimentAlpha: number | null;
  stanceKappa: number | null;
  narrativeKappa: number | null;
}

export interface NetnographyAnalysis {
  id: string;
  study_id: string;
  status: "procesando" | "completado" | "error";
  stage: "muestreo" | "sintesis" | "clasificacion" | "agregado" | "completado";
  model: string | null;
  comment_count: number;
  sample_size: number;
  effective_sample_size: number;
  batches_total: number;
  batches_done: number;
  codebook: Array<{ id: string; title: string; description: string }>;
  result: NetnographyAnalysisResult | null;
  validation_metrics: NetnographyValidationMetrics | null;
  field_diary: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface NetnographyStudy {
  id: string;
  folio: string | null;
  kind: "quick" | "deep";
  title: string;
  topic: string;
  central_question: string | null;
  requester: string | null;
  decision_enabled: string | null;
  universe_definition: string | null;
  hypothesis: string | null;
  ethical_risk: string;
  stance_target: string | null;
  project_id: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  sources: NetnographySource[];
  analyses: NetnographyAnalysis[];
}

export interface ViralSignal {
  key: string;
  title: string;
  description: string;
  reach: number;
  signals: Array<{
    platform: "google_trends" | "bluesky" | "youtube";
    geo: string;
    traffic?: number;
    posts?: number;
    views?: number;
    at: string | null;
    link: string | null;
  }>;
  news: Array<{ title: string; url: string; outlet: string }>;
}
