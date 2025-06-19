import React, { useState, ReactNode } from 'react'

interface TabProps {
  label: string
  value: string
  children: ReactNode
}

interface TabsProps {
  defaultValue?: string
  children: React.ReactElement<TabProps>[]
  onValueChange?: (value: string) => void
}

export function Tab({ children }: TabProps) {
  return <>{children}</>
}

export function Tabs({ defaultValue, children, onValueChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue || children[0]?.props.value || '')

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    onValueChange?.(value)
  }

  const tabs = React.Children.toArray(children) as React.ReactElement<TabProps>[]
  const activeTabContent = tabs.find(tab => tab.props.value === activeTab)

  return (
    <div className="w-full">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-lg">
        {tabs.map((tab) => (
          <button
            key={tab.props.value}
            onClick={() => handleTabChange(tab.props.value)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.props.value
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.props.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg border border-gray-200 border-t-0">
        {activeTabContent}
      </div>
    </div>
  )
}

export function TabContent({ children }: { children: ReactNode }) {
  return <div className="p-6">{children}</div>
}