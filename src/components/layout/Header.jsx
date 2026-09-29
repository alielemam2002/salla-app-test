import { Sun, Moon, Store } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext.jsx";

/** `showThemeToggle` is off inside Salla, where the host owns the theme. */
export default function Header({ showThemeToggle = true, children }) {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo" aria-hidden="true">
          <Store size={20} />
        </div>
        <div className="header-titles">
          <h1 className="header-title">مدير المتجر</h1>
          <span className="header-caption">
            منتجاتك وكوبوناتك وحملاتك في مكان واحد
          </span>
        </div>
      </div>
      <div className="header-right">
        {children}
        {showThemeToggle && (
          <button
            id="theme-toggle"
            type="button"
            className="ui-icon-btn"
            title="تبديل المظهر"
            aria-label="تبديل المظهر"
            onClick={toggleTheme}
          >
            {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        )}
      </div>
    </header>
  );
}
