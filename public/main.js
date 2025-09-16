// Placeholder main.js for new tab page
// This will be replaced by the React app in future stories

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-align: center;
      ">
        <h1 style="font-size: 3rem; margin-bottom: 1rem; font-weight: 300;">
          WYSIWYG Markdown Editor
        </h1>
        <p style="font-size: 1.2rem; opacity: 0.9; margin-bottom: 2rem;">
          Foundation setup complete! 🎉
        </p>
        <div style="
          background: rgba(255,255,255,0.1);
          padding: 1.5rem;
          border-radius: 12px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
        ">
          <p style="margin: 0; opacity: 0.8;">
            Chrome extension is properly configured and ready for development.
          </p>
        </div>
      </div>
    `;
  }
});