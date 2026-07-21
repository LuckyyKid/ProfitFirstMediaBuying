import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PlatformAccessButtonProps {
  language: "en" | "fr";
  className?: string;
}

export const PlatformAccessButton = ({
  language,
  className,
}: PlatformAccessButtonProps) => {
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate("/")}
      className={className}
    >
      <LayoutDashboard className="h-4 w-4 mr-2" />
      {language === "fr" ? "Mes accès" : "My Access"}
    </Button>
  );
};
