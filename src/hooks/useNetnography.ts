import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { NetnographyStudy, ViralSignal } from "@/types/netnography";

export function useNetnographyStudies(filters?: { projectId?: string; kind?: string }) {
  return useQuery({
    queryKey: ["netnography-studies", filters],
    queryFn: async () => {
      const { data } = await api.get<{ studies: NetnographyStudy[] }>("/netnography/studies", {
        params: filters,
      });
      return data.studies || [];
    },
  });
}

export function useNetnographyStudy(studyId?: string) {
  return useQuery({
    queryKey: ["netnography-study", studyId],
    enabled: Boolean(studyId),
    queryFn: async () => {
      const { data } = await api.get<{ study: NetnographyStudy }>(`/netnography/studies/${studyId}`);
      return data.study;
    },
  });
}

export function useCreateNetnographyStudy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const { data } = await api.post("/netnography/studies", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["netnography-studies"] });
    },
  });
}

export function useDeleteNetnographyStudy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (studyId: string) => {
      await api.delete(`/netnography/studies/${studyId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["netnography-studies"] });
    },
  });
}

export function useViralSignals(geo = "MX") {
  return useQuery({
    queryKey: ["netnography-signals", geo],
    queryFn: async () => {
      const { data } = await api.get<{ signals: ViralSignal[] }>("/netnography/signals", {
        params: { geo },
      });
      return data.signals || [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useValidationQueue(studyId?: string) {
  return useQuery({
    queryKey: ["netnography-validation", studyId],
    enabled: Boolean(studyId),
    queryFn: async () => {
      const { data } = await api.get(`/netnography/studies/${studyId}/validation-queue`);
      return data;
    },
  });
}
