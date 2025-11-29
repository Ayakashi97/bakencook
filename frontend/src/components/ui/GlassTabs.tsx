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
        <div className={cn("flex items-center justify-between bg-muted/50 rounded-lg p-1 w-full", className)}>
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
    );
}
