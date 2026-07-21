import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  language: "en" | "fr";
  onLanguageChange: (lang: "en" | "fr") => void;
}

export const LanguageSwitcher = ({ language, onLanguageChange }: LanguageSwitcherProps) => {
  return (
    <Button
      variant="glass"
      size="sm"
      onClick={() => onLanguageChange(language === "en" ? "fr" : "en")}
      className="gap-2"
    >
      <Globe className="h-4 w-4" />
      {language === "en" ? "FR" : "EN"}
    </Button>
  );
};
