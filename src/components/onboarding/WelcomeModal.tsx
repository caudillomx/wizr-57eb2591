import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/stores/onboardingStore";
import wizrLogoIcon from "@/assets/wizr-logo-icon.png";
import { Sparkles, ArrowRight, BookOpen } from "lucide-react";

export function WelcomeModal() {
  const { hasSeenWelcome, setHasSeenWelcome, startTour } = useOnboardingStore();
  const [open, setOpen] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Show modal after a short delay if user hasn't seen it
    if (!hasSeenWelcome) {
      const timer = setTimeout(() => {
        setOpen(true);
        // Animate content after logo animation
        setTimeout(() => setShowContent(true), 800);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasSeenWelcome]);

  const handleClose = () => {
    setOpen(false);
    setHasSeenWelcome(true);
  };

  const handleStartTour = () => {
    setOpen(false);
    setHasSeenWelcome(true);
    startTour();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg overflow-hidden border-primary/20 bg-gradient-to-b from-card to-card/95">
        <div className="flex flex-col items-center py-6 text-center">
          {/* Animated Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              duration: 0.8,
            }}
            className="relative mb-6"
          >
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(139, 92, 246, 0.3)",
                  "0 0 40px rgba(139, 92, 246, 0.5)",
                  "0 0 20px rgba(139, 92, 246, 0.3)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="rounded-full p-4 bg-gradient-to-br from-primary/20 to-accent/20"
            >
              <img
                src={wizrLogoIcon}
                alt="Wizr"
                className="h-24 w-24 object-contain"
              />
            </motion.div>

            {/* Sparkles */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute -top-2 -right-2"
            >
              <Sparkles className="h-6 w-6 text-accent" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="absolute -bottom-1 -left-3"
            >
              <Sparkles className="h-4 w-4 text-primary" />
            </motion.div>
          </motion.div>

          {/* Content */}
          <AnimatePresence>
            {showContent && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    ¡Bienvenido a Wizr!
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tu asistente de inteligencia estratégica
                  </p>
                </div>

                <p className="text-foreground/80 max-w-md">
                  Estoy aquí para ayudarte a convertir conversaciones públicas
                  en <span className="text-primary font-medium">conocimiento accionable</span>.
                  Juntos analizaremos menciones, detectaremos tendencias y
                  generaremos insights valiosos.
                </p>

                <div className="bg-muted/50 rounded-lg p-4 text-left">
                  <p className="text-sm font-medium text-foreground mb-2">
                    Para comenzar necesitarás:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Crear un proyecto de análisis
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Agregar entidades con palabras clave
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Buscar y guardar menciones
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1"
                  >
                    Explorar por mi cuenta
                  </Button>
                  <Button
                    onClick={handleStartTour}
                    className="flex-1 gap-2"
                  >
                    <BookOpen className="h-4 w-4" />
                    Iniciar tour guiado
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
