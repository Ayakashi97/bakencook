import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChefHat, Calendar, LogOut, User, Search, Menu, X } from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { ModeToggle } from './ModeToggle';
import { LanguageToggle } from './LanguageToggle';
import { useTranslation } from 'react-i18next';
import { useSystemSettings } from '../hooks/useSystemSettings';

import { Footer } from './Footer';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { appName, faviconUrl } = useSystemSettings();

  useEffect(() => {
    document.title = appName;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
    if (faviconUrl.startsWith('data:image/svg+xml')) {
      link.type = 'image/svg+xml';
    } else {
      link.type = 'image/x-icon';
    }
  }, [appName, faviconUrl]);

  const navItems = [
    { href: '/', label: t('nav.dashboard'), icon: ChefHat },
    { href: '/planer', label: t('nav.planer'), icon: Calendar },
    ...(user?.role === 'admin' ? [{ href: '/admin', label: t('nav.admin'), icon: User }] : []),
  ];

  return (
    <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
      <GlobalSearch />
      <nav className="sticky top-0 z-40 glass border-b print:hidden">
        <div className="flex h-16 items-center px-4 container max-w-7xl mx-auto justify-between">
          <div className="flex items-center">
            <Link to="/" className="mr-8 font-bold text-xl flex items-center gap-2 hover:opacity-80 transition-opacity">
              <ChefHat className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">{appName}</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4 lg:space-x-6 mx-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary flex items-center gap-2",
                    location.pathname === item.href
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop Search Trigger */}
          <div className="hidden md:flex flex-1 justify-center px-4">
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="flex items-center gap-2 w-full max-w-sm px-4 py-2 rounded-md border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors text-sm"
            >
              <Search className="w-4 h-4" />
              <span>{t('search.placeholder')}</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>

          {/* Desktop User Actions */}
          <div className="hidden md:flex ml-auto items-center space-x-4">
            <div className="flex items-center gap-4 border-l pl-4 ml-2">
              <LanguageToggle />
              <ModeToggle />
              {user ? (
                <>
                  <Link to="/profile" className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                    <User className="h-4 w-4" />
                    {user.username}
                  </Link>
                  <button
                    onClick={logout}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title={t('nav.logout')}
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <Link to="/login" className="text-sm font-medium hover:text-primary transition-colors">
                  {t('auth.login_btn') || "Login"}
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container py-4 px-4 space-y-4">
              <div className="flex flex-col space-y-3">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "text-sm font-medium transition-colors hover:text-primary flex items-center gap-2 py-2",
                      location.pathname === item.href
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </div>

              <div className="border-t pt-4 space-y-4">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 rounded-md border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors text-sm"
                >
                  <Search className="w-4 h-4" />
                  <span>{t('search.placeholder')}</span>
                </button>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <LanguageToggle />
                    <ModeToggle />
                  </div>
                  <div className="flex items-center gap-4">
                    {user ? (
                      <>
                        <Link
                          to="/profile"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                        >
                          <User className="h-4 w-4" />
                          {user.username}
                        </Link>
                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            logout();
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title={t('nav.logout')}
                        >
                          <LogOut className="h-5 w-5" />
                        </button>
                      </>
                    ) : (
                      <Link
                        to="/login"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="text-sm font-medium hover:text-primary transition-colors"
                      >
                        {t('auth.login_btn') || "Login"}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
      <main className="container max-w-7xl mx-auto py-8 px-4 md:px-6 flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
