import type { FormEvent } from 'react'

import { Badge, TextField } from '../../design-system/components'
import { Button, Text } from '../../design-system/primitives'
import { LauncherShell, type LauncherShellState } from '../../design-system/shells'
import styles from './LoginScreen.module.css'

export type LoginScreenState =
  | 'boot'
  | 'default'
  | 'emptyNickname'
  | 'tooLong'
  | 'submitting'
  | 'serverError'
  | 'expiredSession'

export interface LoginScreenProps {
  state: LoginScreenState
  nickname: string
  onNicknameChange: (nickname: string) => void
  onSubmitNickname: (nickname: string) => void
}

const appTitle = '멀티플레이 AI 릴레이 맵 메이커'
const screenTitle = '닉네임을 정해주세요'
const screenDescription = '같은 닉네임도 사용할 수 있어요. 기기는 세션으로 구분됩니다.'
const nicknameGuide = '1~12자로 입력해주세요.'
const nicknameInputId = 's1-login-nickname'
const nicknameErrorId = 's1-login-nickname-error'

const errorCopy: Partial<Record<LoginScreenState, string>> = {
  emptyNickname: '닉네임을 입력해주세요.',
  tooLong: '닉네임은 12자 이하로 입력해주세요.',
  serverError: '시작할 수 없어요. 다시 시도해주세요.',
  expiredSession: '세션이 만료되었어요. 다시 시작해주세요.',
}

export function LoginScreen({
  state,
  nickname,
  onNicknameChange,
  onSubmitNickname,
}: LoginScreenProps) {
  const errorMessage = errorCopy[state]
  const isBusy = state === 'boot' || state === 'submitting'
  const normalizedNickname = nickname.trim()
  const isNicknameValid = normalizedNickname.length >= 1 && normalizedNickname.length <= 12
  const canSubmit = isNicknameValid && !isBusy
  const shellState = getShellState(state)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (canSubmit) {
      onSubmitNickname(nickname)
    }
  }

  return (
    <LauncherShell
      className={styles.shell}
      title={appTitle}
      subtitle="S1 Login"
      state={shellState}
      status={<LoginStatus state={state} />}
      data-v2-screen="s1-login"
      data-v2-state={state}
    >
      <div className={styles.layout} data-v2-component="login-screen" data-v2-state={state}>
        <section className={styles.copyBlock} aria-labelledby="s1-login-title">
          <p className={styles.eyebrow}>시작하기</p>
          <h2 id="s1-login-title">{screenTitle}</h2>
          <p>{screenDescription}</p>
        </section>

        <form
          className={styles.form}
          aria-label="닉네임으로 시작하기"
          data-v2-component="login-form"
          data-v2-state={state}
          onSubmit={handleSubmit}
        >
          <div className={styles.fieldFrame}>
            <TextField
              id={nicknameInputId}
              label="닉네임"
              value={nickname}
              placeholder="1~12자"
              helper={nicknameGuide}
              required
              disabled={isBusy}
              loading={state === 'boot'}
              aria-invalid={Boolean(errorMessage) || undefined}
              aria-describedby={errorMessage ? nicknameErrorId : undefined}
              onChange={onNicknameChange}
            />
          </div>

          <p
            id={nicknameErrorId}
            className={styles.errorArea}
            aria-live="polite"
            data-v2-component="login-error"
            data-v2-state={errorMessage ? 'error' : 'idle'}
          >
            {errorMessage}
          </p>

          <Button
            type="submit"
            size="large"
            fullWidth
            loading={state === 'submitting'}
            disabled={!canSubmit}
            data-v2-component="login-submit"
            data-v2-state={state === 'submitting' ? 'submitting' : canSubmit ? 'enabled' : 'disabled'}
          >
            시작하기
          </Button>
        </form>

        <div className={styles.previewBlock} aria-hidden="true">
          <span className={styles.previewTile} />
          <span className={styles.previewTile} />
          <span className={styles.previewTile} />
        </div>
      </div>
    </LauncherShell>
  )
}

function LoginStatus({ state }: { state: LoginScreenState }) {
  if (state === 'boot') {
    return <Badge state="generating" label="저장된 세션을 확인하는 중" />
  }

  if (state === 'submitting') {
    return <Badge state="generating" label="제출 중" />
  }

  if (state === 'serverError') {
    return <Badge state="failed" label="시작 오류" />
  }

  if (state === 'expiredSession') {
    return <Badge state="failed" label="세션 만료" />
  }

  return (
    <Text variant="caption" tone="secondary" weight="bold">
      로컬 모드
    </Text>
  )
}

function getShellState(state: LoginScreenState): LauncherShellState {
  if (state === 'boot' || state === 'submitting') {
    return 'loading'
  }

  if (state === 'serverError' || state === 'expiredSession') {
    return 'offline'
  }

  return 'default'
}
