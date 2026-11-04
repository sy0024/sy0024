# 红果 H5 · 短剧放映厅

一个可直接用浏览器打开的响应式 H5 页面，连接 [N3urda/hongguoTV](https://github.com/N3urda/hongguoTV) 的内容服务 API v1。支持首页推荐、关键词搜索、剧集详情、选集播放和本地收藏。页面使用该项目公开的 API 协议自行实现，没有复制其客户端源码。

## 本地预览

```sh
python3 -m http.server 8080
```

然后打开 `http://localhost:8080`，点「连接内容服务」，填入已运行的 hongguoTV bridge 地址，例如 `http://192.168.1.10:8787`。服务启动方法、网络访问和口令配置请参阅 [上游项目 README](https://github.com/N3urda/hongguoTV#readme)。

也可以把仓库根目录作为 GitHub Pages 发布源，在仓库 **Settings → Pages** 中启用后通过 Pages URL 预览；请注意 HTTPS 页面访问 HTTP bridge 会被浏览器拦截（Mixed Content）。

## 接口与限制

- 使用 `GET /health` 检查 `service: hongguotv` 与 `apiVersion: 1`。
- 使用 `/api/home`、`/api/search`、`/api/series/:id` 和 `/api/episodes/:id/play` 读取目录、详情及播放地址。
- API 文档指出上游 bridge 当前没有配置浏览器跨域白名单。因此，跨域部署时需在可信环境配置 CORS，或把页面与 API 部署在同一来源；浏览器端不能绕过 CORS。
- 配置访问口令时，请使用 HTTPS 或可信的家庭网络。口令存于当前浏览器的 localStorage；带口令播放会先缓冲视频响应，较大的视频会占用相应内存。无口令播放使用浏览器原生媒体流。
- 视频是否能播放取决于浏览器支持的媒体编码。接口或平台变化也可能导致内容不可用；页面会展示服务返回的错误，不用虚构剧目填充目录。

## 归属

本 H5 是非官方第三方界面，与红果官方无关联。内容接口及其实现归 [N3urda/hongguoTV](https://github.com/N3urda/hongguoTV) 项目；请遵守该项目及所用依赖的许可证和条款。
