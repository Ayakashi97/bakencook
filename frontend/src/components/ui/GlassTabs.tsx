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
}

export function GlassTabs({ tabs, activeTab, onChange, className }: GlassTabsProps) {
    return (
        <div className={cn("flex items-center bg-muted/50 rounded-lg p-1 w-full overflow-x-auto no-scrollbar", className)}>
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
    );
}
