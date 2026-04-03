"use client"

import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'

type AnnouncementRichTextProps = {
  content: string
  className?: string
}

const urlPattern = /https?:\/\/[^\s]+/g
const trailingPunctuationPattern = /[.,!?;:)\]]+$/

function splitUrlPart(part: string): { href: string; suffix: string } {
  const trailing = part.match(trailingPunctuationPattern)?.[0] ?? ''
  return {
    href: trailing ? part.slice(0, -trailing.length) : part,
    suffix: trailing,
  }
}

function renderLine(line: string, lineIndex: number) {
  const parts = line.split(urlPattern)
  const matches = line.match(urlPattern) ?? []

  return (
    <React.Fragment key={lineIndex}>
      {parts.map((part, partIndex) => {
        const nodes: React.ReactNode[] = []

        if (part) {
          nodes.push(<React.Fragment key={`text-${lineIndex}-${partIndex}`}>{part}</React.Fragment>)
        }

        const match = matches[partIndex]
        if (match) {
          const { href, suffix } = splitUrlPart(match)
          nodes.push(
            <React.Fragment key={`link-${lineIndex}-${partIndex}`}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-portal-primary underline decoration-portal-primary/35 underline-offset-4 transition-colors hover:text-portal-primary-light"
              >
                {href}
              </a>
              {suffix}
            </React.Fragment>,
          )
        }

        return nodes
      })}
    </React.Fragment>
  )
}

export function AnnouncementRichText({ content, className }: AnnouncementRichTextProps) {
  const lines = content.split('\n')

  return (
    <div className={cn('text-sm leading-6 text-portal-secondary whitespace-pre-wrap break-words sm:text-[15px]', className)}>
      {lines.map((line, index) => (
        <React.Fragment key={index}>
          {renderLine(line, index)}
          {index < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  )
}
