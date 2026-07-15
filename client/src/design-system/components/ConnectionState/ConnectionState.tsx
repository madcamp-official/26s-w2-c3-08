import type { HTMLAttributes } from 'react'

import { Button } from '../../primitives'
import { Badge } from '../Badge/Badge'
import { cx } from '../shared'
import styles from './ConnectionState.module.css'

export type ConnectionStatus =
  | 'online'
  | 'authentication'
  | 'offline'
  | 'reconnecting'
  | 'server_unavailable'
  | 'malformed_response'

const titles: Record<ConnectionStatus, string> = {
  online: '연결됨',
  authentication: '로그인이 필요함',
  offline: '오프라인',
  reconnecting: '재연결 중',
  server_unavailable: '서버에 연결할 수 없음',
  malformed_response: '응답 형식 오류',
}

export interface ConnectionStateProps extends HTMLAttributes<HTMLDivElement> {
  status: ConnectionStatus
  message?: string
  action?: {
    label: string
    onPress: () => void
  }
}

export function ConnectionState({ status, message, action, className, ...props }: ConnectionStateProps) {
  const isBlocking =
    status === 'authentication' ||
    status === 'offline' ||
    status === 'server_unavailable' ||
    status === 'malformed_response'
  const badgeState = status === 'online' ? 'ready' : status === 'reconnecting' ? 'reconnecting' : 'offline'

  return (
    <div
      className={cx(styles.state, className)}
      role={isBlocking ? 'alert' : 'status'}
      aria-live={isBlocking ? 'assertive' : 'polite'}
      data-v2-component="connection-state"
      data-v2-state={status}
      data-state={status}
      {...props}
    >
      <Badge state={badgeState} label={titles[status]} />
      {message ? <p>{message}</p> : null}
      {action ? (
        <Button variant={isBlocking ? 'danger' : 'secondary'} size="small" onClick={action.onPress}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
