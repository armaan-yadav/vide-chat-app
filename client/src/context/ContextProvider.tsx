import { createContext, PropsWithChildren } from "react";

interface ContextType {}

const initialValue: ContextType = {};

export const Context = createContext<ContextType>(initialValue);

export const ContextProvider = (props: PropsWithChildren) => {
  return <Context.Provider value={{}}>{props.children}</Context.Provider>;
};
