import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Copy,
  RefreshCw,
  Share2,
  CreditCard,
  MapPin,
  Tag,
  Hash,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { OperationDetail } from '../operationDetails'

interface OperationDetailDialogProps {
  detail: OperationDetail | null
  onClose: () => void
}

export function OperationDetailDialog({ detail, onClose }: OperationDetailDialogProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!detail) return
    const { body } = document
    const previousOverflow = body.style.overflow
    const previousPosition = body.style.position
    const previousTop = body.style.top
    const previousWidth = body.style.width
    const scrollY = window.scrollY

    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    closeRef.current?.focus()

    return () => {
      body.style.overflow = previousOverflow
      body.style.position = previousPosition
      body.style.top = previousTop
      body.style.width = previousWidth
      window.scrollTo(0, scrollY)
      window.removeEventListener('keydown', onKey)
    }
  }, [detail, onClose])

  if (!detail) return null

  const currentDetail = detail
  const isIncome = currentDetail.amount > 0
  const formattedAmount = formatAmount(currentDetail.amount)

  async function copyId() {
    try {
      await navigator.clipboard.writeText(currentDetail.operationCode)
      toast.success('Номер операции скопирован', { id: 'operation-copy-id' })
    } catch {
      toast.error('Не удалось скопировать', { id: 'operation-copy-id' })
    }
  }

  function buildReceiptText() {
    return [
      `Чек по операции ${currentDetail.title}`,
      `Сумма: ${formattedAmount}`,
      `Дата: ${currentDetail.dateTimeLabel}`,
      `Категория: ${currentDetail.category}`,
      `ID операции: ${currentDetail.operationCode}`,
    ].join('\n')
  }

  async function shareReceipt() {
    const receiptText = buildReceiptText()

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: `Чек · ${currentDetail.title}`,
          text: receiptText,
        })
        toast.success('Чек готов к отправке', { id: 'operation-share-receipt' })
        return
      }

      await navigator.clipboard.writeText(receiptText)
      toast.success('Чек скопирован в буфер', { id: 'operation-share-receipt' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      toast.error('Не удалось подготовить чек', { id: 'operation-share-receipt' })
    }
  }

  function repeatOperation() {
    if (isIncome) {
      toast('Повтор доступен только для списаний', { id: 'operation-repeat-unavailable' })
      return
    }

    navigate('/payments', {
      state: {
        repeatOperation: {
          title: currentDetail.title,
          subtitle: currentDetail.subtitle,
          amount: Math.abs(currentDetail.amount),
        },
      },
    })
    onClose()
  }

  return (
    <div className="op-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="op-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="op-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="op-dialog-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>

        <div className="op-dialog-hero">
          <div
            className={`op-dialog-logo${detail.logoUrl ? ' has-logo' : ''}`}
            style={!detail.logoUrl ? { backgroundColor: detail.brandColor } : undefined}
            aria-hidden="true"
          >
            {detail.logoUrl ? (
              <img src={detail.logoUrl} alt="" />
            ) : (
              <span>{detail.brandInitial}</span>
            )}
          </div>
          <small className="op-dialog-subtitle">{detail.subtitle}</small>
          <h2 id="op-dialog-title" className="op-dialog-title">
            {detail.title}
          </h2>
          <p className={`op-dialog-amount ${isIncome ? 'positive' : 'negative'}`}>
            {formattedAmount}
          </p>
          <span
            className={`op-dialog-status ${detail.statusTone}`}
            aria-label={`Статус: ${detail.statusLabel}`}
          >
            {detail.statusTone === 'success' ? (
              <CheckCircle2 size={14} aria-hidden />
            ) : detail.statusTone === 'warning' ? (
              <AlertCircle size={14} aria-hidden />
            ) : (
              <Clock size={14} aria-hidden />
            )}
            {detail.statusLabel}
          </span>
        </div>

        {detail.smartTag ? (
          <div className="op-dialog-smart">
            <Sparkles size={14} aria-hidden />
            <span>{detail.smartTag}</span>
          </div>
        ) : null}

        <dl className="op-dialog-meta">
          <Row icon={<Clock size={16} aria-hidden />} label="Время операции" value={detail.dateTimeLabel} />
          <Row icon={<CreditCard size={16} aria-hidden />} label="Способ оплаты" value={detail.paymentMethod} />
          <Row icon={<Tag size={16} aria-hidden />} label="Категория" value={detail.category} />
          {detail.mcc ? (
            <Row icon={<Hash size={16} aria-hidden />} label="MCC" value={detail.mcc} />
          ) : null}
          {detail.location ? (
            <Row icon={<MapPin size={16} aria-hidden />} label="Место" value={detail.location} />
          ) : null}
          <Row
            icon={<Hash size={16} aria-hidden />}
            label="ID операции"
            value={
              <button
                type="button"
                className="op-dialog-id-btn"
                onClick={copyId}
                title="Скопировать ID"
              >
                {detail.operationCode}
                <Copy size={14} aria-hidden />
              </button>
            }
          />
        </dl>

        <div className="op-dialog-actions">
          <button type="button" className="op-dialog-action ghost" onClick={shareReceipt}>
            <Share2 size={16} aria-hidden />
            Отправить чек
          </button>
          <button type="button" className="op-dialog-action primary" onClick={repeatOperation}>
            <RefreshCw size={16} aria-hidden />
            {isIncome ? 'Запросить ещё' : 'Повторить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="op-dialog-row">
      <span className="op-dialog-row-icon" aria-hidden>
        {icon}
      </span>
      <dt className="op-dialog-row-label">{label}</dt>
      <dd className="op-dialog-row-value">{value}</dd>
    </div>
  )
}

const numberFormatter = new Intl.NumberFormat('ru-RU')
function formatAmount(amount: number) {
  const sign = amount > 0 ? '+' : '−'
  return `${sign}${numberFormatter.format(Math.abs(amount))} ₽`
}
