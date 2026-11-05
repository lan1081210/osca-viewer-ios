# 进度存档（2026-11-05 凌晨）

## 已完成

- **PWA 上线**：https://lan1081210.github.io/osca-viewer-ios/
  - 仓库 `lan1081210/osca-viewer-ios`（公开），Pages 走 GitHub Actions（`build_type=workflow`，产物目录 `docs/`）
  - 资源全部 200：`/`、`s3.js`、`manifest.webmanifest`、`icons/icon-180.png`、`sw.js`
- **S3 签名与读写已用真实凭据验证**（`node test/live.test.mjs`，凭据读 rclone.conf，不打印、不落盘）：
  - ListObjectsV2 200 / PUT / GET 回读一致 / DELETE / 预签名 GET 200（131461 字节）
- **功能**：浏览（面包屑、排序、筛选）、多选上传、下载、图片/视频/音频/PDF/文本内联预览、1 小时预签名分享、重命名（文件夹递归）、删除（递归 + 二次确认）、长按菜单
- **图标**：`docs/icons/icon.svg` → qlmanage 渲染出 512 / 180 PNG
- **离线外壳**：`sw.js` 只缓存静态资源，S3 请求直连

## 待办（下午继续）

1. **原生 iOS 版**（可选）：需要先装 Xcode（App Store，12–15 GB）。
   - 现状：`xcrun --sdk iphoneos --show-sdk-path` 报 SDK 找不到，`xcodebuild -showsdks` 为空
   - 装好后：复用 `~/Projects/osca-viewer/Sources/Core` 的 S3 客户端，写 SwiftUI 界面 → 模拟器实跑 → 免费个人签名装真机（7 天重签）
2. **首次真机验收**：在 iPhone 上「添加到主屏幕」，填连接信息，试浏览/上传/预览
3. **可选增强**：分片上传（大文件）、离线对象缓存、多 profile 切换

## 相关路径

- 本机工程：`~/Projects/osca-viewer-ios/`
- macOS 版（参考实现）：`~/Projects/osca-viewer/`
- 云存储技能：`~/.hermes/skills/osca-cloud-storage/`
- 网盘备份：`osca:22134-lan1081210/hermes/`

---

## 原生 iOS 版（已暂停，等中午处理）

**状态**：源码写完，卡在 Xcode 许可协议，无法编译。

- 工程：`~/Projects/osca-viewer-ios-native/`（XcodeGen 描述 + SwiftUI 源码）
- 已复用 macOS 版核心：`S3Client.swift`、`S3Signer.swift`（纯 Foundation + CryptoKit，跨平台）
- 界面：`OSCAViewerApp.swift`（AppState + Keychain）、`ConnectView`、`BrowserView`、`PreviewView`、`ShareSheet`
- 已实现：连接测试、目录浏览、搜索排序、多选上传（>32MB 走分片）、图片/视频/音频/文本预览、Quick Look、预签名分享、重命名（递归）、删除（递归）、新建文件夹

**唯一的阻塞**：

```
xcodebuild -showsdks → You have not agreed to the Xcode license agreements
sudo 需要密码 → 我无法代跑
```

**恢复步骤（按顺序）**：

1. `sudo xcodebuild -license accept`（若先显示协议，再敲一次 `agree`）
2. 我这边：`brew install xcodegen` → `xcodegen generate` → `xcodebuild -destination 'platform=iOS Simulator,name=iPhone 17' build`
3. 首次可能需要 `xcodebuild -downloadPlatform iOS`（约 7 GB）
4. 模拟器截图验证 → 免费个人签名装真机（7 天重签）
