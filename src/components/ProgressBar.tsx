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
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 mb-8">
      <div className="relative">
        {/* Progress Line — hairline + fill dégradé bleu */}
        <div className="absolute top-4 sm:top-5 left-0 right-0 h-[3px] rounded-full bg-[rgba(148,170,215,0.12)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#4d9fff,#2f6bff)] shadow-[0_0_12px_rgba(77,159,255,0.5)] transition-all duration-500"
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
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-mono text-xs sm:text-sm transition-all duration-300 border",
                    isCompleted &&
                      "bg-[linear-gradient(135deg,#4d9fff,#2f6bff)] border-transparent text-white shadow-[0_4px_16px_rgba(47,107,255,0.35)]",
                    isCurrent &&
                      "bg-[linear-gradient(135deg,rgba(77,159,255,0.14),rgba(47,107,255,0.05))] border-[rgba(77,159,255,0.4)] text-[#9ec8ff] scale-110 shadow-[0_0_24px_rgba(47,107,255,0.35)]",
                    !isCompleted && !isCurrent &&
                      "bg-background border-[rgba(148,170,215,0.12)] text-[#5f6b82]"
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : displayNumber}
                </div>

                <span
                  className={cn(
                    "hidden sm:block text-[10px] sm:text-xs font-medium text-center max-w-[90px] transition-colors duration-300",
                    isCurrent && "text-[#9ec8ff]",
                    isCompleted && "text-[#c8d2e4]",
                    !isCurrent && !isCompleted && "text-[#5f6b82]"
                  )}
                >
                  {label}
                </span>
                {isCurrent && (
                  <span className="sm:hidden text-[10px] font-medium text-center text-[#9ec8ff] whitespace-nowrap">
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
