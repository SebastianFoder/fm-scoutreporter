import type { DetailedHTMLProps, HTMLAttributes } from "react";

/**
 * `<sf-hub>` is a custom element defined by https://sebastianfoder.com/badge.js
 * (Sebastian Foder's project-hub footer breadcrumb). It renders into a shadow
 * root, so React hydration never sees its contents.
 */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "sf-hub": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        /** Project id on sebastianfoder.com/projects. */
        project?: string;
      };
    }
  }
}
