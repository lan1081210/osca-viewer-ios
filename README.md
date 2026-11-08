# OSCA Viewer for iOS（PWA）

[English](README.en.md) · 中文

OSCA 云存储（S3 兼容）的手机端浏览器：连接任意 S3 endpoint，浏览、上传、下载、预览、重命名、删除、分享。

- **无需 App Store、无需 Xcode**：这是一个 PWA，用 Safari 打开后「添加到主屏幕」，图标和独立窗口体验与原生应用一致
- **无后端、无第三方依赖**：所有请求由浏览器直连 S3，凭据只存在本机 `localStorage`
- 签名实现：手写 AWS Signature V4（WebCrypto），与 macOS 版同源逻辑

## 为什么不是原生 App

构建 iOS 原生应用需要 Xcode（iOS SDK + 模拟器），本机只有 Command Line Tools，编译不出来。
这个网关的 CORS 是全开的（`access-control-allow-origin: *`），浏览器可以直接签名访问，因此 PWA 是当下唯一能立刻用上的形态，而且免签名、免审核、免开发者账号。

## 安装到 iPhone

1. Safari 打开：`https://lan1081210.github.io/osca-viewer-ios/`
2. 点分享按钮 → **添加到主屏幕**
3. 打开，点左上角齿轮填：Endpoint / Bucket / Access Key / Secret Key / Region

## 功能

| 功能 | 说明 |
|---|---|
| 浏览 | 目录层级、面包屑、按名字/大小/时间排序、当前目录筛选 |
| 上传 | 多选文件，单次 PUT；大文件直接走 body（网关实测 >100 MB 可传） |
| 下载 | 预签名 URL 交给系统下载器 |
| 预览 | 图片、视频、音频、PDF 内嵌；文本类内联显示 |
| 分享 | 生成 1 小时有效的预签名链接，复制到剪贴板 |
| 重命名 | 文件 copy+delete；文件夹递归处理 |
| 新建/删除 | 删除单对象或整个前缀（递归，需二次确认） |
| 长按 | 唤出操作菜单（iOS 上没有右键） |

## 安全

- 凭据存放在浏览器 `localStorage`，仅本机本站可见；退出登录＝在设置里清空并保存
- 所有请求 HTTPS 直连网关，不经过任何第三方服务器
- 分享链接是预签名 URL，**拿到链接的人就能下载**，到期自动失效；不要把它发给不该看的人
- 页面本身不写任何密钥，仓库可以公开

## 本地开发与验证

```bash
cd docs && python3 -m http.server 8080     # 打开 http://localhost:8080
node test/live.test.mjs                       # 用 rclone.conf 里的凭据跑一次真实读写
```

`test/live.test.mjs` 会：列根目录 → 预签名取一个对象 → PUT 探针 → 读回 → 删除。
它从 `~/.config/rclone/rclone.conf` 读凭据，不打印密钥，不留临时文件。

## 限制

- 不支持分片上传（单次 PUT 上限由网关决定；实测 100 MB 级正常）
- 不支持断点续传
- 无离线对象缓存：只缓存页面外壳，没网时打不开列表
- iOS 的 PWA 后台能力受限，长任务请保持前台

## 目录

```
docs/              # 静态站点（GitHub Pages 发布这个目录）
  index.html       # 界面与交互
  s3.js            # SigV4 签名 + S3 调用（页面与测试共用）
  sw.js            # 离线外壳缓存
  manifest.webmanifest
  icons/
test/live.test.mjs # 真实环境读写验证
```
