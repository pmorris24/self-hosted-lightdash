import { useQuery } from '@tanstack/react-query';
import { useLightdashClient } from '@lightdash/query-sdk';
import { Badge } from '@/components/ui/badge';

export function AppHeader() {
    const lightdash = useLightdashClient();
    const { data: user } = useQuery({
        queryKey: ['lightdash-user'],
        queryFn: () => lightdash.auth.getUser(),
    });

    return (
        <header className="flex flex-wrap items-center justify-between gap-2">
            <div>
                <h1 className="text-xl font-semibold">AI inference usage</h1>
                <p className="text-sm text-muted-foreground">
                    Spend and token consumption by model
                </p>
            </div>
            {user && (
                <Badge variant="secondary">
                    {user.email}
                    {user.attributes.tenant
                        ? ` · ${user.attributes.tenant}`
                        : ''}
                </Badge>
            )}
        </header>
    );
}
