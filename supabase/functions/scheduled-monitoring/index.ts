import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Entity {
  id: string;
  nombre: string;
  palabras_clave: string[];
  aliases: string[];
  project_id: string;
  activo: boolean;
}

interface Project {
  id: string;
  nombre: string;
  user_id: string;
  activo: boolean;
}

interface AlertConfig {
  id: string;
  project_id: string;
  name: string;
  alert_type: 'sentiment_negative' | 'mention_spike' | 'keyword_match';
  threshold_percent: number | null;
  keywords: string[] | null;
  entity_ids: string[] | null;
  is_active: boolean;
  trigger_count: number;
}

interface SearchResult {
  url: string;
  title: string;
  description: string;
  metadata?: {
    publishedDate?: string;
    sourceURL?: string;
  };
}

interface NewMention {
  project_id: string;
  entity_id: string;
  url: string;
  title: string | null;
  description: string | null;
  source_domain: string | null;
  published_at: string | null;
  matched_keywords: string[];
}

function buildEntitySearchQuery(entity: Entity): string {
  const terms: string[] = [];
  terms.push(`"${entity.nombre}"`);
  
  entity.aliases.forEach((alias) => {
    if (alias.trim()) {
      terms.push(`"${alias.trim()}"`);
    }
  });
  
  const keywordContext = entity.palabras_clave
    .slice(0, 3)
    .filter((k) => k.trim())
    .join(' ');
  
  const nameAliasQuery = terms.join(' OR ');
  
  if (keywordContext) {
    return `(${nameAliasQuery}) ${keywordContext}`;
  }
  
  return nameAliasQuery;
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function matchKeywords(content: string, entity: Entity): string[] {
  const searchTerms = [
    entity.nombre.toLowerCase(),
    ...entity.aliases.map((a) => a.toLowerCase()),
    ...entity.palabras_clave.map((k) => k.toLowerCase()),
  ];
  
  const lowerContent = content.toLowerCase();
  return searchTerms.filter((term) => lowerContent.includes(term));
}

async function searchFirecrawl(query: string, apiKey: string): Promise<SearchResult[]> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 10,
        lang: 'es',
        country: 'MX',
        tbs: 'qdr:d', // Last 24 hours
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl search failed:', response.status);
      return [];
    }

    const data = await response.json();
    return data?.data || [];
  } catch (error) {
    console.error('Firecrawl search error:', error);
    return [];
  }
}

