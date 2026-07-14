import type {
  AssetLoadItem,
  AttributeFieldOption,
  PaletteSwatchModel,
  StudioToolId,
  ToolButtonProps,
} from '../../design-system/studio'

export const studioToolFixtures: ToolButtonProps['tool'][] = [
  { id: 'pen', label: '펜', shortcut: 'P' },
  { id: 'eraser', label: '지우개', shortcut: 'E' },
  { id: 'eyedropper', label: '스포이드', shortcut: 'I' },
  { id: 'move', label: '전체 이동', shortcut: 'M' },
  { id: 'undo', label: '실행취소', shortcut: 'Z' },
  { id: 'redo', label: '다시실행', shortcut: 'Y' },
  { id: 'clear', label: '전체지우기' },
]

export const disabledStudioToolIds: StudioToolId[] = ['redo', 'clear']

export const brushSizePresets = [1, 2, 4, 8, 12, 16]

export const paletteSwatches: PaletteSwatchModel[] = [
  { id: 'transparent', name: '투명', value: 'transparent', transparent: true },
  { id: 'ink', name: '잉크', value: 'var(--semantic-color-text-primary)' },
  { id: 'paper', name: '종이', value: 'var(--semantic-color-surface-panel)' },
  { id: 'yellow', name: '건설 노랑', value: 'var(--semantic-color-action-primary-background)' },
  { id: 'sky', name: '하늘 파랑', value: 'var(--semantic-color-status-generating)' },
  { id: 'green', name: '지형 초록', value: 'var(--semantic-color-status-success)' },
  { id: 'danger', name: '위험 빨강', value: 'var(--semantic-color-status-error)' },
  { id: 'warning', name: '경고 갈색', value: 'var(--semantic-color-status-warning)' },
  { id: 'checker-a', name: '체커 밝음', value: 'var(--semantic-color-studio-canvas-checker-a)' },
  { id: 'checker-b', name: '체커 어두움', value: 'var(--semantic-color-studio-canvas-checker-b)' },
]

export const recentPaletteSwatchIds = ['yellow', 'sky', 'green']

export const studioAttributeOptions: AttributeFieldOption[] = [
  { value: 'platform', label: '플랫폼', helper: '기본 지형으로 배치됩니다.' },
  { value: 'obstacle', label: '장애물', helper: '충돌 시 실패 조건으로 사용됩니다.' },
  { value: 'monster', label: '몬스터', helper: '자동 액션 세트를 생성합니다.' },
  { value: 'background', label: '배경', helper: '레이스 뒤쪽에 표시됩니다.' },
]

export const behaviorAttributeOptions: AttributeFieldOption[] = [
  { value: 'solid', label: '단단함' },
  { value: 'moving', label: '움직임' },
  { value: 'dangerous', label: '위험' },
]

export const assetLoadFixtures: AssetLoadItem[] = [
  { id: 'load-asset-platform', name: '튼튼한 발판 원본', category: '플랫폼', status: 'ready' },
  { id: 'load-asset-monster', name: '순찰 로봇 긴 이름 샘플', category: '몬스터', status: 'generating' },
  { id: 'load-asset-obstacle', name: '실패한 가시 게이트', category: '장애물', status: 'failed' },
]
