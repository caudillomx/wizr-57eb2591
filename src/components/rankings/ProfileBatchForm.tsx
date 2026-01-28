import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Loader2 } from "lucide-react";
import { FKNetwork, getNetworkLabel, useAddFKProfiles, BatchProfileInput } from "@/hooks/useFanpageKarma";

const NETWORKS: FKNetwork[] = ["facebook", "instagram", "youtube", "linkedin", "tiktok", "threads", "twitter"];

const NETWORK_ICONS: Record<FKNetwork, string> = {
  facebook: "📘",
  instagram: "📸",
  youtube: "📺",
  linkedin: "💼",
  tiktok: "🎵",
  threads: "🧵",
  twitter: "𝕏",
};

interface ProfileBatchFormProps {
  projectId: string;
  onSuccess?: () => void;
}

export function ProfileBatchForm({ projectId, onSuccess }: ProfileBatchFormProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<FKNetwork>("facebook");
  const [profilesText, setProfilesText] = useState("");
  
  const addProfiles = useAddFKProfiles();

  const profileCount = profilesText
    .split("\n")
    .map((l) => l.trim().replace(/^@/, ""))
    .filter((l) => l.length > 0).length;

  const handleSubmit = async () => {
    if (profileCount === 0) return;

    const batch: BatchProfileInput = {
      network: selectedNetwork,
      profiles: profilesText,
    };

    await addProfiles.mutateAsync({ projectId, batch });
    setProfilesText("");
    onSuccess?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Agregar Perfiles por Lotes
        </CardTitle>
        <CardDescription>
          Pega los usernames de los perfiles que quieres monitorear (uno por línea).
          Estos deben estar dados de alta en tu cuenta de Fanpage Karma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Red Social</label>
          <Select value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as FKNetwork)}>
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {NETWORKS.map((network) => (
                <SelectItem key={network} value={network}>
                  <span className="flex items-center gap-2">
                    <span>{NETWORK_ICONS[network]}</span>
                    <span>{getNetworkLabel(network)}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Perfiles (uno por línea)</label>
            {profileCount > 0 && (
              <Badge variant="secondary">{profileCount} perfiles</Badge>
            )}
          </div>
          <Textarea
            placeholder={`@actinver\n@banamex\n@banorte\n@bbvaenmexico\n@gbm.mx`}
            value={profilesText}
            onChange={(e) => setProfilesText(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Puedes incluir o no el símbolo @. El sistema lo eliminará automáticamente.
          </p>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={profileCount === 0 || addProfiles.isPending}
          className="w-full"
        >
          {addProfiles.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Agregando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Agregar {profileCount} Perfiles de {getNetworkLabel(selectedNetwork)}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
