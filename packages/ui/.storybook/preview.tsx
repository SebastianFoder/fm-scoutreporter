import type { Decorator, Preview } from "@storybook/nextjs-vite";
import { applyTheme, type ThemeKey } from "@scoutreporter/core/themes";
import { installFixtureFetchMock, withAppProviders } from "./providers";
import "../styles/globals.css";

installFixtureFetchMock();

const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme ?? "light") as ThemeKey;

  // Theme tokens live on <html>, so applying them before render is safe.
  applyTheme(theme);
  document.body.style.backgroundColor = "oklch(var(--background))";

  return <Story />;
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "App theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  // Theme is outermost so provider-wrapped stories render against the active tokens.
  decorators: [withAppProviders, withTheme],
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: "todo" },
  },
  tags: ["autodocs"],
};

export default preview;
