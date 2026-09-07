export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): ((...args: Args) => void) & { flush: () => void; cancel: () => void } {
  let t: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;

  const wrapped = (...args: Args) => {
    lastArgs = args;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      if (lastArgs) fn(...lastArgs);
    }, ms);
  };

  wrapped.flush = () => {
    if (t) {
      clearTimeout(t);
      t = null;
      if (lastArgs) fn(...lastArgs);
    }
  };
  wrapped.cancel = () => {
    if (t) clearTimeout(t);
    t = null;
    lastArgs = null;
  };

  return wrapped;
}
