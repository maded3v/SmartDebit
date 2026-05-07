// Путь: frontend/src/hooks/useTimeTravel.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const MAX_FORWARD_DAYS = 365

function startOfDay(date: Date): Date {
  const next = new Date(date.getTime())
  next.setHours(0, 0, 0, 0)
  return next
}

function shiftDate(base: Date, days: number): Date {
  const next = startOfDay(base)
  next.setDate(next.getDate() + days)
  return next
}

function diffInDays(later: Date, earlier: Date): number {
  return Math.round(
    (startOfDay(later).getTime() - startOfDay(earlier).getTime()) / ONE_DAY_MS,
  )
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface TimeTravelContextValue {
  virtualDate: Date | null
  effectiveDate: Date
  daysFromToday: number
  asOfDateParam: string | null
  isSimulating: boolean
  shiftDays: (days: number) => void
  setVirtualDate: (date: Date | null) => void
  reset: () => void
}

const TimeTravelContext = createContext<TimeTravelContextValue | null>(null)

interface TimeTravelProviderProps {
  children: ReactNode
}

export function TimeTravelProvider({ children }: TimeTravelProviderProps) {
  const [virtualDate, setVirtualDateState] = useState<Date | null>(null)
  const [today, setToday] = useState<Date>(() => startOfDay(new Date()))

  useEffect(() => {
    const interval = window.setInterval(() => {
      setToday((prev) => {
        const nextToday = startOfDay(new Date())
        return nextToday.getTime() === prev.getTime() ? prev : nextToday
      })
    }, 60 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

  const setVirtualDate = useCallback(
    (date: Date | null) => {
      if (date === null) {
        setVirtualDateState(null)
        return
      }
      const normalized = startOfDay(date)
      const maxDate = shiftDate(today, MAX_FORWARD_DAYS)
      const clamped = normalized > maxDate ? maxDate : normalized
      setVirtualDateState(clamped)
    },
    [today],
  )

  const shiftDays = useCallback(
    (days: number) => {
      setVirtualDateState((current) => {
        const base = current ?? today
        const candidate = shiftDate(base, days)
        const maxDate = shiftDate(today, MAX_FORWARD_DAYS)
        if (candidate > maxDate) {
          return maxDate
        }
        if (candidate < today) {
          return today
        }
        return candidate
      })
    },
    [today],
  )

  const reset = useCallback(() => {
    setVirtualDateState(null)
  }, [])

  const value = useMemo<TimeTravelContextValue>(() => {
    const effectiveDate = virtualDate ?? today
    const isSimulating = virtualDate !== null
    return {
      virtualDate,
      effectiveDate,
      daysFromToday: isSimulating ? diffInDays(effectiveDate, today) : 0,
      asOfDateParam: isSimulating ? formatIsoDate(effectiveDate) : null,
      isSimulating,
      shiftDays,
      setVirtualDate,
      reset,
    }
  }, [virtualDate, today, shiftDays, setVirtualDate, reset])

  return (
    <TimeTravelContext.Provider value={value}>
      {children}
    </TimeTravelContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTimeTravel(): TimeTravelContextValue {
  const context = useContext(TimeTravelContext)
  if (!context) {
    throw new Error(
      'useTimeTravel должен использоваться внутри <TimeTravelProvider />',
    )
  }
  return context
}
