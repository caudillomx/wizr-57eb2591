import { useState } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ThematicCardForm } from "@/components/fichas/ThematicCardForm";
import { ThematicCardList } from "@/components/fichas/ThematicCardList";
import { FileText, Plus } from "lucide-react";

export default function FichasPage() {
  const { selectedProject } = useProject();
  const [showForm, setShowForm] = useState(false);

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Fichas Temáticas</h2>
        <p className="text-muted-foreground max-w-md">
          Selecciona un proyecto para crear y gestionar fichas temáticas con análisis de
          conversación digital o fichas informativas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fichas Temáticas</h1>
          <p className="text-muted-foreground">
            Análisis estructurados generados con AI a partir de menciones guardadas
          </p>
        </div>

        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Ficha
        </Button>
      </div>

      {/* Card List */}
      <ThematicCardList projectId={selectedProject.id} />

      {/* Create Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <ThematicCardForm
            projectId={selectedProject.id}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
