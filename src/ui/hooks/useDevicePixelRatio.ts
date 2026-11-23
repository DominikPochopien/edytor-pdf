import { useEffect, useState } from 'react';

/** Current devicePixelRatio, updated when the window moves to another screen or the user zooms the browser. */
export function useDevicePixelRatio(): number {
  const [ratio, setRatio] = useState(() => window.devicePixelRatio);
  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${ratio}dppx)`);
    const onChange = (): void => {
      setRatio(window.devicePixelRatio);
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, [ratio]);
  return ratio;
}