function evaluateAlertRules(
  alertConfigs: AlertConfig[],
  newMentions: NewMention[],
  projectMentionCounts: Map<string, { previous: number; current: number }>
): Array<{
  config: AlertConfig;
  triggeredBy: NewMention[];
  reason: string;
}> {
  const triggeredAlerts: Array<{
    config: AlertConfig;
    triggeredBy: NewMention[];
    reason: string;
  }> = [];

  for (const config of alertConfigs) {
    if (!config.is_active) continue;

    const projectMentions = newMentions.filter(m => m.project_id === config.project_id);
    
    // Filter by entity if specified
    const relevantMentions = config.entity_ids && config.entity_ids.length > 0
      ? projectMentions.filter(m => config.entity_ids!.includes(m.entity_id))
      : projectMentions;

    if (relevantMentions.length === 0) continue;

    switch (config.alert_type) {
      case 'keyword_match': {
        if (!config.keywords || config.keywords.length === 0) continue;
        
        const matchedMentions = relevantMentions.filter(mention => {
          const content = `${mention.title || ''} ${mention.description || ''}`.toLowerCase();
          return config.keywords!.some(kw => content.includes(kw.toLowerCase()));
        });

        if (matchedMentions.length > 0) {
          triggeredAlerts.push({
            config,
            triggeredBy: matchedMentions,
            reason: `Se encontraron ${matchedMentions.length} menciones con palabras clave monitoreadas`,
          });
        }
        break;
      }

      case 'mention_spike': {
        const counts = projectMentionCounts.get(config.project_id);
        if (!counts) continue;
        
        const threshold = config.threshold_percent || 50;
        const percentIncrease = counts.previous > 0 
          ? ((counts.current - counts.previous) / counts.previous) * 100
          : counts.current > 0 ? 100 : 0;

        if (percentIncrease >= threshold) {
          triggeredAlerts.push({
            config,
            triggeredBy: relevantMentions,
            reason: `Incremento de ${percentIncrease.toFixed(0)}% en menciones (umbral: ${threshold}%)`,
          });
        }
        break;
      }

      case 'sentiment_negative': {
        // For now, flag all new mentions for sentiment review
        // In production, this would integrate with sentiment analysis
        if (relevantMentions.length >= 3) {
          triggeredAlerts.push({
            config,
            triggeredBy: relevantMentions,
            reason: `${relevantMentions.length} nuevas menciones requieren análisis de sentimiento`,
          });
        }
        break;
      }
    }
  }

  return triggeredAlerts;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting scheduled monitoring...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to bypass RLS (scheduled job has no user context)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, nombre, user_id, activo')
      .eq('activo', true);

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      throw projectsError;
    }

    if (!projects || projects.length === 0) {
      console.log('No active projects found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active projects', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${projects.length} active projects`);

    // Fetch active entities for all projects
    const projectIds = projects.map(p => p.id);
    const { data: entities, error: entitiesError } = await supabase
      .from('entities')
      .select('*')
      .in('project_id', projectIds)
      .eq('activo', true);

    if (entitiesError) {
      console.error('Error fetching entities:', entitiesError);
      throw entitiesError;
    }

    if (!entities || entities.length === 0) {
      console.log('No active entities found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active entities', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${entities.length} active entities`);

    // Get existing mention URLs for deduplication
    const { data: existingMentions } = await supabase
      .from('mentions')
      .select('url, project_id')
      .in('project_id', projectIds);

    const existingUrls = new Set(
      (existingMentions || []).map(m => `${m.project_id}:${m.url}`)
    );

    // Get mention counts from last 24 hours for spike detection
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: recentCounts } = await supabase
      .from('mentions')
      .select('project_id')
      .in('project_id', projectIds)
      .gte('created_at', yesterday.toISOString());

    const previousCounts = new Map<string, number>();
    for (const mention of (recentCounts || [])) {
      previousCounts.set(
        mention.project_id,
        (previousCounts.get(mention.project_id) || 0) + 1
      );
    }

    // Fetch alert configurations
    const { data: alertConfigs } = await supabase
      .from('alert_configs')
      .select('*')
      .in('project_id', projectIds)
      .eq('is_active', true);

    // Search for mentions per entity
    const allNewMentions: NewMention[] = [];
    const projectMentionCounts = new Map<string, { previous: number; current: number }>();

    // Initialize counts
    for (const projectId of projectIds) {
      projectMentionCounts.set(projectId, {
        previous: previousCounts.get(projectId) || 0,
        current: 0,
      });
    }

    for (const entity of entities) {
      const query = buildEntitySearchQuery(entity as Entity);
      console.log(`Searching for entity "${entity.nombre}": ${query}`);

      const results = await searchFirecrawl(query, firecrawlApiKey);
      console.log(`Found ${results.length} results for "${entity.nombre}"`);

      for (const result of results) {
        const urlKey = `${entity.project_id}:${result.url}`;
        
        // Skip duplicates
        if (existingUrls.has(urlKey)) {
          continue;
        }

        existingUrls.add(urlKey);

        const content = `${result.title} ${result.description}`;
        const matchedKeywords = matchKeywords(content, entity as Entity);

        const mention: NewMention = {
          project_id: entity.project_id,
          entity_id: entity.id,
          url: result.url,
          title: result.title || null,
          description: result.description || null,
          source_domain: extractDomain(result.url),
          published_at: result.metadata?.publishedDate || null,
          matched_keywords: matchedKeywords,
        };

        allNewMentions.push(mention);

        // Update current count
        const counts = projectMentionCounts.get(entity.project_id)!;
        counts.current += 1;
      }

      // Rate limiting - wait 500ms between searches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Total new mentions found: ${allNewMentions.length}`);

    // Save new mentions
    if (allNewMentions.length > 0) {
      const { error: insertError } = await supabase
        .from('mentions')
        .insert(allNewMentions);

      if (insertError) {
        console.error('Error inserting mentions:', insertError);
        // Continue anyway to evaluate alerts
      } else {
        console.log(`Saved ${allNewMentions.length} new mentions`);
      }
    }

    // Evaluate alert rules
    const triggeredAlerts = evaluateAlertRules(
      (alertConfigs || []) as AlertConfig[],
      allNewMentions,
      projectMentionCounts
    );

    console.log(`Triggered ${triggeredAlerts.length} alerts`);

    // Create notifications for triggered alerts
    const notifications = triggeredAlerts.map(alert => ({
      alert_config_id: alert.config.id,
      project_id: alert.config.project_id,
      title: `Alerta: ${alert.config.name}`,
      message: alert.reason,
      severity: alert.config.alert_type === 'sentiment_negative' ? 'error' : 'warning',
      metadata: {
        mention_count: alert.triggeredBy.length,
        sample_urls: alert.triggeredBy.slice(0, 3).map(m => m.url),
      },
    }));

    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('alert_notifications')
        .insert(notifications);

      if (notifError) {
        console.error('Error creating notifications:', notifError);
      } else {
        console.log(`Created ${notifications.length} notifications`);

        // Update trigger counts on alert configs
        for (const alert of triggeredAlerts) {
          await supabase
            .from('alert_configs')
            .update({
              trigger_count: alert.config.trigger_count + 1,
              last_triggered_at: new Date().toISOString(),
            })
            .eq('id', alert.config.id);
        }
      }
    }

    const result = {
      success: true,
      processed: {
        projects: projects.length,
        entities: entities.length,
        newMentions: allNewMentions.length,
        alertsTriggered: triggeredAlerts.length,
      },
    };

    console.log('Scheduled monitoring completed:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scheduled monitoring error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
