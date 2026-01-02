// Electron webview element type declarations
declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string
        preload?: string
        partition?: string
        allowpopups?: string
        webpreferences?: string
        httpreferrer?: string
        useragent?: string
        disablewebsecurity?: string
        nodeintegration?: string
        nodeintegrationinsubframes?: string
        plugins?: string
        enableremotemodule?: string
      },
      HTMLElement
    >
  }
}
