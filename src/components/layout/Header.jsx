import { Sun, Moon, Code2 } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { Badge } from "../ui/index.js";

const SDK_VERSION = "v0.2.6";

/** `showThemeToggle` is off inside Salla, where the host owns the theme. */
export default function Header({ showThemeToggle = true, children }) {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo" aria-hidden="true">
          <Code2 size={20} />
        </div>
        <div className="header-titles">
          <h1 className="header-title">Embedded SDK Playground</h1>
          <span className="header-caption">
            Test <code>@salla.sa/embedded-sdk</code> inside the Merchant
            Dashboard
          </span>
        </div>
        <Badge tone="primary" className="header-version">
          {SDK_VERSION}
        </Badge>
      </div>
      <div className="header-right">
        {children}
        {showThemeToggle && (
          <button
            id="theme-toggle"
            type="button"
            className="ui-icon-btn"
            title="Toggle Theme"
            aria-label="Toggle Theme"
            onClick={toggleTheme}
          >
            {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        )}
      </div>
    </header>
  );
}
