import SwiftUI
import WebKit

/// Thin native shell around the hosted web app. All logic lives in the page, so a
/// web deploy updates the app with no store release. The access code is kept in
/// the page's own storage: sign in once by typing the code or pasting the magic link.
let appURL = URL(string: "https://solring.ndex.us/")!
let paper = Color(red: 0.965, green: 0.957, blue: 0.937)

@main
struct SolRingApp: App {
    var body: some Scene {
        WindowGroup { WebView(url: appURL).ignoresSafeArea(edges: .bottom).background(paper) }
    }
}

struct WebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator(url: url) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = false
        view.scrollView.contentInsetAdjustmentBehavior = .automatic
        view.load(URLRequest(url: url))
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        let url: URL
        init(url: URL) { self.url = url }

        /// No signal: say so and offer a retry.
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            let html = """
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <body style="font:17px -apple-system;padding:48px 24px;text-align:center;background:#f6f4ef;color:#1c1a24">
            <h2>No connection</h2><p>Beatrix needs the internet.</p>
            <p><a href="\(url.absoluteString)" style="color:#a8791a;font-weight:600">Try again</a></p></body>
            """
            webView.loadHTMLString(html, baseURL: url)
        }
    }
}
