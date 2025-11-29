import { cn } from '../../lib/utils';

interface Tab {
    id: string;
    label: string;
    icon?: React.ElementType;
    onClick?: () => void;
}

interface GlassTabsProps {
    tabs: Tab[];
    activeTab: string;
    onChange: (id: string) => void;
    className?: string;
    children?: React.ReactNode;
}

export function GlassTabs({ tabs, activeTab, onChange, className, children }: GlassTabsProps) {
    return (
        <div className={cn("bg-muted/50 rounded-lg p-1 w-full", className)}>
            {/* Mobile View */}
            <div className="md:hidden flex items-center gap-2">
                <div className="relative flex-1">
                    <select
                        value={activeTab}
                        onChange={(e) => {
                            const newId = e.target.value;
                            onChange(newId);
                            const tab = tabs.find(t => t.id === newId);
                            tab?.onClick?.();
                        }}
                        className="w-full appearance-none bg-background border border-input rounded-md py-2 pl-3 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary h-9"
                    >
                        {tabs.map((tab) => (
                            <option key={tab.id} value={tab.id}>
                                {tab.label}
                            </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                        <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                        </svg>
                    </div>
                </div>
                {children && <div className="flex-shrink-0">{children}</div>}
            </div>

            {/* Desktop View */}
            <div className="hidden md:flex items-center justify-between">
                <div className="flex items-center overflow-x-auto no-scrollbar flex-1">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        const Icon = tab.icon;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    onChange(tab.id);
                                    tab.onClick?.();
                                }}
                                className={cn(
                                    "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap",
                                    isActive
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                )}
                            >
                                {Icon && <Icon className="w-4 h-4" />}
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
                {children && <div className="pl-2 flex-shrink-0">{children}</div>}
            </div>
        </div>
    );
}
