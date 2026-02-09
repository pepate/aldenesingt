'use client';
import { useMemo, useRef, DependencyList } from 'react';
import { isEqual } from 'lodash';

export const useMemoFirebase = <T>(
  factory: () => T,
  deps: DependencyList
): T => {
  // Use a custom equality check for deep comparison of dependencies
  const dependencies = useDeepCompareMemoize(deps);
  return useMemo(factory, dependencies);
};

// Custom hook for deep comparison memoization
const useDeepCompareMemoize = (value: any) => {
  const ref = useRef();

  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }

  return ref.current;
};
