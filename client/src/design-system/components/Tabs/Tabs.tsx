import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react'

import { cx } from '../shared'
import styles from './Tabs.module.css'

export interface TabItem {
  value: string
  label: string
  disabled?: boolean
  badge?: ReactNode
  panelId?: string
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  tabs: readonly TabItem[]
  selectedValue: string
  ariaLabel: string
  onChange: (value: string) => void
}

export function Tabs({ tabs, selectedValue, ariaLabel, onChange, className, ...props }: TabsProps) {
  const selectedIndex = tabs.findIndex((tab) => tab.value === selectedValue)

  function selectEnabledTab(fromIndex: number, direction: 1 | -1) {
    if (!tabs.some((tab) => !tab.disabled)) {
      return
    }

    let nextIndex = fromIndex

    do {
      nextIndex = (nextIndex + direction + tabs.length) % tabs.length
    } while (tabs[nextIndex]?.disabled)

    onChange(tabs[nextIndex].value)
  }

  function selectEdgeTab(direction: 1 | -1) {
    const nextTab = direction === 1 ? tabs.find((tab) => !tab.disabled) : [...tabs].reverse().find((tab) => !tab.disabled)

    if (nextTab) {
      onChange(nextTab.value)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      selectEnabledTab(index, 1)
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      selectEnabledTab(index, -1)
    }

    if (event.key === 'Home') {
      event.preventDefault()
      selectEdgeTab(1)
    }

    if (event.key === 'End') {
      event.preventDefault()
      selectEdgeTab(-1)
    }
  }

  return (
    <div
      className={cx(styles.tabs, className)}
      data-v2-component="tabs"
      data-v2-state="enabled"
      {...props}
    >
      <div className={styles.tabList} role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab, index) => {
          const selected = tab.value === selectedValue || (selectedIndex === -1 && index === 0)
          const state = tab.disabled ? 'disabled' : selected ? 'selected' : 'enabled'

          return (
            <button
              key={tab.value}
              className={styles.tab}
              type="button"
              role="tab"
              disabled={tab.disabled}
              aria-selected={selected}
              aria-controls={tab.panelId}
              tabIndex={selected && !tab.disabled ? 0 : -1}
              data-state={state}
              data-v2-state={state}
              onClick={() => {
                if (!tab.disabled) {
                  onChange(tab.value)
                }
              }}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span>{tab.label}</span>
              {tab.badge ? <span className={styles.badge}>{tab.badge}</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
