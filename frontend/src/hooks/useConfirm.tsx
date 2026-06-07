import { useCallback, useRef, useState } from "react";
import ConfirmDialog, { ConfirmDialogState } from "../components/ConfirmDialog";

type ConfirmOptions = Omit<ConfirmDialogState, "open">;

export function useConfirm() {
  const resolverRef = useRef<(value: boolean) => void>();
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    tone: "primary"
  });

  const confirm = useCallback((options: ConfirmOptions) => {
    setState({ open: true, ...options });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = undefined;
    setState((current) => ({ ...current, open: false }));
  };

  const dialog = <ConfirmDialog {...state} onCancel={() => close(false)} onConfirm={() => close(true)} />;

  return { confirm, dialog };
}
