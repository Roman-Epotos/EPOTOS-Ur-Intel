'use client'

import { useState, ReactNode } from 'react'

interface TooltipProps {
  text: string
  children?: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function Tooltip({ text, children, position = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false)

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children ?? (
        <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center cursor-help hover:bg-gray-300 flex-shrink-0">
          ?
        </span>
      )}
      {show && (
        <span className={`absolute z-50 ${positionClasses[position]} w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none leading-snug`}>
          {text}
        </span>
      )}
    </span>
  )
}