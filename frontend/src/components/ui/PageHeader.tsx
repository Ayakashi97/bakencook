import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';

interface PageHeaderProps {
    title: string;
    showBack?: boolean;
    backUrl?: string;
    actions?: React.ReactNode;
    className?: string;
}

export function PageHeader({ title, showBack, backUrl, actions, className = "" }: PageHeaderProps) {
    const navigate = useNavigate();

    const handleBack = () => {
        if (backUrl) navigate(backUrl);
        else navigate(-1);
    };

    return (
        <div className={`flex items-center justify-between mb-6 ${className}`}>
            <div className="flex items-center gap-4">
                {showBack && (
                    <Button variant="ghost" size="icon" onClick={handleBack} className="-ml-2">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                )}
                <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}
