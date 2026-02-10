import type { PropsWithChildren, ReactElement, ReactNode } from 'react';

import React, { Children, cloneElement, isValidElement } from 'react';

import { render } from '@testing-library/react';

function setFakeReactDispatcher<T>(action: () => T): T {
  if (!('__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE' in React)) {
    return action();
  }

  const secret = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

  if (!secret || typeof secret !== 'object' || !('H' in secret)) {
    return action();
  }

  const previousDispatcher = secret.H;

  try {
    secret.H = new Proxy(
      {},
      {
        get() {
          throw new Error('This is a client component');
        },
      }
    );
  } catch {
    return action();
  }

  const result = action();
  secret.H = previousDispatcher;
  return result;
}

async function evaluateServerComponent(node: ReactElement): Promise<ReactElement> {
  if (node && node.type?.constructor?.name === 'AsyncFunction') {
    const evaluatedNode: ReactElement = await (node.type as any)({ ...(node.props as Record<string, unknown>) });
    return evaluateServerComponent(evaluatedNode);
  }

  if (node && node.type?.constructor?.name === 'Function') {
    try {
      return setFakeReactDispatcher(() => {
        const evaluatedNode: ReactElement = (node.type as any)({ ...(node.props as Record<string, unknown>) });
        return evaluateServerComponent(evaluatedNode);
      });
    } catch {
      return node;
    }
  }

  return node;
}

async function evaluateServerComponentAndChildren(node: ReactElement) {
  const evaluatedNode = (await evaluateServerComponent(node)) as ReactElement<PropsWithChildren>;

  if (!evaluatedNode?.props.children) {
    return evaluatedNode;
  }

  const children = Children.toArray(evaluatedNode.props.children);

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];

    if (!isValidElement(child)) {
      continue;
    }

    children[i] = await evaluateServerComponentAndChildren(child);
  }

  return cloneElement(evaluatedNode, {}, ...children);
}

export async function renderServerComponent(nodeOrPromise: ReactNode | Promise<ReactNode>) {
  const node = await nodeOrPromise;

  if (isValidElement(node)) {
    const evaluatedNode = await evaluateServerComponentAndChildren(node);
    return render(evaluatedNode);
  }

  return render(node as unknown as ReactElement);
}
