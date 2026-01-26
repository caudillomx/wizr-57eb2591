import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import wizrLogo from "@/assets/wizr-logo.png";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center gap-8 text-center">
        {/* Logo */}
        <img
          src={wizrLogo}
          alt="Wizr - Análisis Estratégico"
          className="h-32 w-auto"
        />

        {/* Tagline */}
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Metodología Académica + Magia Analítica + Producto Operativo
          </p>
          <p className="text-sm text-accent">
            Wizard → Wise → Structure + Insight
          </p>
        </div>

        {/* Description */}
        <p className="max-w-xl text-lg text-foreground/80">
          Sistema de lectura estratégica diseñado para convertir conversación
          pública en conocimiento utilizable.
        </p>

        {/* CTA */}
        <div className="flex gap-4">
          {!loading && user ? (
            <Link to="/dashboard">
              <Button className="gap-2">
                Ir al Dashboard
                <ArrowRight size={18} />
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button className="gap-2">
                  Iniciar sesión
                  <ArrowRight size={18} />
                </Button>
              </Link>
              <Link to="/registro">
                <Button variant="outline">Crear cuenta</Button>
              </Link>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-muted-foreground">
          Un producto de <span className="font-medium text-accent">Kimedia</span>
        </p>
      </div>
    </div>
  );
};

export default Index;
