import { createContext, useContext } from "react";
export const RealtimeContext = createContext(0);
export const useRealtimeRevision = () => useContext(RealtimeContext);
