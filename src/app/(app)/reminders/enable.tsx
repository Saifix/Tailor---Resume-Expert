"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

export function EnableNotifications() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported" | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser permission after hydration
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);
  if (perm === null || perm === "unsupported" || perm === "granted") return null;
  return (
    <Button variant="secondary" disabled={perm === "denied"} onClick={async () => setPerm(await Notification.requestPermission())}>
      <BellRing strokeWidth={1.75} /> {perm === "denied" ? "Notifications blocked" : "Enable desktop alerts"}
    </Button>
  );
}
