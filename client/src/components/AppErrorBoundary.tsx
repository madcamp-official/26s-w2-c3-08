import { Component, type ErrorInfo, type ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App render failed:', error, errorInfo)
  }

  render() {
    if (this.state.error === null) {
      return this.props.children
    }

    return (
      <main className="app-error-screen" role="alert">
        <section className="app-error-panel">
          <div className="app-error-brand">Relay Map Maker</div>
          <h1>화면을 불러오지 못했습니다</h1>
          <p>
            브라우저 런타임에서 오류가 발생했습니다. 새로고침 후에도 반복되면 개발자
            도구의 Console 메시지를 확인해주세요.
          </p>
          <pre>{this.state.error.message}</pre>
          <button type="button" onClick={() => window.location.reload()}>
            다시 불러오기
          </button>
        </section>
      </main>
    )
  }
}

export default AppErrorBoundary
