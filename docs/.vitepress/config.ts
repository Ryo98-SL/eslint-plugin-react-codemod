import { defineConfig, type DefaultTheme } from "vitepress";

const repo = "Ryo98-SL/eslint-plugin-react-codemod";

function createThemeConfig(isZh: boolean): DefaultTheme.Config {
  return {
    logo: "/logo.svg",
    nav: [],
    sidebar: isZh
      ? [
          {
            text: "指南",
            items: [
              { text: "快速开始", link: "/zh/guide/getting-started" },
              { text: "配置说明", link: "/zh/guide/configuration" },
              { text: "效果示例", link: "/zh/examples" },
            ],
          },
          {
            text: "Contribute",
            items: [
              { text: "开发配置", link: "/zh/guide/contribute" },
            ],
          },
        ]
      : [
          {
            text: "Guide",
            items: [
              { text: "Getting Started", link: "/guide/getting-started" },
              { text: "Configuration", link: "/guide/configuration" },
              { text: "Examples", link: "/examples" },
            ],
          },
          {
            text: "Contribute",
            items: [
              { text: "Development Setup", link: "/guide/contribute" },
            ],
          },
        ],
    socialLinks: [
      { icon: "github", link: `https://github.com/${repo}` },
    ],
    editLink: {
      pattern: `https://github.com/${repo}/edit/main/docs/:path`,
      text: isZh ? "在 GitHub 上编辑此页" : "Edit this page on GitHub",
    },
    footer: {
      message: isZh ? "基于 MIT License 发布。" : "Released under the MIT License.",
      copyright: "Copyright © Ryo98-SL",
    },
    search: {
      provider: "local",
    },
  };
}

export default defineConfig({
  title: "eslint-plugin-react-codemod",
  description: "React codemod docs powered by VitePress.",
  lang: "en-US",
  srcDir: ".",
  base: "/eslint-plugin-react-codemod/",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", href: "/logo.svg" }],
    [
      "style",
      {},
      `
        .VPNavBar .VPNavBarTranslations,
        .VPNavBar .VPNavBarAppearance,
        .VPNavBar .VPNavBarSocialLinks {
          display: flex !important;
          visibility: visible !important;
        }

        .VPNavBar .VPNavBarExtra {
          display: none !important;
        }

        .VPNavBar button[aria-label="extra navigation"] {
          display: none !important;
        }

        .VPNavBar .content-body {
          gap: 8px;
        }

        @media (max-width: 1280px) {
          .VPNavBar .VPNavBarSearch {
            display: none !important;
          }
        }
      `,
    ],
  ],
  themeConfig: createThemeConfig(false),
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      link: "/",
      themeConfig: createThemeConfig(false),
    },
    zh: {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh/",
      themeConfig: createThemeConfig(true),
    },
  },
});
