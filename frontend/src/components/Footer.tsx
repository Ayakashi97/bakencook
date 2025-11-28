import { Heart } from 'lucide-react';

import { useSystemSettings } from '../hooks/useSystemSettings';

export function Footer() {
    const { appName } = useSystemSettings();

    return (
        <footer className="border-t bg-background/50 backdrop-blur-sm mt-auto py-6 print:hidden">
            <div className="container max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                    <span>Made with</span>
                    <Heart className="h-4 w-4 text-red-500 fill-red-500 animate-pulse" />
                    <span>by {appName}</span>
                </div>
                <div className="italic">
                    "Making the world a better place."
                </div>
                <div className="text-xs">
                    &copy; {new Date().getFullYear()} {appName}
                </div>
            </div>
        </footer>
    );
}
