# TMDB 代理 (Cloudflare Workers 版)

本项目是一个基于 Cloudflare Workers 的 The Movie Database (TMDB) API 和图片代理。它允许你绕过 TMDB 的访问限制，并在中国大陆等地区更稳定地访问 TMDB 的服务。

## 功能

*   代理 TMDB API 请求 (v3 和 v4)。
*   代理 TMDB 图片请求。
*   自动为 API 请求添加 `language=zh-CN` 参数（如果 URL 中未指定）。
*   对 API 响应和图片分别使用不同的缓存策略，提高性能。
*   处理可能导致 Cloudflare Workers 1101 错误的 `Host` 请求头问题。
*   基本的错误处理，并尝试显示 TMDB 返回的错误信息。
*   支持通过 Cloudflare Workers 或 Pages 部署到 GitHub。

## 部署
  **Cloudflare Workers (推荐)**:

    *   在 Cloudflare Workers 中连接到你的 GitHub 仓库，并进行配置。
    *   配置 Workers 路由，使其能够处理你的自定义域名的请求。

## 致谢

[tmdb-proxy](https://github.com/imaliang/tmdb-proxy) 、Google Gemini

## 免责声明

本项目仅供学习和研究使用，请勿用于任何商业用途。使用本项目产生的任何风险由用户自行承担。
