import type { LoginScreenProps, LoginScreenState } from '../../pages/login/LoginScreen'

export interface LoginScreenFixture {
  id: string
  title: string
  description: string
  state: LoginScreenState
  nickname: string
  viewport: '1280x720' | '1440x900' | '1920x1080'
}

export const loginScreenFixtures: LoginScreenFixture[] = [
  {
    id: 's1-login-boot',
    title: '로그인 부팅',
    description: '저장된 세션 확인 중에도 form 높이가 유지되는 상태입니다.',
    state: 'boot',
    nickname: '',
    viewport: '1280x720',
  },
  {
    id: 's1-login-default',
    title: '로그인 기본',
    description: '닉네임을 입력하고 시작할 수 있는 기본 상태입니다.',
    state: 'default',
    nickname: '릴레이러',
    viewport: '1440x900',
  },
  {
    id: 's1-login-empty-nickname',
    title: '닉네임 빈 값',
    description: '빈 닉네임 validation copy와 disabled submit을 확인합니다.',
    state: 'emptyNickname',
    nickname: '',
    viewport: '1280x720',
  },
  {
    id: 's1-login-too-long',
    title: '닉네임 길이 초과',
    description: '12자를 넘는 닉네임과 오류 연결을 확인합니다.',
    state: 'tooLong',
    nickname: '릴레이맵메이커플레이어길다',
    viewport: '1440x900',
  },
  {
    id: 's1-login-submitting',
    title: '로그인 제출 중',
    description: '제출 중 spinner가 나타나도 버튼 크기가 유지되는 상태입니다.',
    state: 'submitting',
    nickname: '릴레이러',
    viewport: '1440x900',
  },
  {
    id: 's1-login-server-error',
    title: '로그인 서버 오류',
    description: '서버 오류 copy와 재시도 가능한 form 상태를 확인합니다.',
    state: 'serverError',
    nickname: '릴레이러',
    viewport: '1280x720',
  },
  {
    id: 's1-login-expired-session',
    title: '세션 만료',
    description: '저장된 세션이 만료되어 다시 시작해야 하는 상태입니다.',
    state: 'expiredSession',
    nickname: '릴레이러',
    viewport: '1280x720',
  },
]

export type LoginScreenFixtureId = (typeof loginScreenFixtures)[number]['id']

export function getLoginScreenFixture(fixtureId: string | undefined) {
  return (
    loginScreenFixtures.find((fixture) => fixture.id === fixtureId) ?? loginScreenFixtures[1]
  )
}

export function getLoginScreenFixtureByState(state: string | undefined) {
  return loginScreenFixtures.find((fixture) => fixture.state === state) ?? loginScreenFixtures[1]
}

export function toLoginScreenProps(
  fixture: LoginScreenFixture,
  callbacks: Pick<LoginScreenProps, 'onNicknameChange' | 'onSubmitNickname'>,
): LoginScreenProps {
  return {
    state: fixture.state,
    nickname: fixture.nickname,
    ...callbacks,
  }
}
