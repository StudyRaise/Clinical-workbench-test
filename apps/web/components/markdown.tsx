'use client';

import React from 'react';

/**
 * 轻量 Markdown 渲染组件（不依赖第三方库）。
 *
 * 覆盖常见场景：标题、加粗/斜体、行内代码、代码块、
 * 无序/有序列表、引用、链接、分隔线、段落。
 */

/** 行内元素：**加粗**、*斜体*、`代码`、[链接](url) */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let index = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-i${index++}`;
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        nodes.push(
          <a
            key={key}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {link[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let blockIndex = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `md-${blockIndex++}`;

    // 代码块
    if (/^```/.test(line.trim())) {
      const lang = line.trim().replace(/^```/, '').trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // 跳过结束 ```（若存在）
      blocks.push(
        <pre
          key={key}
          className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed"
        >
          <code data-lang={lang}>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // 标题
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}` as React.ElementType;
      const size =
        level === 1
          ? 'text-lg'
          : level === 2
            ? 'text-base'
            : level === 3
              ? 'text-sm font-semibold'
              : 'text-sm font-medium';
      blocks.push(
        <Tag key={key} className={`my-1.5 font-semibold ${size}`}>
          {renderInline(heading[2], key)}
        </Tag>
      );
      i += 1;
      continue;
    }

    // 分隔线
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push(<hr key={key} className="my-2 border-muted-foreground/20" />);
      i += 1;
      continue;
    }

    // 引用
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={key}
          className="my-1.5 border-l-2 border-muted-foreground/30 pl-2 text-muted-foreground"
        >
          {renderInline(quoteLines.join(' '), key)}
        </blockquote>
      );
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={key} className="my-1.5 list-disc space-y-0.5 pl-5">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item, `${key}-l${j}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // 有序列表
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={key} className="my-1.5 list-decimal space-y-0.5 pl-5">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item, `${key}-l${j}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // 空行 -> 段落分隔
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // 普通段落（合并到下一个空行）
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key} className="my-1 leading-relaxed">
        {renderInline(para.join(' '), key)}
      </p>
    );
  }

  return (
    <div className={className ?? ''}>
      {blocks}
    </div>
  );
}
