declare module 'markdown-it' {
  interface MarkdownItOptions {
    html?: boolean;
    xhtmlOut?: boolean;
    breaks?: boolean;
    langPrefix?: string;
    linkify?: boolean;
    typographer?: boolean;
    quotes?: string | string[];
    highlight?: (str: string, lang: string) => string;
  }

  interface MarkdownItInstance {
    render(md: string, env?: any): string;
    renderInline(md: string, env?: any): string;
  }

  interface MarkdownItConstructor {
    new (options?: MarkdownItOptions): MarkdownItInstance;
    (options?: MarkdownItOptions): MarkdownItInstance;
  }

  const MarkdownIt: MarkdownItConstructor;
  export = MarkdownIt;
}
