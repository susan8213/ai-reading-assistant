import './App.css';

function App() {
  return (
    <div className="chat-shell">
      <header className="chat-header">
        <h1>AI Reading Assistant</h1>
        <span className="status">Ready</span>
      </header>

      <main className="chat-messages">
        <div className="message assistant">
          <p>Hi! I can help summarize and highlight this article.</p>
        </div>
        <div className="message user">
          <p>Please help me find the key points.</p>
        </div>
      </main>

      <footer className="chat-input-bar">
        <input
          type="text"
          placeholder="Ask about this page..."
          aria-label="Chat input"
        />
        <button type="button">Send</button>
      </footer>
    </div>
  );
}

export default App;
