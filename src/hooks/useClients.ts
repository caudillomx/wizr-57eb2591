import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { canonicalizeFKProfileIdentity } from "@/lib/fkProfileUtils";

export interface Client {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  services_enabled: Record<string, unknown>;
  kimediamx_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useClients() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Client[];
    },
    enabled: !!user,
  });
}

export function useClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
    enabled: !!clientId,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!user) throw new Error("No autenticado");
      const { data, error } = await supabase
        .from("clients")
        .insert({ user_id: user.id, name, description: description || null })
        .select()
        .single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente creado");
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string }) => {
      const { data, error } = await supabase
        .from("clients")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", data.id] });
      toast.success("Cliente actualizado");
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente eliminado");
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });
}

// FK profiles for a client (with brand/competitor filter)
export interface ClientFKProfile {
  id: string;
  client_id: string | null;
  network: string;
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_competitor: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useFKProfilesByClient(clientId: string | undefined, mode: "all" | "brand" | "benchmark" = "all") {
  return useQuery({
    queryKey: ["fk-profiles-client", clientId, mode],
    queryFn: async () => {
      if (!clientId) return [];
      let q = supabase
        .from("fk_profiles")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true);
      if (mode === "brand") q = q.eq("is_competitor", false);
      // benchmark = all profiles (brand + competitors)
      const { data, error } = await q
        .order("is_competitor", { ascending: true })
        .order("network", { ascending: true })
        .order("display_name", { ascending: true });
      if (error) throw error;

      const deduped = new Map<string, ClientFKProfile>();

      for (const profile of (data || []) as ClientFKProfile[]) {
        const dedupKey = [
          profile.network,
          profile.is_competitor ? "competitor" : "brand",
          canonicalizeFKProfileIdentity(profile.display_name || profile.profile_id),
        ].join("::");

        const existing = deduped.get(dedupKey);
        if (!existing) {
          deduped.set(dedupKey, profile);
          continue;
        }

        const existingTimestamp = existing.last_synced_at ? new Date(existing.last_synced_at).getTime() : 0;
        const candidateTimestamp = profile.last_synced_at ? new Date(profile.last_synced_at).getTime() : 0;
        const keepCandidate =
          candidateTimestamp > existingTimestamp ||
          (!!profile.display_name && !existing.display_name) ||
          (candidateTimestamp === existingTimestamp && new Date(profile.created_at).getTime() < new Date(existing.created_at).getTime());

        if (keepCandidate) {
          deduped.set(dedupKey, profile);
        }
      }

      return Array.from(deduped.values());
    },
    enabled: !!clientId,
  });
}
