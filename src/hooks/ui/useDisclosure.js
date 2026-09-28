import { useCallback, useState } from "react";

/**
 * Open/close state for modals and drawers, with an optional payload
 * (e.g. the product being edited).
 */
export function useDisclosure(initialOpen = false) {
  const [state, setState] = useState({ isOpen: initialOpen, data: null });

  const open = useCallback(
    (data = null) => setState({ isOpen: true, data }),
    [],
  );
  const close = useCallback(() => setState({ isOpen: false, data: null }), []);
  const toggle = useCallback(
    () => setState((s) => ({ isOpen: !s.isOpen, data: s.data })),
    [],
  );

  return { isOpen: state.isOpen, data: state.data, open, close, toggle };
}
