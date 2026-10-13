import { createContext, useContext } from "react";

export const AdvisorNotificationsContext = createContext(null);

export function useAdvisorNotifications() {
  const context = useContext(AdvisorNotificationsContext);
  if (!context) throw new Error("useAdvisorNotifications debe usarse dentro de AdvisorNotificationsProvider");
  return context;
}
