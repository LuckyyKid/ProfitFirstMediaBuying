import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomePackSectionProps {
  translations: {
    welcomePackTitle: string;
    downloadPDF: string;
  };
}

const pdfItems = [
  { id: 1, nameEn: "Getting Started Guide", nameFr: "Guide de démarrage" },
  { id: 2, nameEn: "Best Practices", nameFr: "Meilleures pratiques" },
  { id: 3, nameEn: "Quick Reference", nameFr: "Référence rapide" },
];

export const WelcomePackSection = ({ translations }: WelcomePackSectionProps) => {
  return (
    <div className="mt-8 space-y-4">
      <h3 className="text-xl font-semibold text-center">{translations.welcomePackTitle}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pdfItems.map((item) => (
          <div
            key={item.id}
            className="glass-card p-4 rounded-xl hover:scale-105 transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.nameEn}</p>
                <p className="text-xs text-muted-foreground">{item.nameFr}</p>
              </div>
              <Download className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
