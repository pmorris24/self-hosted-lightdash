import { createElement, forwardRef } from 'react';
import { Portal as RadixPortal } from '@lightdash-packager/radix-portal';
import { getPortalRoot } from './scope';

// Replaces @radix-ui/react-portal in the library build (vite.lib.config.js) so
// Radix menus, dialogs, popovers and selects render inside the app's CSS scope.
export const Portal = forwardRef(function Portal(props, forwardedRef) {
    return createElement(RadixPortal, {
        ...props,
        container: props.container ?? getPortalRoot(),
        ref: forwardedRef,
    });
});

export const Root = Portal;
