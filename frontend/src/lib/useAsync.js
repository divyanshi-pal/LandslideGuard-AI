import { useCallback, useEffect, useRef, useState } from 'react'

// Runs an async loader on mount / when deps change. Keeps the previous data while
// reloading so the UI does not flash back to a skeleton.
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const run = useCallback(() => {
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    loaderRef
      .current({ signal: controller.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState((s) => ({ ...s, error, loading: false }))
      })
    return controller
  }, [])

  useEffect(() => {
    const controller = run()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ...state, reload: run }
}
