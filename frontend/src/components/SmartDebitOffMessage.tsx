import { Sparkles, Power } from 'lucide-react'

// Компактное сообщение, которое показывается на главной вместо виджета
// SmartDebit, если пользователь отключил сервис. Содержит понятное
// объяснение и кнопку "Включить SmartDebit", вызывающую API toggle.
//
// Используется в HomePage и (опционально) в любых других местах, где раньше
// рендерился полный виджет регулярных списаний.
export interface SmartDebitOffMessageProps {
  onEnable?: () => void | Promise<void>
  enabling?: boolean
  // В компактном варианте показываем без кнопки, только текст.
  variant?: 'full' | 'compact'
}

export function SmartDebitOffMessage({
  onEnable,
  enabling = false,
  variant = 'full',
}: SmartDebitOffMessageProps) {
  return (
    <div className={`smartdebit-off${variant === 'compact' ? ' compact' : ''}`}>
      <span className="smartdebit-off-icon" aria-hidden>
        <Sparkles size={18} />
      </span>
      <div className="smartdebit-off-body">
        <p className="smartdebit-off-title">SmartDebit выключен</p>
        <p className="smartdebit-off-subtitle">
          Включите сервис, чтобы видеть регулярные списания и управлять подписками.
        </p>
      </div>
      {variant === 'full' && onEnable ? (
        <button
          type="button"
          className="smartdebit-off-btn"
          onClick={() => {
            void onEnable()
          }}
          disabled={enabling}
        >
          <Power size={14} aria-hidden />
          {enabling ? 'Включаем...' : 'Включить'}
        </button>
      ) : null}
    </div>
  )
}

export default SmartDebitOffMessage
