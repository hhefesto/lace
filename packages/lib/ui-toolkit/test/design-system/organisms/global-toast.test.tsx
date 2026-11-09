// GlobalToast owns the hide logic (timers), so it must hand its onHide to
// FloatingOverlay as onTouchThrough — that is what unblocks Android's frozen
// touch input on the first tap while the toast is visible.
import type { ElementType } from 'react';

import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { GlobalToast } from '../../../src/design-system/organisms/globalToast/globalToast';

import type { GlobalToastConfig } from '../../../src/design-system/organisms/globalToast/globalToast';
import type { ReactTestRenderer } from 'react-test-renderer';

// react-test-renderer accepts arbitrary host tags at runtime, but React's
// ElementType only admits intrinsic DOM tags — recast the mocked RN hosts.
const asHost = (type: string): ElementType => type as unknown as ElementType;

// Like i18next's t(), throw on a key that isn't a string (i18next fails with
// "t.indexOf is not a function").
vi.mock('@lace-contract/i18n', () => ({
  useTranslation: () => ({
    t: (key: unknown) => {
      if (typeof key !== 'string') {
        throw new TypeError('t.indexOf is not a function');
      }
      return key;
    },
  }),
}));

vi.mock('react-native-reanimated', () => ({
  default: { View: 'Animated.View' },
}));

// Same module id as globalToast's `../..` import; the real design-system index
// pulls in Platform-dependent code that cannot load under vitest's node
// environment.
vi.mock('../../../src/design-system', () => ({
  FloatingOverlay: 'FloatingOverlay',
  Icon: 'Icon',
  Toast: 'Toast',
  useTriggerToast: () => ({ animatedStyle: {}, showToast: vi.fn() }),
}));

describe('GlobalToast', () => {
  it('passes onHide to FloatingOverlay as onTouchThrough', () => {
    const onHide = vi.fn();
    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = create(
        <GlobalToast toast={{ text: 'copied' }} onHide={onHide} />,
      );
    });
    if (!renderer) throw new Error('GlobalToast did not render');

    const overlay = renderer.root.findByType(asHost('FloatingOverlay'));
    expect(overlay.props.onTouchThrough).toBe(onHide);
    expect(onHide).not.toHaveBeenCalled();

    act(() => {
      renderer?.unmount();
    });
  });

  // https://github.com/input-output-hk/lace/issues/2277: a toast persisted
  // with a non-string subtitle crashed every render, so the hide timer never
  // ran and the extension stayed on its loading screen.
  it('renders and then hides a rehydrated toast with a non-string subtitle', () => {
    vi.useFakeTimers();
    try {
      const onHide = vi.fn();
      const toast = {
        text: 'v2.swap.toast.build-failed.title',
        subtitle: [
          {
            type: 'value_error',
            loc: ['body', 'quantity'],
            msg: 'Value error, amount must be a positive number',
          },
        ],
        color: 'negative',
      } as unknown as GlobalToastConfig;

      let renderer: ReactTestRenderer | undefined;
      act(() => {
        renderer = create(<GlobalToast toast={toast} onHide={onHide} />);
      });
      if (!renderer) throw new Error('GlobalToast did not render');

      const shown = renderer.root.findByType(asHost('Toast'));
      expect(shown.props.text).toBe('v2.swap.toast.build-failed.title');
      expect(shown.props.subtitle).toBeUndefined();

      act(() => {
        vi.advanceTimersByTime(3 * 1000 + 600);
      });
      expect(onHide).toHaveBeenCalledTimes(1);

      act(() => {
        renderer?.unmount();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders nothing without a toast', () => {
    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = create(<GlobalToast toast={null} onHide={vi.fn()} />);
    });

    expect(renderer?.toJSON()).toBeNull();
  });
});
