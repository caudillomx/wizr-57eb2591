import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { SmartReportContent } from "./useSmartReport";

export interface SharedReport {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  project_name: string;
  content: SmartReportContent;
  date_range: { start: string; end: string; label: string };
  public_token: string;
  expires_at: string | null;
  is_revoked: boolean;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSharedReportInput {
  project_id: string;
  title: string;
  project_name: string;
  content: SmartReportContent;
  date_range: { start: string; end: string; label: string };
  expires_in_days: number | null; // null = no caduca
}

export function useSharedReportsByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["shared-reports", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shared_reports")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SharedReport[];
    },
  });
}

export function useCreateSharedReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSharedReportInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No autenticado");

      const expires_at = input.expires_in_days
        ? new Date(Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data, error } = await supabase
        .from("shared_reports")
        .insert({
          project_id: input.project_id,
          created_by: userData.user.id,
          title: input.title,
          project_name: input.project_name,
          content: input.content as any,
          date_range: input.date_range as any,
          expires_at,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SharedReport;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shared-reports", data.project_id] });
      toast({ title: "Reporte publicado", description: "Link generado correctamente" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al publicar", description: err.message, variant: "destructive" });
    },
  });
}

export function useRevokeSharedReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("shared_reports")
        .update({ is_revoked: true })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SharedReport;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shared-reports", data.project_id] });
      toast({ title: "Link revocado", description: "El reporte ya no es accesible" });
    },
  });
}

export function useDeleteSharedReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: SharedReport) => {
      const { error } = await supabase.from("shared_reports").delete().eq("id", report.id);
      if (error) throw error;
      return report;
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ["shared-reports", report.project_id] });
      toast({ title: "Reporte eliminado" });
    },
  });
}

/** Pública: usada por la página /r/:token */
export async function fetchPublicReport(token: string): Promise<SharedReport | null> {
  const { data, error } = await supabase
    .from("shared_reports")
    .select("*")
    .eq("public_token", token)
    .eq("is_revoked", false)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Verificar expiración en cliente también
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  // Incrementar contador (fire-and-forget)
  supabase.rpc("increment_report_view", { _token: token }).then(() => {});

  return data as unknown as SharedReport;
}
