import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type FC, type PropsWithChildren } from 'react';
import { createQueryClient } from './createQueryClient';

type Props = {
    // Set by the SDK: scopes this client's requests to one embedded piece.
    embedInstanceId?: string;
};

const ReactQueryProvider: FC<PropsWithChildren<Props>> = ({
    children,
    embedInstanceId,
}) => {
    const [queryClient] = useState(() =>
        createQueryClient(undefined, embedInstanceId),
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {import.meta.env.DEV && REACT_QUERY_DEVTOOLS_ENABLED && (
                <ReactQueryDevtools initialIsOpen={false} />
            )}
        </QueryClientProvider>
    );
};

export default ReactQueryProvider;
