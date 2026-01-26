import { useNavigate } from "react-router-dom";
import { useProject, Project } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Plus, Search, FileSearch, AlertTriangle, BarChart3 } from "lucide-react";

const TYPE_ICONS: Record<string, React.ElementType> = {
  monitoreo: Search,
  investigacion: FileSearch,
  crisis: AlertTriangle,
  benchmark: BarChart3,
};

const ProjectSelector = () => {
  const { projects, selectedProject, setSelectedProject, loading } = useProject();
  const navigate = useNavigate();

  if (loading) {
    return <Skeleton className="h-9 w-48" />;
  }

  if (projects.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate("/nuevo-proyecto")}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Crear Proyecto
      </Button>
    );
  }

  const handleChange = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setSelectedProject(project);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <FolderOpen className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedProject?.id || ""}
        onValueChange={handleChange}
      >
        <SelectTrigger className="h-9 w-56 bg-background">
          <SelectValue placeholder="Seleccionar proyecto">
            {selectedProject && (
              <div className="flex items-center gap-2">
                <span className="truncate">{selectedProject.nombre}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-popover">
          {projects.map((project) => {
            const TypeIcon = TYPE_ICONS[project.tipo] || FolderOpen;
            return (
              <SelectItem key={project.id} value={project.id}>
                <div className="flex items-center gap-2">
                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{project.nombre}</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {project.tipo}
                  </Badge>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ProjectSelector;
