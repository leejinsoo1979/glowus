'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, Search } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
  description?: string
  icon?: React.ReactNode
}

interface CustomSelectProps {
  value?: string
  onChange?: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  label?: string
  error?: boolean
  disabled?: boolean
  searchable?: boolean
  className?: string
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '선택하세요',
  label,
  error,
  disabled,
  searchable = false,
  className = '',
}: CustomSelectProps) {
  const [search, setSearch] = React.useState('')
  const [open, setOpen] = React.useState(false)

  const filteredOptions = searchable
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      )
    : options

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onChange}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={`
          group flex items-center justify-between w-full px-3 py-2.5
          bg-theme-input border rounded-lg text-sm
          transition-all duration-200 outline-none
          ${error
            ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
            : 'border-theme hover:border-accent/50 focus:border-accent focus:ring-2 focus:ring-accent/20'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
      >
        <SelectPrimitive.Value placeholder={placeholder}>
          {selectedOption ? (
            <span className="text-theme">{selectedOption.label}</span>
          ) : (
            <span className="text-theme-muted">{placeholder}</span>
          )}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon>
          <ChevronDown className={`w-4 h-4 text-theme-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="
            z-[100] overflow-hidden
            bg-theme-card border border-theme rounded-xl shadow-2xl
            animate-in fade-in-0 zoom-in-95 duration-200
          "
          position="popper"
          sideOffset={4}
          align="start"
        >
          {searchable && (
            <div className="p-2 border-b border-theme">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="검색..."
                  className="w-full pl-9 pr-3 py-2 bg-theme-secondary border-0 rounded-lg text-sm text-theme placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <SelectPrimitive.Viewport className="p-1.5 max-h-[280px] overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-theme-muted">
                {searchable && search ? '검색 결과가 없습니다' : '옵션이 없습니다'}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="
                    relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                    text-sm text-theme cursor-pointer outline-none
                    transition-colors duration-150
                    data-[highlighted]:bg-accent/10 data-[highlighted]:text-accent
                    data-[state=checked]:bg-accent/10 data-[state=checked]:text-accent
                  "
                >
                  {option.icon && (
                    <span className="flex-shrink-0">{option.icon}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <SelectPrimitive.ItemText>
                      {option.label}
                    </SelectPrimitive.ItemText>
                    {option.description && (
                      <p className="text-xs text-theme-muted mt-0.5 truncate">
                        {option.description}
                      </p>
                    )}
                  </div>
                  <SelectPrimitive.ItemIndicator>
                    <Check className="w-4 h-4 text-accent" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

// 그룹화된 Select
interface SelectGroup {
  label: string
  options: SelectOption[]
}

interface GroupedSelectProps extends Omit<CustomSelectProps, 'options'> {
  groups: SelectGroup[]
}

export function GroupedSelect({
  value,
  onChange,
  groups,
  placeholder = '선택하세요',
  error,
  disabled,
  className = '',
}: GroupedSelectProps) {
  const [open, setOpen] = React.useState(false)

  const allOptions = groups.flatMap(g => g.options)
  const selectedOption = allOptions.find(opt => opt.value === value)

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onChange}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={`
          group flex items-center justify-between w-full px-3 py-2.5
          bg-theme-input border rounded-lg text-sm
          transition-all duration-200 outline-none
          ${error
            ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
            : 'border-theme hover:border-accent/50 focus:border-accent focus:ring-2 focus:ring-accent/20'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
      >
        <SelectPrimitive.Value placeholder={placeholder}>
          {selectedOption ? (
            <span className="text-theme">{selectedOption.label}</span>
          ) : (
            <span className="text-theme-muted">{placeholder}</span>
          )}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon>
          <ChevronDown className={`w-4 h-4 text-theme-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="
            z-[100] overflow-hidden
            bg-theme-card border border-theme rounded-xl shadow-2xl
            animate-in fade-in-0 zoom-in-95 duration-200
          "
          position="popper"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="p-1.5 max-h-[320px] overflow-y-auto">
            {groups.map((group, idx) => (
              <SelectPrimitive.Group key={idx}>
                <SelectPrimitive.Label className="px-3 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wider">
                  {group.label}
                </SelectPrimitive.Label>
                {group.options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className="
                      relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                      text-sm text-theme cursor-pointer outline-none
                      transition-colors duration-150
                      data-[highlighted]:bg-accent/10 data-[highlighted]:text-accent
                      data-[state=checked]:bg-accent/10 data-[state=checked]:text-accent
                    "
                  >
                    <div className="flex-1">
                      <SelectPrimitive.ItemText>
                        {option.label}
                      </SelectPrimitive.ItemText>
                    </div>
                    <SelectPrimitive.ItemIndicator>
                      <Check className="w-4 h-4 text-accent" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Group>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
