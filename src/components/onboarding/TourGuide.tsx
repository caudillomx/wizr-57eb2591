import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboardingStore, TOUR_STEPS } from "@/stores/onboardingStore";
import { useNavigate } from "react-router-dom";
import wizrLogoIcon from "@/assets/wizr-logo-icon.png";
import { ArrowLeft, ArrowRight, X, Sparkles } from "lucide-react";

export function TourGuide() {
  const navigate = useNavigate();
  const {
    isTourActive,
    currentTourStep,
    nextStep,
    prevStep,
    endTour,
  } = useOnboardingStore();

  const overlayRef = useRef<HTMLDivElement>(null);

  const currentStep = TOUR_STEPS[currentTourStep];

  // Navigate to relevant page based on step
  useEffect(() => {
    if (!isTourActive) return;

    const stepId = currentStep?.id;
    if (stepId === 'entities') {
      navigate('/dashboard/configuracion');
    } else if (stepId === 'sources') {
      navigate('/dashboard/fuentes');
    } else if (stepId === 'analysis' || stepId === 'projects') {
      navigate('/dashboard/panorama');
    }
  }, [currentTourStep, isTourActive, navigate, currentStep?.id]);

  // Highlight target element
  useEffect(() => {
    if (!isTourActive || !currentStep?.target) return;

    const targetEl = document.querySelector(currentStep.target);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetEl.classList.add('tour-highlight');

      return () => {
        targetEl.classList.remove('tour-highlight');
      };
    }
  }, [currentTourStep, isTourActive, currentStep?.target]);

  if (!isTourActive) return null;

  const isFirstStep = currentTourStep === 0;
  const isLastStep = currentTourStep === TOUR_STEPS.length - 1;
  const progress = ((currentTourStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 pointer-events-none"
      >
        {/* Semi-transparent overlay */}
        <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={endTour} />

        {/* Tour tooltip */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md pointer-events-auto"
        >
          <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            {/* Progress bar */}
            <div className="h-1 bg-muted">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-accent"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <div className="p-5">
              <div className="flex items-start gap-4">
                {/* Wizr avatar */}
                <div className="shrink-0">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 p-1.5">
                      <img
                        src={wizrLogoIcon}
                        alt="Wizr"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-accent" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-foreground">
                      {currentStep.title}
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={endTour}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {currentStep.description}
                  </p>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  Paso {currentTourStep + 1} de {TOUR_STEPS.length}
                </div>
                <div className="flex gap-2">
                  {!isFirstStep && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={prevStep}
                      className="gap-1"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Anterior
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={isLastStep ? () => { endTour(); navigate('/dashboard/configuracion'); } : nextStep}
                    className="gap-1"
                  >
                    {isLastStep ? "¡Comenzar!" : "Siguiente"}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
