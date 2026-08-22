"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { PageLoading } from "@/components/ui/page-loading"
import { cn } from "@/lib/utils"

const OVERLAY_DELAY_MS = 180

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams.toString()}`

  const [isNavigating, setIsNavigating] = React.useState(false)
  const [showOverlay, setShowOverlay] = React.useState(false)
  const [progress, setProgress] = React.useState(0)

  const progressTimerRef = React.useRef<number | null>(null)
  const overlayTimerRef = React.useRef<number | null>(null)
  const completeTimerRef = React.useRef<number | null>(null)

  const clearTimers = React.useCallback(() => {
    if (progressTimerRef.current != null) {
      window.clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (overlayTimerRef.current != null) {
      window.clearTimeout(overlayTimerRef.current)
      overlayTimerRef.current = null
    }
    if (completeTimerRef.current != null) {
      window.clearTimeout(completeTimerRef.current)
      completeTimerRef.current = null
    }
  }, [])

  const startNavigation = React.useCallback(() => {
    clearTimers()
    setIsNavigating(true)
    setShowOverlay(false)
    setProgress(12)

    overlayTimerRef.current = window.setTimeout(() => {
      setShowOverlay(true)
    }, OVERLAY_DELAY_MS)

    progressTimerRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return current
        return current + Math.random() * 8
      })
    }, 220)
  }, [clearTimers])

  const finishNavigation = React.useCallback(() => {
    clearTimers()
    setProgress(100)
    completeTimerRef.current = window.setTimeout(() => {
      setIsNavigating(false)
      setShowOverlay(false)
      setProgress(0)
    }, 280)
  }, [clearTimers])

  React.useEffect(() => {
    finishNavigation()
  }, [routeKey, finishNavigation])

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target as HTMLElement | null
      const anchor = target?.closest("a")
      if (!anchor) return

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return
      }

      try {
        const nextUrl = new URL(href, window.location.href)
        if (nextUrl.origin !== window.location.origin) return

        const nextRoute = `${nextUrl.pathname}${nextUrl.search}`
        const currentRoute = `${window.location.pathname}${window.location.search}`
        if (nextRoute !== currentRoute) {
          startNavigation()
        }
      } catch {
        // ignore malformed href
      }
    }

    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [startNavigation])

  React.useEffect(() => clearTimers, [clearTimers])

  if (!isNavigating && progress === 0) return null

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 bg-primary/15"
        aria-hidden="true"
      >
        <div
          className={cn(
            "h-full bg-primary transition-[width] duration-200 ease-out",
            progress >= 100 && "opacity-0 transition-opacity duration-300",
          )}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {showOverlay ? <PageLoading overlay label="Carregando..." /> : null}
    </>
  )
}
