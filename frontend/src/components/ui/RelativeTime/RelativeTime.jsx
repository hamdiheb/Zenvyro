import { useEffect, useState } from 'react'
import { formatRelativeTime, formatFullDateTime } from '../../../utils/dateFormatting.js'

const REFRESH_INTERVAL_MILLISECONDS = 30_000

// "2m ago", "3h ago", "Mon". Re-renders every 30s so open screens stay accurate.
export function RelativeTime({ timestamp, className = '' }) {
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = setInterval(() => setCurrentTime(Date.now()), REFRESH_INTERVAL_MILLISECONDS)
    return () => clearInterval(intervalId)
  }, [])

  if (!timestamp) {
    return null
  }
  return (
    <time className={className} dateTime={timestamp} title={formatFullDateTime(timestamp)}>
      {formatRelativeTime(timestamp, currentTime)}
    </time>
  )
}
