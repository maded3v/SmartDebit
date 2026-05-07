// Путь: frontend/src/components/TimeTravel/TimeTravel.tsx
import { CalendarClock, Clock, RotateCcw } from 'lucide-react'
import { useTimeTravel } from '../../hooks/useTimeTravel'

const DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const QUICK_SHIFTS: Array<{ label: string; days: number }> = [
  { label: '+1д', days: 1 },
  { label: '+10д', days: 10 },
  { label: '+30д', days: 30 },
]

interface TimeTravelProps {
  className?: string
  compact?: boolean
}

export function TimeTravel({ className, compact = false }: TimeTravelProps) {
  const { effectiveDate, daysFromToday, isSimulating, shiftDays, reset } =
    useTimeTravel()

  const formatted = DATE_FORMATTER.format(effectiveDate)

  const wrapperClass = [
    'time-travel',
    compact ? 'time-travel-compact' : '',
    isSimulating ? 'is-simulating' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={wrapperClass}
      role="group"
      aria-label="Перемотка времени"
    >
      <div className="time-travel-info">
        <CalendarClock size={16} aria-hidden className="time-travel-icon" />
        <div className="time-travel-text">
          {compact ? null : (
            <span className="time-travel-title">Виртуальная дата</span>
          )}
          <span className="time-travel-date" aria-live="polite">
            {formatted}
          </span>
          {isSimulating ? (
            <span className="time-travel-delta">
              <Clock size={11} aria-hidden />
              {daysFromToday > 0 ? `+${daysFromToday} дн.` : 'сегодня'}
            </span>
          ) : null}
        </div>
      </div>

      <div className="time-travel-actions">
        {QUICK_SHIFTS.map((shift) => (
          <button
            key={shift.days}
            type="button"
            className="time-travel-btn"
            onClick={() => shiftDays(shift.days)}
            aria-label={`Сдвинуть виртуальную дату на ${shift.days} дн. вперёд`}
          >
            {shift.label}
          </button>
        ))}
        <button
          type="button"
          className="time-travel-btn time-travel-reset"
          onClick={reset}
          disabled={!isSimulating}
          aria-label="Сбросить виртуальную дату и вернуться к сегодняшнему числу"
          title="Сбросить виртуальную дату"
        >
          <RotateCcw size={13} aria-hidden />
          <span className="time-travel-reset-label">Сбросить</span>
        </button>
      </div>
    </div>
  )
}
