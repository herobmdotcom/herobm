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

  interface Token {
    type: string;
    tag: string;
    attrs: [string, string][] | null;
    map: [number, number] | null;
    nesting: number;
    level: number;
    children: Token[] | null;
    content: string;
    markup: string;
    info: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
    meta: any;
    block: boolean;
    hidden: boolean;
    attrIndex(name: string): number;
    attrPush(attrData: [string, string]): void;
    attrSet(name: string, value: string): void;
    attrGet(name: string): string | null;
  }

  interface Renderer {
    rules: Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
      (tokens: Token[], idx: number, options: MarkdownItOptions, env: any, self: Renderer) => string
    >;
    renderToken(tokens: Token[], idx: number, options: MarkdownItOptions): string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
    renderInline(tokens: Token[], options: MarkdownItOptions, env: any): string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
    render(tokens: Token[], options: MarkdownItOptions, env: any): string;
  }

  interface MarkdownItInstance {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
    render(md: string, env?: any): string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
    renderInline(md: string, env?: any): string;
    renderer: Renderer;
  }

  interface MarkdownItConstructor {
    new (options?: MarkdownItOptions): MarkdownItInstance;
    (options?: MarkdownItOptions): MarkdownItInstance;
  }

  const MarkdownIt: MarkdownItConstructor;
  export = MarkdownIt;
}

