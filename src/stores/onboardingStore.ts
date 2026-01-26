import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
  hasSeenWelcome: boolean;
  hasCompletedTour: boolean;
  currentTourStep: number;
  isTourActive: boolean;
  
  // Actions
  setHasSeenWelcome: (value: boolean) => void;
  setHasCompletedTour: (value: boolean) => void;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
  resetOnboarding: () => void;
}

export const TOUR_STEPS = [
  {
    id: 'welcome',
    title: '¡Bienvenido a Wizr!',
    description: 'Soy tu asistente de inteligencia estratégica. Te guiaré en el proceso de análisis.',
    target: null,
  },
  {
    id: 'projects',
    title: 'Tus Proyectos',
    description: 'Aquí gestionas tus proyectos de análisis. Cada proyecto agrupa entidades y menciones relacionadas.',
    target: '[data-tour="project-selector"]',
  },
  {
    id: 'entities',
    title: 'Configura Entidades',
    description: 'Ve a Configuración para agregar las personas, marcas o instituciones que quieres monitorear, junto con sus palabras clave.',
    target: '[data-tour="nav-configuracion"]',
  },
  {
    id: 'sources',
    title: 'Busca Menciones',
    description: 'En Fuentes puedes buscar menciones en la web usando tus entidades o búsquedas manuales.',
    target: '[data-tour="nav-fuentes"]',
  },
  {
    id: 'analysis',
    title: 'Analiza los Datos',
    description: 'Una vez que tengas menciones guardadas, las vistas de Panorama, Semántica y Tendencias cobrarán vida.',
    target: '[data-tour="nav-panorama"]',
  },
  {
    id: 'complete',
    title: '¡Listo para empezar!',
    description: 'Ya conoces lo básico. ¿Comenzamos creando tu primera entidad?',
    target: null,
  },
];

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hasSeenWelcome: false,
      hasCompletedTour: false,
      currentTourStep: 0,
      isTourActive: false,

      setHasSeenWelcome: (value) => set({ hasSeenWelcome: value }),
      setHasCompletedTour: (value) => set({ hasCompletedTour: value }),
      
      startTour: () => set({ isTourActive: true, currentTourStep: 0 }),
      
      nextStep: () => {
        const { currentTourStep } = get();
        if (currentTourStep < TOUR_STEPS.length - 1) {
          set({ currentTourStep: currentTourStep + 1 });
        } else {
          set({ isTourActive: false, hasCompletedTour: true });
        }
      },
      
      prevStep: () => {
        const { currentTourStep } = get();
        if (currentTourStep > 0) {
          set({ currentTourStep: currentTourStep - 1 });
        }
      },
      
      endTour: () => set({ isTourActive: false, hasCompletedTour: true }),
      
      resetOnboarding: () => set({
        hasSeenWelcome: false,
        hasCompletedTour: false,
        currentTourStep: 0,
        isTourActive: false,
      }),
    }),
    {
      name: 'wizr-onboarding',
    }
  )
);
