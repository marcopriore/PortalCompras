import { useEffect, useRef, useCallback } from "react"

export interface UseAutoRefreshOptions {
  intervalMs: number
  onRefresh: () => void
  enabled?: boolean
  pauseWhenHidden?: boolean
}

export function useAutoRefresh({
  intervalMs,
  onRefresh,
  enabled = true,
  pauseWhenHidden = true,
}: UseAutoRefreshOptions) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isHiddenRef = useRef(false)

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (pauseWhenHidden && isHiddenRef.current) return
      onRefresh()
    }, intervalMs)
  }, [intervalMs, onRefresh, pauseWhenHidden])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      stopTimer()
      return
    }
    startTimer()
    return () => stopTimer()
  }, [enabled, startTimer, stopTimer])

  useEffect(() => {
    if (!pauseWhenHidden) return
    const handleVisibility = () => {
      isHiddenRef.current = document.hidden
      if (!document.hidden && enabled) {
        onRefresh()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [pauseWhenHidden, enabled, onRefresh])
}
