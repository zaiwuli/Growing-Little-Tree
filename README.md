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

当前已实现核心试用流程；设计稿中的多家长独立账号、受限儿童设备配对、活动编辑、补签/请假、月度目标、自动备份恢复、Docker 镜像和完整审计尚未实现。周目标使用自然周（周一开始），家庭时区为 Asia/Shanghai。活动暂停保留已生成的当日任务。家长会话 30 分钟有效，服务重启需重新解锁。

## Docker 部署

仓库：https://github.com/zaiwuli/Growing-Little-Tree

本地构建并启动（首次启动为全新空数据库）：

```sh
docker compose up -d --build
```

默认访问 http://127.0.0.1:3000 。现有本机 Node 服务也使用 3000 端口，同时测试时可在 .env 设置 APP_PORT=3001。需要手机和平板通过局域网访问时，将 .env 中 BIND_ADDRESS 设置为 0.0.0.0。

数据保存在 Docker 命名卷 growth-data 中，与项目本机 data 目录隔离。更新镜像不会清空数据；不要使用 docker compose down -v，否则会删除数据卷。备份前停止应用并备份该命名卷。

GitHub Actions 在 main 分支推送或 v 开头的标签推送后运行测试，并构建 linux/amd64、linux/arm64 镜像：

```text
ghcr.io/zaiwuli/growing-little-tree:latest
```

首次发布成功后可使用：

```sh
docker compose pull
docker compose up -d --no-build
```

GHCR 包的可见性由仓库所有者在 GitHub Packages 中管理；私有包需要先 docker login ghcr.io。尚未成功发布前，请使用 --build 本地构建。

本地 data、backups、exports、.env 均被 Git 与 Docker 构建上下文排除。镜像只复制服务代码、package.json 和 public 静态资源，不包含家庭资料、密码、积分或本地测试数据库。tests 目录只包含使用临时数据库的自动化测试，不包含真实家庭数据。
