declare namespace katex {
  function renderToString(tex: string, options?: {
    displayMode?: boolean
    throwOnError?: boolean
    output?: 'html' | 'mathml' | 'htmlAndMathml'
  }): string
  function render(tex: string, element: HTMLElement, options?: {
    displayMode?: boolean
    throwOnError?: boolean
  }): void
}
