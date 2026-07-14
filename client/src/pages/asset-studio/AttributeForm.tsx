import { AttributeField, type AttributeFieldOption } from '../../design-system/studio'
import { Button, Inline, Stack, Text } from '../../design-system/primitives'
import { TextArea } from '../../design-system/components'
import styles from './AssetStudioScreen.module.css'
import type {
  AssetStudioAttrs,
  AssetStudioCategory,
  AssetStudioFormValue,
  AssetStudioSize,
} from './AssetStudioScreen'

export const assetStudioCategoryOptions: AttributeFieldOption[] = [
  { value: 'platform', label: '플랫폼', helper: '기본 발판이나 지형으로 사용합니다.' },
  { value: 'obstacle', label: '장애물', helper: '닿으면 실패하는 위험 요소로 사용합니다.' },
  { value: 'monster', label: '몬스터', helper: '자동 액션 세트를 생성합니다.' },
  { value: 'background', label: '배경', helper: '레이스 뒤쪽에 표시합니다.' },
]

const behaviorOptions: AttributeFieldOption[] = [
  { value: 'solid', label: '단단함' },
  { value: 'moving', label: '움직임' },
  { value: 'dangerous', label: '위험' },
]

const colliderOptions: AttributeFieldOption[] = [
  { value: 'solid', label: '충돌 있음' },
  { value: 'hazard', label: '위험 충돌' },
  { value: 'none', label: '충돌 없음' },
]

const motionOptions: AttributeFieldOption[] = [
  { value: 'static', label: '고정' },
  { value: 'moving', label: '왕복 이동' },
  { value: 'patrol', label: '순찰' },
]

export interface AttributeFormProps {
  value: AssetStudioFormValue
  missingName?: boolean
  disabled?: boolean
  submitDisabledReason?: string
  submitting?: boolean
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  onCategoryChange: (category: AssetStudioCategory) => void
  onSizeChange: (size: AssetStudioSize) => void
  onAttrsChange: (attrs: AssetStudioAttrs) => void
  onSubmit: () => void
  onOpenWarehouse: () => void
}

export function AttributeForm({
  value,
  missingName = false,
  disabled = false,
  submitDisabledReason,
  submitting = false,
  onNameChange,
  onDescriptionChange,
  onCategoryChange,
  onSizeChange,
  onAttrsChange,
  onSubmit,
  onOpenWarehouse,
}: AttributeFormProps) {
  return (
    <form
      className={styles.attributeForm}
      aria-label="에셋 속성"
      data-v2-component="asset-studio-attribute-form"
      data-v2-state={missingName ? 'invalidMissingName' : disabled ? 'disabled' : 'default'}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <Stack gap="medium">
        <AttributeField
          label="이름"
          kind="text"
          value={value.name}
          placeholder="에셋 이름"
          helper="이름은 필수입니다."
          error={missingName ? '이름을 입력해 주세요.' : undefined}
          disabledReason={disabled ? '제출 중에는 이름을 바꿀 수 없어요.' : undefined}
          onChange={(nextValue) => onNameChange(String(nextValue))}
        />

        <TextArea
          label="설명"
          value={value.description}
          placeholder="움직임이나 분위기를 적어주세요"
          helper="선택 입력입니다."
          disabled={disabled}
          maxLength={120}
          onChange={onDescriptionChange}
        />

        <AttributeField
          label="카테고리"
          kind="radio"
          value={value.category}
          options={assetStudioCategoryOptions}
          disabledReason={disabled ? '제출 중에는 카테고리를 바꿀 수 없어요.' : undefined}
          onChange={(nextValue) => {
            if (isAssetStudioCategory(String(nextValue))) {
              onCategoryChange(String(nextValue) as AssetStudioCategory)
            }
          }}
        />

        <fieldset className={styles.sizeField} disabled={disabled}>
          <legend>크기</legend>
          <Inline gap="small">
            <label>
              <span>가로</span>
              <input
                type="number"
                min={1}
                max={8}
                value={value.size.widthCells}
                onChange={(event) =>
                  onSizeChange({
                    ...value.size,
                    widthCells: clampCellCount(Number(event.currentTarget.value)),
                  })
                }
              />
            </label>
            <label>
              <span>세로</span>
              <input
                type="number"
                min={1}
                max={8}
                value={value.size.heightCells}
                onChange={(event) =>
                  onSizeChange({
                    ...value.size,
                    heightCells: clampCellCount(Number(event.currentTarget.value)),
                  })
                }
              />
            </label>
          </Inline>
          <Text variant="caption" tone="secondary">
            1~8칸 사이에서 바꾸면 그림이 리샘플됩니다.
          </Text>
        </fieldset>

        <AttributeField
          label="동작 속성"
          kind="checkbox"
          value={value.attrs.behaviors}
          options={behaviorOptions}
          disabledReason={disabled ? '제출 중에는 속성을 바꿀 수 없어요.' : undefined}
          onChange={(nextValue) =>
            onAttrsChange({
              ...value.attrs,
              behaviors: Array.isArray(nextValue) ? nextValue : [String(nextValue)],
            })
          }
        />

        <AttributeField
          label="충돌"
          kind="select"
          value={value.attrs.collider}
          options={colliderOptions}
          disabledReason={disabled ? '제출 중에는 충돌을 바꿀 수 없어요.' : undefined}
          onChange={(nextValue) =>
            onAttrsChange({
              ...value.attrs,
              collider: String(nextValue) as AssetStudioAttrs['collider'],
            })
          }
        />

        <AttributeField
          label="움직임"
          kind="select"
          value={value.attrs.motion}
          options={motionOptions}
          disabledReason={disabled ? '제출 중에는 움직임을 바꿀 수 없어요.' : undefined}
          onChange={(nextValue) =>
            onAttrsChange({
              ...value.attrs,
              motion: String(nextValue) as AssetStudioAttrs['motion'],
            })
          }
        />

        {submitDisabledReason ? (
          <p className={styles.submitReason} role="status">
            {submitDisabledReason}
          </p>
        ) : null}

        <div className={styles.formActions}>
          <Button type="submit" loading={submitting} disabled={Boolean(submitDisabledReason) || disabled}>
            만들기
          </Button>
          <Button type="button" variant="secondary" onClick={onOpenWarehouse}>
            창고에서 진행 상황 보기
          </Button>
        </div>
      </Stack>
    </form>
  )
}

function isAssetStudioCategory(value: string): value is AssetStudioCategory {
  return value === 'platform' || value === 'obstacle' || value === 'monster' || value === 'background'
}

function clampCellCount(value: number) {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(8, Math.max(1, Math.trunc(value)))
}
