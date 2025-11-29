import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Recipe } from '../lib/api';
import {
    format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, addMonths, addWeeks, subWeeks, subMonths,
    addDays, subDays, isSameMonth, isSameDay, isToday, startOfDay, endOfDay, addMinutes
} from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Search, Check, Pencil, Clock, Trash2, ChefHat, List, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Timeline, TimelineEvent } from '../components/Timeline';

interface Schedule {
    id: string;
    recipe_id?: string;
    title?: string;
    event_type: string;
    target_time: string;
    start_time: string;
    recurrence_rule?: string;
    recipe?: Recipe;
    real_temperature?: number;
}

type ViewMode = 'month' | 'week' | 'day';
type Tab = 'calendar' | 'list' | 'timeline';

export default function Planer() {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const locale = i18n.language.startsWith('de') ? de : enUS;

    // State
    const [view, setView] = useState<ViewMode>(() => {
        return (localStorage.getItem('planner_view') as ViewMode) || 'month';
    });
    const [activeTab, setActiveTab] = useState<Tab>('calendar');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showAddModal, setShowAddModal] = useState(false);

    // Persist view preference
    useEffect(() => {
        localStorage.setItem('planner_view', view);
    }, [view]);

    // Form State
    const [eventType, setEventType] = useState<'recipe' | 'custom'>('recipe');
    const [selectedRecipeId, setSelectedRecipeId] = useState('');
    const [customTitle, setCustomTitle] = useState('');
    const [targetTime, setTargetTime] = useState('');
    const [timeMode, setTimeMode] = useState<'start' | 'target'>('target');
    const [realTemperature, setRealTemperature] = useState<number>(20);
    const [showPastEvents, setShowPastEvents] = useState(false);

    // Recurrence State
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceInterval, setRecurrenceInterval] = useState(1);
    const [recurrenceUnit, setRecurrenceUnit] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
    const [recurrenceEndMode, setRecurrenceEndMode] = useState<'never' | 'count' | 'until'>('never');
    const [recurrenceCount, setRecurrenceCount] = useState(1);
    const [recurrenceUntil, setRecurrenceUntil] = useState('');

    // Editing State
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

    // Recipe Search State
    const [recipeSearch, setRecipeSearch] = useState('');
    const [isRecipeDropdownOpen, setIsRecipeDropdownOpen] = useState(false);

    // Queries
    const { data: recipes } = useQuery<Recipe[]>({
        queryKey: ['recipes'],
        queryFn: async () => {
            const res = await api.get('/recipes');
            return res.data.items || res.data;
        },
    });

    const { data: schedules, isLoading } = useQuery<Schedule[]>({
        queryKey: ['schedules', view, currentDate.toISOString(), activeTab, showPastEvents], // Refetch when view/date/tab changes
        queryFn: async () => {
            // Calculate range based on view
            let start = new Date();
            let end = new Date();

            if (view === 'month') {
                start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
                end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
            } else if (view === 'week') {
                start = startOfWeek(currentDate, { weekStartsOn: 1 });
                end = endOfWeek(currentDate, { weekStartsOn: 1 });

            } else if (activeTab === 'list') {
                start = showPastEvents ? subMonths(new Date(), 6) : new Date(); // Look back 6 months if enabled
                end = addMonths(new Date(), 6); // Look ahead 6 months
            } else if (activeTab === 'timeline') {
                start = new Date(); // Start from now
                end = addMonths(new Date(), 6); // Look ahead 6 months
            } else { // Day view
                start = startOfDay(currentDate);
                end = endOfDay(currentDate);
            }

            const res = await api.get('/schedules', {
                params: {
                    start_date: start.toISOString(),
                    end_date: end.toISOString()
                }
            });
            return res.data;
        },
    });

    // Process Schedules into Calendar Events
    interface CalendarEvent {
        id: string;
        title: string;
        start: Date;
        end: Date;
        type: 'baking' | 'active' | 'passive' | 'custom' | 'recipe';
        recipeId?: string;
        scheduleId: string;
        isStep?: boolean;
    }

    const getProcessedEvents = () => {
        if (!schedules) return [];

        const events: CalendarEvent[] = [];

        schedules.forEach(schedule => {
            // Parse base times
            const targetTime = parseISO(schedule.target_time);

            // ALWAYS show single block for recipes in the main calendar grid
            // regardless of view mode (month/week/day)
            events.push({
                id: schedule.id,
                title: schedule.recipe ? schedule.recipe.title : (schedule.title || 'Event'),
                start: subDays(targetTime, 0),
                end: targetTime,
                type: schedule.event_type === 'baking' ? 'recipe' : 'custom',
                recipeId: schedule.recipe_id,
                scheduleId: schedule.id,
                isStep: false
            });
        });

        return events;
    };

    const getTimelineEvents = () => {
        if (!schedules) return [];
        const events: TimelineEvent[] = [];

        // Filter schedules relevant to current view
        const relevantSchedules = schedules.filter(s => {
            const time = parseISO(s.target_time);
            if (view === 'day') {
                return isSameDay(time, currentDate);
            } else if (view === 'week') {
                const start = startOfWeek(currentDate, { weekStartsOn: 1 });
                const end = endOfWeek(currentDate, { weekStartsOn: 1 });
                return time >= start && time <= end;
            } else if (view === 'month') {
                return isSameMonth(time, currentDate);
            }
            return false;
        });

        // For Timeline tab, we want ALL future events, similar to List view
        // But if we are in Calendar tab (week/day view), we want specific events
        let schedulesToProcess = relevantSchedules;

        if (activeTab === 'timeline') {
            schedulesToProcess = schedules.filter(s => {
                const time = parseISO(s.target_time);
                return time >= new Date(); // Future only
            });
        }

        schedulesToProcess.forEach(schedule => {
            const targetTime = parseISO(schedule.target_time);

            if (schedule.event_type === 'custom' || !schedule.recipe) {
                // Add custom events to timeline too
                events.push({
                    id: schedule.id,
                    title: schedule.title || 'Event',
                    start: targetTime,
                    end: targetTime,
                    type: 'custom',
                    scheduleId: schedule.id,
                    isStep: false
                });
            } else {
                // Expand steps for Timeline
                let currentTime = targetTime;

                const sortedSteps = schedule.recipe.chapters
                    .sort((a, b) => a.order_index - b.order_index)
                    .flatMap(ch => ch.steps.sort((a, b) => a.order_index - b.order_index))
                    .reverse();

                sortedSteps.forEach((step, index) => {
                    let duration = step.duration_min;

                    // Apply Temperature Adjustment
                    if (step.type === 'passive') {
                        const refTemp = schedule.recipe?.reference_temperature || 20;
                        const realTemp = (schedule as any).real_temperature || refTemp;
                        const factor = Math.pow(0.5, (realTemp - refTemp) / 5);
                        duration = Math.round(step.duration_min * factor);
                    }

                    const durationMs = duration * 60 * 1000;
                    const startTime = new Date(currentTime.getTime() - durationMs);

                    events.push({
                        id: `${schedule.id}_step_${step.id || index}`,
                        title: step.description,
                        start: startTime,
                        end: currentTime,
                        type: step.type,
                        recipeId: schedule.recipe_id,
                        scheduleId: schedule.id,
                        isStep: true,
                        recipeTitle: schedule.recipe?.title
                    });

                    currentTime = startTime;
                });
            }
        });

        return events.sort((a, b) => a.start.getTime() - b.start.getTime());
    };

    const timelineEvents = getTimelineEvents();

    const processedEvents = getProcessedEvents();

    const getEventsForDay = (day: Date) => {
        return processedEvents.filter(event =>
            isSameDay(event.end, day) || // Check if event ends on this day (target time)
            (event.start <= endOfDay(day) && event.end >= startOfDay(day)) // Check overlap
        ).sort((a, b) => a.start.getTime() - b.start.getTime());
    };

    // Mutations
    const createScheduleMutation = useMutation({
        mutationFn: async () => {
            let rrule = null;
            if (isRecurring) {
                rrule = `FREQ=${recurrenceUnit}`;
                if (recurrenceInterval > 1) {
                    rrule += `;INTERVAL=${recurrenceInterval}`;
                }
                if (recurrenceEndMode === 'count') {
                    rrule += `;COUNT=${recurrenceCount}`;
                } else if (recurrenceEndMode === 'until' && recurrenceUntil) {
                    // RRULE UNTIL must be in UTC YYYYMMDDTHHMMSSZ format
                    const untilDate = new Date(recurrenceUntil);
                    untilDate.setHours(23, 59, 59, 999); // End of day
                    const untilStr = format(untilDate, "yyyyMMdd'T'HHmmss'Z'");
                    rrule += `;UNTIL=${untilStr}`;
                }
            }

            let finalTargetTime = targetTime + ":00Z";

            // If mode is 'start' and we have a recipe, calculate target time based on duration
            if (timeMode === 'start' && eventType === 'recipe' && selectedRecipeId) {
                const recipe = recipes?.find(r => r.id === selectedRecipeId);
                if (recipe) {
                    // Calculate total duration
                    const totalDuration = recipe.chapters.reduce((acc, chapter) => {
                        return acc + chapter.steps.reduce((sAcc, step) => sAcc + step.duration_min, 0);
                    }, 0);

                    const startDate = parseISO(targetTime);
                    const targetDate = addMinutes(startDate, totalDuration);
                    finalTargetTime = format(targetDate, "yyyy-MM-dd'T'HH:mm:00'Z'");
                }
            }

            const payload = {
                recipe_id: (eventType === 'recipe' && selectedRecipeId) ? selectedRecipeId : null,
                title: eventType === 'custom' ? customTitle : null,
                event_type: eventType === 'recipe' ? 'baking' : 'custom',
                target_time: finalTargetTime,
                start_time: finalTargetTime, // Backend might use this or target_time, but usually target_time is key for baking
                recurrence_rule: rrule,
                real_temperature: eventType === 'recipe' ? realTemperature : null
            };

            if (editingEventId) {
                const res = await api.put(`/schedules/${editingEventId}`, payload);
                return res.data;
            } else {
                const res = await api.post('/schedules', payload);
                return res.data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
            setShowAddModal(false);
            resetForm();
            toast.success(editingEventId ? t('edit.save_success') : t('edit.save_success'));
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Failed to save event');
        }
    });

    const deleteScheduleMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/schedules/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
            setShowAddModal(false);
            setShowDeleteModal(false);
            setDeletingEventId(null);
            resetForm();
            toast.success(t('admin.delete_success'));
        },
        onError: () => {
            toast.error(t('admin.delete_error'));
        }
    });

    const resetForm = () => {
        setEditingEventId(null);
        setEventType('recipe');
        setSelectedRecipeId('');
        setCustomTitle('');
        setTargetTime('');
        setTimeMode('target');
        setIsRecurring(false);
        setRecurrenceInterval(1);
        setRecurrenceUnit('DAILY');
        setRecurrenceEndMode('never');
        setRecurrenceCount(1);
        setRecurrenceUntil('');
        setRecipeSearch('');
        setIsRecipeDropdownOpen(false);
        setRealTemperature(20);
    };

    const handleAddEvent = (date?: Date) => {
        resetForm();
        if (date) {
            // Set default time to 08:00 on selected date
            const defaultTime = new Date(date);
            defaultTime.setHours(8, 0, 0, 0);
            // Format for datetime-local input: YYYY-MM-DDTHH:mm
            const iso = format(defaultTime, "yyyy-MM-dd'T'HH:mm");
            setTargetTime(iso);
        } else {
            setTargetTime(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
        }
        setShowAddModal(true);
    };

    // Validation Logic
    const isValid = targetTime &&
        ((eventType === 'recipe' && selectedRecipeId) || (eventType === 'custom' && customTitle));

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!showAddModal) return;

            if (e.key === 'Escape') {
                setShowAddModal(false);
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault(); // Prevent browser save
                if (isValid) {
                    createScheduleMutation.mutate();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showAddModal, isValid, createScheduleMutation]);

    // Navigation Logic
    const next = () => {
        if (view === 'month') setCurrentDate(addWeeks(currentDate, 3));
        else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
        else setCurrentDate(addDays(currentDate, 1));
    };

    const prev = () => {
        if (view === 'month') setCurrentDate(subWeeks(currentDate, 3));
        else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
        else setCurrentDate(subDays(currentDate, 1));
    };

    const today = () => setCurrentDate(new Date());

    // Calendar Grid Generation
    const days = view === 'month'
        ? eachDayOfInterval({
            start: startOfWeek(currentDate, { weekStartsOn: 1 }),
            end: endOfWeek(addWeeks(currentDate, 2), { weekStartsOn: 1 })
        })
        : view === 'week'
            ? eachDayOfInterval({
                start: startOfWeek(currentDate, { weekStartsOn: 1 }),
                end: endOfWeek(currentDate, { weekStartsOn: 1 })
            })
            : [currentDate];

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Helper to get events for a day


    return (
        <div className={cn(
            "space-y-6 pb-20 flex flex-col",
            activeTab === 'calendar' ? "h-[calc(100vh-140px)]" : "min-h-[calc(100vh-140px)]"
        )}>
            {/* Tabs & Actions */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-1 w-full">
                <div className="flex">
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                            activeTab === 'calendar' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <CalendarIcon className="w-4 h-4" />
                        {t('planer.tab_calendar') || 'Calendar'}
                    </button>
                    <button
                        onClick={() => setActiveTab('list')}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                            activeTab === 'list' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <List className="w-4 h-4" />
                        {t('planer.tab_list') || 'List'}
                    </button>
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                            activeTab === 'timeline' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Activity className="w-4 h-4" />
                        {t('planer.tab_timeline') || 'Timeline'}
                    </button>
                </div>

                <Button onClick={() => handleAddEvent()} size="sm" className="h-9 w-9 p-0 rounded-md shadow-sm" title={t('planer.add_event')}>
                    <Plus className="w-4 h-4" />
                </Button>
            </div>

            {/* Calendar Grid */}
            {activeTab === 'calendar' && (
                <div className="flex-1 glass-card rounded-xl overflow-hidden flex flex-col shadow-inner bg-white/30 dark:bg-black/20 relative">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-b border-white/10">
                        <div className="flex items-center gap-4">
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-primary" />
                                <span className="capitalize">
                                    {format(currentDate, view === 'day' ? 'PPPP' : 'MMMM yyyy', { locale })}
                                </span>
                            </h1>
                            <div className="flex items-center bg-muted/50 rounded-lg p-1 border">
                                <button onClick={prev} className="p-1 hover:bg-background rounded-md transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                                <button onClick={today} className="px-3 py-1 text-xs font-medium hover:bg-background rounded-md transition-colors">{t('common.today') || "Today"}</button>
                                <button onClick={next} className="p-1 hover:bg-background rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                        </div>

                        <div className="flex bg-muted/50 rounded-lg p-1 border">
                            {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
                                <button
                                    key={v}
                                    onClick={() => setView(v)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
                                        view === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {t(`planer.view_${v}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {isLoading && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    )}
                    {/* Weekday Headers */}
                    {view !== 'day' && (
                        <div className="grid grid-cols-7 border-b bg-muted/30">
                            {weekDays.map((day, i) => (
                                <div key={day} className="py-3 text-center text-sm font-semibold text-muted-foreground">
                                    {format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'EEE', { locale })}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Days Grid */}
                    <div className={cn(
                        "flex-1 grid overflow-y-auto",
                        view === 'month' ? "grid-cols-7 auto-rows-fr" : view === 'week' ? "grid-cols-7" : "grid-cols-1"
                    )}>
                        {days.map((day) => {
                            const events = getEventsForDay(day);
                            const isSelectedMonth = isSameMonth(day, currentDate);
                            const isCurrentDay = isToday(day);

                            return (
                                <div
                                    key={day.toISOString()}
                                    onClick={() => handleAddEvent(day)}
                                    className={cn(
                                        "min-h-[100px] border-r border-b p-2 transition-colors hover:bg-white/40 dark:hover:bg-white/5 cursor-pointer flex flex-col gap-1",
                                        !isSelectedMonth && view === 'month' && "bg-muted/20 text-muted-foreground opacity-50",
                                        isCurrentDay && "bg-primary/5"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={cn(
                                            "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all",
                                            isCurrentDay ? "bg-primary text-primary-foreground shadow-md scale-110" : "text-muted-foreground"
                                        )}>
                                            {format(day, 'd')}
                                        </span>
                                        {view === 'day' && (
                                            <span className="text-lg font-bold text-muted-foreground">
                                                {format(day, 'EEEE', { locale })}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                                        {events.slice(0, view === 'month' ? 3 : undefined).map(event => (
                                            <div
                                                key={event.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (event.recipeId) {
                                                        navigate(`/recipe/${event.recipeId}`);
                                                    }
                                                }}
                                                className={cn(
                                                    "text-xs px-2 py-1.5 rounded-md border shadow-sm truncate group transition-all hover:scale-[1.02] cursor-pointer relative pr-6 flex items-center gap-2",
                                                    // Styling based on type
                                                    event.type === 'baking' && "bg-orange-100/90 dark:bg-orange-900/40 text-orange-900 dark:text-orange-100 border-orange-200 dark:border-orange-800",
                                                    event.type === 'active' && "bg-green-100/90 dark:bg-green-900/40 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800",
                                                    event.type === 'passive' && "bg-slate-100/90 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
                                                    event.type === 'custom' && "bg-blue-100/90 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800",
                                                    event.type === 'recipe' && "bg-orange-100/90 dark:bg-orange-900/40 text-orange-900 dark:text-orange-100 border-orange-200 dark:border-orange-800"
                                                )}
                                                title={event.title}
                                            >
                                                <div className="flex items-center gap-1">
                                                    {/* Icons based on type */}
                                                    {event.type === 'baking' && <ChefHat className="w-3 h-3 shrink-0" />}
                                                    {event.type === 'active' && <ChefHat className="w-3 h-3 shrink-0" />}
                                                    {event.type === 'passive' && <Clock className="w-3 h-3 shrink-0" />}
                                                    {event.type === 'custom' && <Clock className="w-3 h-3 shrink-0" />}
                                                    {event.type === 'recipe' && <ChefHat className="w-3 h-3 shrink-0" />}

                                                    <span className="font-medium truncate">
                                                        {format(event.start, 'HH:mm')}
                                                        {view !== 'month' && ` - ${format(event.end, 'HH:mm')}`}
                                                    </span>
                                                </div>
                                                <div className="truncate font-semibold">
                                                    {event.title}
                                                </div>

                                                {/* Edit Icon - Only for main events (not steps) */}
                                                {!event.isStep && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // Populate form for editing
                                                            setEditingEventId(event.scheduleId);
                                                            // Find original schedule
                                                            const originalSchedule = schedules?.find(s => s.id === event.scheduleId);
                                                            if (!originalSchedule) return;

                                                            setEventType(originalSchedule.event_type === 'baking' ? 'recipe' : 'custom');
                                                            if (originalSchedule.recipe) {
                                                                setSelectedRecipeId(originalSchedule.recipe.id);
                                                                setRecipeSearch(originalSchedule.recipe.title);
                                                                // Set real temp from schedule or recipe default
                                                                setRealTemperature((originalSchedule as any).real_temperature || originalSchedule.recipe.reference_temperature || 20);
                                                            }
                                                            setCustomTitle(originalSchedule.title || '');
                                                            // Parse time (remove Z and seconds for datetime-local)
                                                            const timeStr = originalSchedule.target_time.substring(0, 16);
                                                            setTargetTime(timeStr);

                                                            // Parse Recurrence Rule
                                                            if (originalSchedule.recurrence_rule) {
                                                                setIsRecurring(true);
                                                                const parts = originalSchedule.recurrence_rule.split(';');
                                                                parts.forEach(part => {
                                                                    const [key, value] = part.split('=');
                                                                    if (key === 'FREQ') setRecurrenceUnit(value as any);
                                                                    if (key === 'INTERVAL') setRecurrenceInterval(parseInt(value));
                                                                    if (key === 'COUNT') {
                                                                        setRecurrenceEndMode('count');
                                                                        setRecurrenceCount(parseInt(value));
                                                                    }
                                                                    if (key === 'UNTIL') {
                                                                        setRecurrenceEndMode('until');
                                                                        // Parse YYYYMMDDTHHMMSSZ to YYYY-MM-DD
                                                                        const year = value.substring(0, 4);
                                                                        const month = value.substring(4, 6);
                                                                        const day = value.substring(6, 8);
                                                                        setRecurrenceUntil(`${year}-${month}-${day}`);
                                                                    }
                                                                });
                                                            } else {
                                                                setIsRecurring(false);
                                                                setRecurrenceEndMode('never');
                                                            }

                                                            setShowAddModal(true);
                                                        }}
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {view === 'month' && events.length > 3 && (
                                            <div
                                                className="text-xs text-muted-foreground font-medium pl-1 hover:text-primary transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCurrentDate(day);
                                                    setView('day');
                                                }}
                                            >
                                                + {events.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* List View */}
            {activeTab === 'list' && (
                <div className="flex-1 glass-card rounded-xl overflow-hidden flex flex-col shadow-inner bg-white/30 dark:bg-black/20 relative">
                    <div className="flex items-center justify-end p-2 border-b border-white/10">
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors">
                            <input
                                type="checkbox"
                                checked={showPastEvents}
                                onChange={(e) => setShowPastEvents(e.target.checked)}
                                className="rounded border-input bg-background/50 text-primary focus:ring-primary/20"
                            />
                            {t('planer.show_past') || "Show Past Events"}
                        </label>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {processedEvents
                            .filter(e => !e.isStep && (showPastEvents || e.start >= new Date())) // Filter based on toggle
                            .sort((a, b) => a.start.getTime() - b.start.getTime())
                            .map(event => (
                                <div
                                    key={event.id}
                                    className={cn(
                                        "flex items-center justify-between p-3 bg-white/50 dark:bg-black/20 rounded-lg border hover:border-primary/50 transition-colors",
                                        event.type === 'recipe' && "cursor-pointer hover:bg-white/60 dark:hover:bg-white/5"
                                    )}
                                    onClick={() => {
                                        if (event.type === 'recipe' && event.recipeId) {
                                            navigate(`/recipe/${event.recipeId}`);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-center justify-center w-12 h-12 bg-primary/10 rounded-lg text-primary">
                                            <span className="text-xs font-bold uppercase">{format(event.start, 'MMM')}</span>
                                            <span className="text-lg font-bold">{format(event.start, 'd')}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-medium">{event.title}</h3>
                                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Clock className="w-3 h-3" />
                                                {format(event.start, 'HH:mm')}
                                                {event.type === 'recipe' && (
                                                    <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] uppercase font-bold">
                                                        {t('planer.type_recipe')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingEventId(event.scheduleId);
                                                const original = schedules?.find(s => s.id === event.scheduleId);
                                                if (original) {
                                                    setEventType(original.event_type === 'baking' ? 'recipe' : 'custom');
                                                    setCustomTitle(original.title || '');
                                                    setSelectedRecipeId(original.recipe_id || '');
                                                    setTargetTime(format(parseISO(original.target_time), "yyyy-MM-dd'T'HH:mm"));
                                                    setIsRecurring(!!original.recurrence_rule);
                                                    setShowAddModal(true);
                                                }
                                            }}
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeletingEventId(event.scheduleId);
                                                setShowDeleteModal(true);
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        {processedEvents.filter(e => !e.isStep && e.start >= new Date()).length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                {t('planer.no_events')}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Timeline View */}
            {activeTab === 'timeline' && (
                <Timeline events={timelineEvents} />
            )}



            {/* Add Event Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-background border border-border w-full max-w-lg rounded-xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 space-y-6">
                            <div className="flex items-center justify-between border-b border-border pb-4">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    {editingEventId ? <Pencil className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                                    {editingEventId ? t('planer.edit_event') : t('planer.add_event')}
                                </h2>
                                <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                    <span className="sr-only">Close</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Type Selection */}
                                <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-lg">
                                    <button
                                        className={cn(
                                            "py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
                                            eventType === 'recipe' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                        )}
                                        onClick={() => setEventType('recipe')}
                                    >
                                        <ChefHat className="w-4 h-4" />
                                        {t('planer.type_recipe')}
                                    </button>
                                    <button
                                        className={cn(
                                            "py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
                                            eventType === 'custom' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                        )}
                                        onClick={() => setEventType('custom')}
                                    >
                                        <Clock className="w-4 h-4" />
                                        {t('planer.type_custom')}
                                    </button>
                                </div>

                                {eventType === 'recipe' ? (
                                    <div className="space-y-2 relative">
                                        <label className="text-sm font-medium text-muted-foreground">{t('planer.select_recipe')}</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                            <input
                                                className="w-full h-11 rounded-lg border border-input bg-background/50 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                                placeholder={t('planer.choose_recipe')}
                                                value={recipeSearch}
                                                onChange={(e) => {
                                                    setRecipeSearch(e.target.value);
                                                    setIsRecipeDropdownOpen(true);
                                                    if (!e.target.value) setSelectedRecipeId('');
                                                }}
                                                onFocus={() => setIsRecipeDropdownOpen(true)}
                                            />
                                            {selectedRecipeId && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedRecipeId('');
                                                        setRecipeSearch('');
                                                    }}
                                                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        {isRecipeDropdownOpen && (
                                            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                                {recipes?.filter(r => r.title.toLowerCase().includes(recipeSearch.toLowerCase())).length === 0 ? (
                                                    <div className="p-3 text-sm text-muted-foreground text-center">
                                                        No recipes found
                                                    </div>
                                                ) : (
                                                    recipes?.filter(r => r.title.toLowerCase().includes(recipeSearch.toLowerCase())).map((r) => (
                                                        <button
                                                            key={r.id}
                                                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between group"
                                                            onClick={() => {
                                                                setSelectedRecipeId(r.id);
                                                                setRecipeSearch(r.title);
                                                                setIsRecipeDropdownOpen(false);
                                                                // Set default real temp from recipe
                                                                setRealTemperature(r.reference_temperature || 20);
                                                            }}
                                                        >
                                                            <span className="font-medium">{r.title}</span>
                                                            {selectedRecipeId === r.id && <Check className="w-4 h-4 text-primary" />}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground">{t('planer.event_title')}</label>
                                        <input
                                            className="w-full h-11 rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                            value={customTitle}
                                            onChange={(e) => setCustomTitle(e.target.value)}
                                            placeholder="e.g. Feed Sourdough"
                                        />
                                    </div>
                                )}

                                {eventType === 'recipe' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground">{t('planer.real_temp') || "Real Temperature (°C)"}</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="w-full h-11 rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                                value={realTemperature}
                                                onChange={(e) => setRealTemperature(parseFloat(e.target.value) || 20)}
                                            />
                                            <span className="absolute right-3 top-3 text-sm text-muted-foreground">°C</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {t('planer.temp_adjustment_info') || "Passive steps will be adjusted based on the temperature difference."}
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-muted-foreground">
                                            {timeMode === 'target' ? t('planer.target_time_label') : t('planer.start_time_label')}
                                        </label>
                                        <div
                                            className="relative w-32 h-8 bg-muted/50 rounded-full cursor-pointer border border-input/50 p-1 flex items-center"
                                            onClick={() => setTimeMode(prev => prev === 'start' ? 'target' : 'start')}
                                        >
                                            {/* Sliding Thumb */}
                                            <div
                                                className={cn(
                                                    "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-background shadow-sm transition-all duration-300",
                                                    timeMode === 'start' ? "left-1" : "left-[calc(50%+2px)]"
                                                )}
                                            />

                                            {/* Labels */}
                                            <div className={cn(
                                                "flex-1 text-center text-xs font-medium z-10 transition-colors duration-300",
                                                timeMode === 'start' ? "text-foreground" : "text-muted-foreground"
                                            )}>
                                                {t('planer.start') || 'Start'}
                                            </div>
                                            <div className={cn(
                                                "flex-1 text-center text-xs font-medium z-10 transition-colors duration-300",
                                                timeMode === 'target' ? "text-foreground" : "text-muted-foreground"
                                            )}>
                                                {t('planer.target') || 'Target'}
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="datetime-local"
                                        className="w-full h-11 rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                        value={targetTime}
                                        onChange={(e) => setTargetTime(e.target.value)}
                                    />
                                </div>

                                {/* Flexible Recurrence UI */}
                                <div className="space-y-3 pt-2 border-t border-white/10">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-muted-foreground">
                                            {t('planer.recurrence')}
                                        </label>
                                        <div
                                            className={cn(
                                                "relative w-12 h-6 rounded-full cursor-pointer transition-colors duration-300",
                                                isRecurring ? "bg-orange-500" : "bg-muted"
                                            )}
                                            onClick={() => setIsRecurring(!isRecurring)}
                                        >
                                            <div
                                                className={cn(
                                                    "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300",
                                                    isRecurring ? "left-7" : "left-1"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {isRecurring && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-muted-foreground whitespace-nowrap">{t('planer.every')}</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="w-20 h-10 rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all text-center"
                                                    value={recurrenceInterval}
                                                    onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                                                />
                                                <select
                                                    className="flex-1 h-10 rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                                    value={recurrenceUnit}
                                                    onChange={(e) => setRecurrenceUnit(e.target.value as any)}
                                                >
                                                    <option value="DAILY">{t('planer.unit_days')}</option>
                                                    <option value="WEEKLY">{t('planer.unit_weeks')}</option>
                                                    <option value="MONTHLY">{t('planer.unit_months')}</option>
                                                </select>
                                            </div>

                                            {/* Recurrence End Options */}
                                            <div className="space-y-2 pt-2 border-t border-white/5">
                                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                    {t('planer.end_recurrence')}
                                                </label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <button
                                                        className={cn(
                                                            "px-2 py-1.5 text-xs rounded-md border transition-all",
                                                            recurrenceEndMode === 'never' ? "bg-primary text-primary-foreground border-primary" : "bg-background/50 border-input hover:bg-muted"
                                                        )}
                                                        onClick={() => setRecurrenceEndMode('never')}
                                                    >
                                                        {t('planer.end_never')}
                                                    </button>
                                                    <button
                                                        className={cn(
                                                            "px-2 py-1.5 text-xs rounded-md border transition-all",
                                                            recurrenceEndMode === 'count' ? "bg-primary text-primary-foreground border-primary" : "bg-background/50 border-input hover:bg-muted"
                                                        )}
                                                        onClick={() => setRecurrenceEndMode('count')}
                                                    >
                                                        {t('planer.occurrences')}
                                                    </button>
                                                    <button
                                                        className={cn(
                                                            "px-2 py-1.5 text-xs rounded-md border transition-all",
                                                            recurrenceEndMode === 'until' ? "bg-primary text-primary-foreground border-primary" : "bg-background/50 border-input hover:bg-muted"
                                                        )}
                                                        onClick={() => setRecurrenceEndMode('until')}
                                                    >
                                                        {t('planer.end_until')}
                                                    </button>
                                                </div>

                                                {recurrenceEndMode === 'count' && (
                                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                                        <span className="text-sm text-muted-foreground">{t('planer.end_count').replace('X', '')}</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            className="w-20 h-9 rounded-md border border-input bg-background/50 px-2 py-1 text-sm text-center"
                                                            value={recurrenceCount}
                                                            onChange={(e) => setRecurrenceCount(parseInt(e.target.value) || 1)}
                                                        />
                                                    </div>
                                                )}

                                                {recurrenceEndMode === 'until' && (
                                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                                        <span className="text-sm text-muted-foreground">{t('planer.end_until')}</span>
                                                        <input
                                                            type="date"
                                                            className="flex-1 h-9 rounded-md border border-input bg-background/50 px-2 py-1 text-sm"
                                                            value={recurrenceUntil}
                                                            onChange={(e) => setRecurrenceUntil(e.target.value)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                {editingEventId && (
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            setDeletingEventId(editingEventId);
                                            setShowDeleteModal(true);
                                        }}
                                        className="gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        {t('admin.delete')}
                                    </Button>
                                )}<Button variant="ghost" onClick={() => setShowAddModal(false)}>
                                    {t('common.cancel')}
                                </Button>
                                <Button onClick={() => createScheduleMutation.mutate()} disabled={!isValid || createScheduleMutation.isPending}>
                                    {createScheduleMutation.isPending ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            {t('planer.calculating')}
                                        </>
                                    ) : (
                                        t('common.save')
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-background border border-border w-full max-w-md rounded-xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 space-y-6 border-destructive/20">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                                <Trash2 className="w-6 h-6 text-destructive" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">{t('planer.delete_title')}</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t('planer.delete_message')}
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeletingEventId(null);
                                }}
                            >
                                {t('common.cancel') || 'Cancel'}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (deletingEventId) {
                                        deleteScheduleMutation.mutate(deletingEventId);
                                    }
                                }}
                            >
                                {t('admin.delete')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
