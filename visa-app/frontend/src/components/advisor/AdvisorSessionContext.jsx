import { createContext, useContext } from "react";

const AdvisorSessionContext = createContext(null);

export const AdvisorSessionProvider = AdvisorSessionContext.Provider;

export function useAdvisorSession() {
  const session = useContext(AdvisorSessionContext);
  if (!session) throw new Error("useAdvisorSession debe usarse dentro de RequireAdvisor");
  return session;
}
