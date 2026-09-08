import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export function DocumentSettingsNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = window.desktopBridge?.onMenuAction((action) => {
      if (action === "open-settings")
        void navigate({ to: "/preferences", search: { section: "accounts" } });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.shiftKey) return;
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        void navigate({ to: "/preferences", search: { section: "accounts" } });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      unsubscribe?.();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navigate]);

  return null;
}
