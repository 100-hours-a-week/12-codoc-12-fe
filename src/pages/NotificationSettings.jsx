import { useCallback, useEffect, useState } from 'react'

import StatusMessage from '@/components/StatusMessage'
import {
  getNotificationPreferences,
  updateNotificationPreference,
} from '@/services/notifications/notificationsService'

const ToggleButton = ({ checked, disabled, onClick, ariaLabel }) => (
  <button
    aria-checked={checked}
    aria-label={ariaLabel}
    className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
      checked ? 'border-info bg-[hsl(var(--info))]' : 'border-border bg-[hsl(var(--neutral-200))]'
    } disabled:cursor-not-allowed disabled:opacity-50`}
    disabled={disabled}
    onClick={onClick}
    role="switch"
    type="button"
  >
    <span
      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
)

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState([])
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true)
  const [preferenceError, setPreferenceError] = useState('')
  const [updatingPreferenceType, setUpdatingPreferenceType] = useState(null)

  const fetchNotificationPreferences = useCallback(async () => {
    setPreferenceError('')
    setIsLoadingPreferences(true)

    try {
      const { preferences: items } = await getNotificationPreferences()
      setPreferences(items)
    } catch {
      setPreferenceError('알림 수신 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
      setPreferences([])
    } finally {
      setIsLoadingPreferences(false)
    }
  }, [])

  useEffect(() => {
    fetchNotificationPreferences()
  }, [fetchNotificationPreferences])

  const handleTogglePreference = async (type) => {
    if (updatingPreferenceType) {
      return
    }

    const target = preferences.find((item) => item.type === type)

    if (!target) {
      return
    }

    const nextEnabled = !target.enabled
    const previousPreferences = preferences

    setUpdatingPreferenceType(type)
    setPreferenceError('')
    setPreferences((prev) =>
      prev.map((item) => (item.type === type ? { ...item, enabled: nextEnabled } : item)),
    )

    try {
      await updateNotificationPreference(type, nextEnabled)
    } catch {
      setPreferences(previousPreferences)
      setPreferenceError('알림 수신 설정 변경에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setUpdatingPreferenceType(null)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex min-h-9 items-center justify-between">
        <h2 className="text-lg font-semibold">알림 수신 설정</h2>
        <span aria-hidden className="h-9 w-9" />
      </div>

      <article className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-muted-foreground/80">서비스별 푸시 알림</p>
        </div>

        {preferenceError ? <StatusMessage tone="error">{preferenceError}</StatusMessage> : null}

        {isLoadingPreferences ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`preference-skeleton-${index}`}
                className="h-12 animate-pulse rounded-xl bg-muted/60"
              />
            ))}
          </div>
        ) : null}

        {!isLoadingPreferences && preferences.length > 0 ? (
          <ul className="space-y-1">
            {preferences.map((preference) => (
              <li key={preference.type} className="flex items-center justify-between py-2.5">
                <p className="text-md font-medium">{preference.typeLabel}</p>
                <ToggleButton
                  ariaLabel={`${preference.typeLabel} 푸시 수신 설정`}
                  checked={preference.enabled}
                  disabled={updatingPreferenceType === preference.type}
                  onClick={() => handleTogglePreference(preference.type)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </section>
  )
}
