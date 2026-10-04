"use client";

import { Download } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui";

export function PrintButton() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <Button onClick={() => window.print()}>
      <Download strokeWidth={1.75} /> Save as PDF
    </Button>
  );
}
