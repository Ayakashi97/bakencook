import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Clock, ChefHat } from 'lucide-react';

export interface TimelineEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    type: 'baking' | 'active' | 'passive' | 'custom' | 'recipe';
    recipeId?: string;
    scheduleId: string;
    isStep?: boolean;
    recipeTitle?: string;
    color?: string; // For visual grouping
}

interface TimelineProps {
    events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps) {

    if (events.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground glass-card rounded-xl">
                <p>No tasks for this period</p>
            </div>
        );
    }

    // Group events by day for better structure if spanning multiple days
    // But for now, let's just show a continuous list as requested

    // We need to assign colors to recipes to visually group them
    const recipeColors = new Map<string, string>();
    const colors = [
        'border-orange-500 bg-orange-500',
        'border-blue-500 bg-blue-500',
        'border-green-500 bg-green-500',
        'border-purple-500 bg-purple-500',
        'border-pink-500 bg-pink-500',
        'border-yellow-500 bg-yellow-500',
    ];

    let colorIndex = 0;
    events.forEach(e => {
        if (e.scheduleId && !recipeColors.has(e.scheduleId)) {
            recipeColors.set(e.scheduleId, colors[colorIndex % colors.length]);
            colorIndex++;
        }
    });

    return (
        <div className="glass-card rounded-xl p-6 space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5 text-primary" />
                Timeline
            </h2>

            <div className="relative space-y-0 ml-4">
                {/* Continuous vertical line */}
                <div className="absolute left-[19px] top-2 bottom-4 w-0.5 bg-muted/50 -z-10" />

                {events.map((event, index) => {
                    const isLast = index === events.length - 1;
                    const colorClass = recipeColors.get(event.scheduleId) || 'border-primary bg-primary';
                    const borderColor = colorClass.split(' ')[0];
                    const bgColor = colorClass.split(' ')[1];

                    return (
                        <div key={event.id} className="relative pl-12 py-3 group">
                            {/* Dot on the timeline */}
                            <div className={cn(
                                "absolute left-[14px] top-5 w-3 h-3 rounded-full border-2 bg-background z-10 transition-all group-hover:scale-125",
                                borderColor
                            )} />

                            {/* Connector to next item if same recipe */}
                            {!isLast && events[index + 1].scheduleId === event.scheduleId && (
                                <div className={cn(
                                    "absolute left-[19px] top-8 bottom-[-12px] w-0.5 z-0 opacity-50",
                                    bgColor
                                )} />
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-white/40 dark:bg-black/20 p-3 rounded-lg border border-transparent hover:border-primary/20 transition-all">
                                {/* Time */}
                                <div className="min-w-[80px] font-mono text-sm font-medium text-muted-foreground">
                                    {format(event.start, 'HH:mm')}
                                </div>

                                {/* Content */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        {event.recipeTitle && (
                                            <span className="text-xs font-bold uppercase tracking-wider text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                                                {event.recipeTitle}
                                            </span>
                                        )}
                                        {event.type === 'baking' && <ChefHat className="w-3 h-3 text-orange-500" />}
                                    </div>
                                    <h3 className="font-medium text-foreground">{event.title}</h3>
                                    {event.type !== 'recipe' && event.type !== 'custom' && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Duration: {Math.round((event.end.getTime() - event.start.getTime()) / 60000)} min
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
