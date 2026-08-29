import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from './markdown';

const render = (content: string) => renderToStaticMarkup(<Markdown content={content} />);

describe('Markdown 渲染', () => {
  it('渲染标题', () => {
    expect(render('# 一级标题')).toContain('<h1');
    expect(render('### 三级标题')).toContain('<h3');
  });

  it('渲染加粗与斜体', () => {
    const html = render('这是**重点**和*强调*');
    expect(html).toContain('<strong>重点</strong>');
    expect(html).toContain('<em>强调</em>');
  });

  it('渲染行内代码与代码块', () => {
    expect(render('使用 `npm install`')).toContain('<code');
    const block = render('```ts\nconst a = 1;\n```');
    expect(block).toContain('<pre');
    expect(block).toContain('const a = 1;');
  });

  it('渲染无序与有序列表', () => {
    expect(render('- 甲\n- 乙')).toContain('<ul');
    expect(render('1. 第一\n2. 第二')).toContain('<ol');
  });

  it('渲染链接（新窗口打开）', () => {
    const html = render('[文档](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
  });

  it('渲染引用与分隔线', () => {
    expect(render('> 提示')).toContain('<blockquote');
    expect(render('---')).toContain('<hr');
  });

  it('普通段落合并多行', () => {
    const html = render('第一行\n第二行');
    expect(html).toContain('<p');
    expect(html).toContain('第一行 第二行');
  });

  it('未闭合代码块不崩溃', () => {
    expect(() => render('```\ncode')).not.toThrow();
    expect(render('```\ncode')).toContain('code');
  });
});
