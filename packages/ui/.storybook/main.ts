import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: ["../{components,features}/**/*.mdx", "../{components,features}/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  // The website's public files (the .fmf views that guides link to).
  staticDirs: ["../../../apps/web/public"],
};

export default config;
