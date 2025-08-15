import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FaCopy, FaCheck, FaCode, FaDownload } from 'react-icons/fa';

const CodeBlock = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const [copied, setCopied] = useState(false);
    const [showActions, setShowActions] = useState(false);

    const codeString = String(children).replace(/\n$/, '');
    const language = match ? match[1] : 'text';

    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(codeString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    };

    const downloadCode = () => {
      const blob = new Blob([codeString], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `code.${getFileExtension(language)}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const getFileExtension = (lang) => {
      const extensions = {
        javascript: 'js',
        typescript: 'ts',
        python: 'py',
        java: 'java',
        cpp: 'cpp',
        c: 'c',
        csharp: 'cs',
        php: 'php',
        ruby: 'rb',
        go: 'go',
        rust: 'rs',
        swift: 'swift',
        kotlin: 'kt',
        scala: 'scala',
        html: 'html',
        css: 'css',
        scss: 'scss',
        sql: 'sql',
        bash: 'sh',
        powershell: 'ps1',
        json: 'json',
        xml: 'xml',
        yaml: 'yml',
        markdown: 'md'
      };
      return extensions[lang] || 'txt';
    };

    const getLanguageIcon = (lang) => {
      const icons = {
        javascript: '🟨',
        typescript: '🔷',
        python: '🐍',
        java: '☕',
        cpp: '⚡',
        c: '🔧',
        csharp: '🔷',
        php: '🐘',
        ruby: '💎',
        go: '🐹',
        rust: '🦀',
        swift: '🍎',
        kotlin: '🎯',
        html: '🌐',
        css: '🎨',
        sql: '🗄️',
        bash: '💻',
        json: '📋',
        xml: '📄',
        yaml: '⚙️'
      };
      return icons[lang] || '📝';
    };

    return !inline && match ? (
      <div
        className="code-block-container"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="code-block-header">
          <div className="code-language">
            <span className="language-icon">{getLanguageIcon(language)}</span>
            <span className="language-name">{language.toUpperCase()}</span>
          </div>

          {showActions && (
            <div className="code-actions">
              <button
                className="code-action-btn copy-btn"
                onClick={copyToClipboard}
                title={copied ? 'Copied!' : 'Copy code'}
              >
                {copied ? <FaCheck /> : <FaCopy />}
                {copied ? 'Copied!' : 'Copy'}
              </button>

              <button
                className="code-action-btn download-btn"
                onClick={downloadCode}
                title="Download code file"
              >
                <FaDownload />
                Download
              </button>
            </div>
          )}
        </div>

        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          showLineNumbers={codeString.split('\n').length > 5}
          wrapLines={true}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>

        <style jsx>{`
          .code-block-container {
            position: relative;
            margin: 16px 0;
            border-radius: 8px;
            overflow: hidden;
            background: #1e1e1e;
            border: 1px solid #333;
          }

          .code-block-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 16px;
            background: #2d2d2d;
            border-bottom: 1px solid #333;
          }

          .code-language {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #fff;
            font-size: 12px;
            font-weight: 600;
          }

          .language-icon {
            font-size: 14px;
          }

          .code-actions {
            display: flex;
            gap: 8px;
            opacity: 0;
            animation: fadeIn 0.2s ease-in-out forwards;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .code-action-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: #404040;
            border: 1px solid #555;
            border-radius: 4px;
            color: #fff;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .code-action-btn:hover {
            background: #505050;
            border-color: #666;
          }

          .copy-btn.copied {
            background: #28a745;
            border-color: #28a745;
          }

          .download-btn:hover {
            background: #007bff;
            border-color: #007bff;
          }
        `}</style>
      </div>
    ) : (
      <code className={`inline-code ${className}`} {...props}>
        {children}
        <style jsx>{`
          .inline-code {
            background: #f1f3f4;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
            font-size: 0.9em;
            color: #d73a49;
            border: 1px solid #e1e4e8;
          }
        `}</style>
      </code>
    );
  },
};

export default CodeBlock;