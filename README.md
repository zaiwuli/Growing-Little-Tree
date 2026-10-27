# 成长小树

本机运行的儿童习惯 WebUI，支持手机、平板和电脑浏览器。需要 Node.js 24 或以上，无需安装 npm 依赖。

```powershell
npm start
```

访问 http://127.0.0.1:3000 ，首次打开设置家庭名称、孩子昵称和家长密码。没有预设账号或测试数据。

家长解锁后可新增活动、设置重复星期和审核要求、设置每周目标、添加奖励、鼓励加分及添加孩子。儿童完成活动后自动记分或提交审核。兑换先冻结积分，家长批准后扣款，再标记兑现。成长记录显示近七天得分及积分流水。

数据库在 `data/growth.sqlite`，重启不丢失。完整备份请先停止服务，再复制整个 data 目录；恢复时停服替换 data 目录。界面的“导出数据”提供不含家长密码的 JSON 记录，当前不提供 JSON 导入。

默认只监听本机回环地址。需要同一 Wi-Fi 的手机和平板实际访问时：

```powershell
$env:HOST='0.0.0.0'
npm start
```

使用本机局域网 IP 和 3000 端口访问，按系统提示允许专用网络防火墙访问。当前是家庭共享访问模式：能访问该地址的人可查看孩子数据和提交完成；家长管理操作需要密码。适合受信任的本机/家庭网络测试，暂不应直接暴露公网。

```powershell
npm test
```

当前已实现核心试用流程；设计稿中的多家长独立账号、受限儿童设备配对、补签/请假、月度目标、自动备份恢复和完整审计尚未实现。周目标使用自然周（周一开始），家庭时区为 Asia/Shanghai。活动暂停保留已生成的当日任务。家长会话 30 分钟有效，服务重启需重新解锁。

## Docker 部署

仓库：https://github.com/zaiwuli/Growing-Little-Tree

启动（首次启动为全新空数据库，无需 .env）：

```sh
docker compose up -d
```

NAS 部署后访问 http://NAS的局域网IP:3000，手机和平板连接同一家庭网络即可使用。如 3000 已占用，将 compose.yaml 的端口改为 3001:3000。端口监听全部网络接口，请用于受信任的家庭网络。

时区通过 TZ: Asia/Shanghai 明确配置，应用任务日期和周目标也固定按北京时间计算。容器共享宿主机系统时钟，不独立运行 NTP；请在电脑或 NAS 上开启自动校时。时区配置只影响时间显示与解释，不负责修正宿主机时钟。

当前 Compose 为 NAS 配置：请先创建 /volume1/docker/growing-little-tree，数据库持久化到该目录。容器按此配置以 root（0:0）运行，以兼容当前 NAS 目录权限。更新镜像不会清空挂载目录；备份前停止应用，再复制该目录。此 NAS 路径与开发机 data 目录隔离。

GitHub Actions 在 main 分支推送或 v 开头的标签推送后运行测试，并构建 linux/amd64、linux/arm64 镜像：

```text
ghcr.io/zaiwuli/growing-little-tree:latest
```

首次发布成功后可使用：

```sh
docker compose pull
docker compose up -d
```

GHCR 包的可见性由仓库所有者在 GitHub Packages 中管理；私有包需要先 docker login ghcr.io。需要从源码自行构建时运行 docker build -t ghcr.io/zaiwuli/growing-little-tree:latest .，然后运行 docker compose up -d。

本地 data、backups、exports、.env 均被 Git 与 Docker 构建上下文排除。镜像只复制服务代码、package.json 和 public 静态资源，不包含家庭资料、密码、积分或本地测试数据库。tests 目录只包含使用临时数据库的自动化测试，不包含真实家庭数据。

## PWA 与应用图标

已提供网页标签 SVG/PNG 图标、WebUI 小树标识、192/512 像素 PWA 图标及 180 像素 Apple 主屏幕图标。安装清单采用独立窗口模式。

手机通过普通 HTTP 的 NAS 局域网地址可以使用 WebUI，但完整 PWA 安装和 Service Worker 需要 HTTPS（localhost 开发环境除外）。请在 NAS 反向代理中配置受设备信任的 HTTPS 证书，并保留原始 Host 请求头，然后通过该 HTTPS 地址安装。iPhone/iPad 使用 Safari 分享菜单中的“添加到主屏幕”，Android 使用浏览器的安装入口。

PWA 不缓存积分 API，也不离线提交打卡；无法连接 NAS 时显示离线提示。安装不会把服务器迁移到手机，NAS 仍需保持运行。
