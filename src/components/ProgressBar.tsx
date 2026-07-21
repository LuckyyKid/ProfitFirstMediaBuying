import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  /** File-based step number (matches /stepN route). */
  currentStep: number;
  language: "en" | "fr";
}

// New logical flow order (as displayed to the client).
// Each entry maps a display position to the underlying file step number.
const flow = [
  { file: 1, en: "Welcome", fr: "Bienvenue" },
  { file: 2, en: "Platform Access", fr: "Accès Plateformes" },
  { file: 3, en: "Onboarding Form", fr: "Formulaire" },
  { file: 4, en: "Founder Scan", fr: "Founder Scan" },
  { file: 6, en: "Payment", fr: "Paiement" },
  { file: 7, en: "Contract", fr: "Contrat" },
  { file: 5, en: "Business Deep Dive", fr: "Business Deep Dive" },
  { file: 8, en: "Kickoff Call", fr: "Appel Démarrage" },
  { file: 9, en: "Complete", fr: "Terminé" },
];

export const ProgressBar = ({ currentStep, language }: ProgressBarProps) => {
  const total = flow.length;
  const currentDisplay = Math.max(
    1,
    flow.findIndex((s) => s.file === currentStep) + 1
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mb-8">
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-1 bg-border">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500"
            style={{ width: `${((currentDisplay - 1) / (total - 1)) * 100}%` }}
          />
        </div>

        {/* Steps */}
        <div className="relative flex justify-between">
          {flow.map((step, index) => {
            const displayNumber = index + 1;
            const isCompleted = displayNumber < currentDisplay;
            const isCurrent = displayNumber === currentDisplay;
            const label = language === "fr" ? step.fr : step.en;

            return (
              <div
                key={`${step.file}-${index}`}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 border-2",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "bg-background border-primary text-primary scale-110 shadow-lg",
                    !isCompleted && !isCurrent && "bg-background border-border text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : displayNumber}
                </div>

                <span
                  className={cn(
                    "text-xs font-medium text-center max-w-[90px] transition-colors duration-300",
                    (isCurrent || isCompleted) ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
