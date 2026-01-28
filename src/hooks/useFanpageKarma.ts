import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FKNetwork = "facebook" | "instagram" | "youtube" | "linkedin" | "tiktok" | "threads" | "twitter";

export interface FKProfile {
  id: string;
  project_id: string;
  network: FKNetwork;
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_own_profile: boolean;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FKProfileKPI {
  id: string;
  fk_profile_id: string;
  period_start: string;
  period_end: string;
  followers: number | null;
  follower_growth_percent: number | null;
  engagement_rate: number | null;
  posts_per_day: number | null;
  reach_per_day: number | null;
  impressions_per_interaction: number | null;
  page_performance_index: number | null;
  raw_data: Record<string, unknown>;
  fetched_at: string;
}

export interface BatchProfileInput {
  network: FKNetwork;
  profiles: string; // newline-separated profile IDs
}

const NETWORK_LABELS: Record<FKNetwork, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  threads: "Threads",
  twitter: "Twitter/X",
};

export const getNetworkLabel = (network: FKNetwork) => NETWORK_LABELS[network];

export function useFKProfiles(projectId: string | undefined) {
  return useQuery({
    queryKey: ["fk-profiles", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("fk_profiles")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("network", { ascending: true })
        .order("display_name", { ascending: true });

      if (error) throw error;
      return data as FKProfile[];
    },
    enabled: !!projectId,
  });
}

export function useFKProfileKPIs(profileIds: string[], periodStart?: string, periodEnd?: string) {
  return useQuery({
    queryKey: ["fk-kpis", profileIds, periodStart, periodEnd],
    queryFn: async () => {
      if (profileIds.length === 0) return [];

      let query = supabase
        .from("fk_profile_kpis")
        .select("*")
        .in("fk_profile_id", profileIds)
        .order("fetched_at", { ascending: false });

      if (periodStart && periodEnd) {
        query = query.eq("period_start", periodStart).eq("period_end", periodEnd);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FKProfileKPI[];
    },
    enabled: profileIds.length > 0,
  });
}

export function useAddFKProfiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, batch }: { projectId: string; batch: BatchProfileInput }) => {
      const profileLines = batch.profiles
        .split("\n")
        .map((line) => line.trim().replace(/^@/, ""))
        .filter((line) => line.length > 0);

      if (profileLines.length === 0) {
        throw new Error("No se proporcionaron perfiles válidos");
      }

      const profilesToInsert = profileLines.map((profileId) => ({
        project_id: projectId,
        network: batch.network,
        profile_id: profileId,
        display_name: profileId,
        is_own_profile: false,
        is_active: true,
      }));

      const { data, error } = await supabase
        .from("fk_profiles")
        .upsert(profilesToInsert, { onConflict: "project_id,network,profile_id" })
        .select();

      if (error) throw error;
      return { inserted: data.length, network: batch.network };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["fk-profiles", variables.projectId] });
      toast.success(`${result.inserted} perfiles de ${getNetworkLabel(result.network as FKNetwork)} agregados`);
    },
    onError: (error: Error) => {
      toast.error(`Error al agregar perfiles: ${error.message}`);
    },
  });
}

export function useDeleteFKProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, projectId }: { profileId: string; projectId: string }) => {
      const { error } = await supabase
        .from("fk_profiles")
        .delete()
        .eq("id", profileId);

      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ["fk-profiles", projectId] });
      toast.success("Perfil eliminado");
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });
}

export function useSyncFKProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profile, periodDays = 28 }: { profile: FKProfile; periodDays?: number }) => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - periodDays);

      const period = `${startDate.toISOString().split("T")[0]}_${endDate.toISOString().split("T")[0]}`;

      const { data, error } = await supabase.functions.invoke("fanpage-karma", {
        body: {
          action: "kpi",
          network: profile.network,
          profileId: profile.profile_id,
          period,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Error al obtener KPIs");

      // Store the KPIs
      const kpiData = data.data || {};
      const { error: insertError } = await supabase
        .from("fk_profile_kpis")
        .upsert({
          fk_profile_id: profile.id,
          period_start: startDate.toISOString().split("T")[0],
          period_end: endDate.toISOString().split("T")[0],
          followers: kpiData.fans || kpiData.followers || null,
          follower_growth_percent: kpiData.fansGrowth || kpiData.followerGrowth || null,
          engagement_rate: kpiData.interactionRate || kpiData.engagementRate || null,
          posts_per_day: kpiData.postsPerDay || null,
          reach_per_day: kpiData.reachPerDay || null,
          impressions_per_interaction: kpiData.impressionsPerInteraction || null,
          page_performance_index: kpiData.pagePerformanceIndex || null,
          raw_data: kpiData,
          fetched_at: new Date().toISOString(),
        }, { onConflict: "fk_profile_id,period_start,period_end" });

      if (insertError) throw insertError;

      // Update last_synced_at
      await supabase
        .from("fk_profiles")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", profile.id);

      return { profile, kpiData };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["fk-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["fk-kpis"] });
      toast.success(`KPIs de ${result.profile.display_name || result.profile.profile_id} sincronizados`);
    },
    onError: (error: Error) => {
      toast.error(`Error al sincronizar: ${error.message}`);
    },
  });
}
