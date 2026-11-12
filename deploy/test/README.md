# 公网测试环境

仅用于独立测试：模拟充值和模拟提现，创建全新数据库，不导入本机玩家、资金或生产数据。

## 组成

- Nginx：大厅 `/`，AG1 `/games/ag1/`、AG2 `/games/ag2/`、AG3 `/games/ag3/`；大厅 `/api/`、机台 `/api/v1/` 同源反向代理。
- 大厅、后台和游戏三个 Go 进程，两个独立 PostgreSQL 18 容器和持久化卷。
- 除 80/443 外无容器宿主机端口映射，`/internal/` 在公网入口返回404。
- Docker `unless-stopped` 自动重启，日志轮转，数据备份脚本；备份仍需另存到服务器之外。
- 敏感参数只保存在服务器 `/opt/aislots-test/.env`，权限600；禁止提交或输出。

## 构建和打包

先构建大厅 `slots_lobby` 及 Cocos AG1/AG2/AG3 Web Mobile（启用 `md5Cache=true`，资源文件名随内容更新），均使用相对/同源 API，不携带本机环境变量。

```sh
(cd slots_lobby_admin && npm run build -- --base=/ops/)
python3 deploy/test/prepare.py --origin https://YOUR_ORIGIN --output /tmp/aislots-test-release
(cd lobby_service && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o /tmp/aislots-test-release/payload/bin/lobby ./app/apis/lobby/api)
(cd lobby_service && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o /tmp/aislots-test-release/payload/bin/admin ./app/apis/lobby/api/admin)
(cd slots_service && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o /tmp/aislots-test-release/payload/bin/game ./cmd/slots-server)
```

`prepare.py` 只复制构建产物、业务配置与机台盘面库，自动替换游戏/邀请公网地址和容器内部服务地址；不复制数据库或密钥。
已有环境迁移游戏目录时，还需将 `app/apis/lobby/api/tools/import-game-catalog` 交叉编译到 `payload/bin/import-game-catalog`。通过 SSH 脚本执行一次性容器命令时使用 `docker compose run --interactive=false`，避免读取后续脚本输入。切换后核对容器创建时间、健康状态与公网文件哈希，不能只依据脚本退出码判断完成。
依赖历史盘面配置和库仍一起保留，确保已创建局的版本可以解析。

上传新包到 `/opt/aislots-test`，首次在服务器创建随机数据库密码和服务令牌后执行：

```sh
sudo docker compose config --quiet
sudo docker compose up -d --build --wait --wait-timeout 180
sudo docker compose ps
```

升级前运行 `sudo ./backup.sh`，保留上一版本的包；不运行 `down -v`、不删除数据卷。迁移由服务启动执行，回滚前检查数据库迁移是否向后兼容。

## 运维

```sh
cd /opt/aislots-test
sudo docker compose ps
sudo docker compose logs --tail 100 lobby game
sudo ./backup.sh
```

HTTP公网IP不属于浏览器安全上下文，`crypto.randomUUID`、剪贴板等功能需要HTTPS。可以使用正式域名，也可以在用户接受证书订户协议后，为公网IP申请Let's Encrypt shortlived证书。IP证书有效期短，必须配置自动续期和Nginx reload；不使用自签名证书绕过浏览器警告。

签发后将 `nginx.conf` 改为443 TLS、80仅ACME挑战及跳转，并同步修改 `payload/lobby-etc/games.json`、`invite.json` 和 `payload/game-configs/server.test-cloud.json` 的公网 origin，再重建相关服务。

`renew-certificate.sh` 使用Certbot Docker镜像与持久化证书目录续期，检查并重载Nginx。建议每6小时运行；主机后台执行每日备份。

## 云防火墙

只需网页80/443和受限SSH22，数据库及服务内部端口不公开。如果主机本地健康检查通过而公网无法访问，检查云控制台实例防火墙入站规则。

## 后台测试入口

同一公网IP的 `/ops/` 为大厅运营后台，`/admin/api/` 仅代理独立后台容器。构建后台时使用 `npm run build -- --base=/ops/`；打包同时编译后台Linux二进制至`payload/bin/admin`。后台不映射宿主机端口，开启Secure Cookie，并只允许`PUBLIC_ORIGIN`（默认现有HTTPS IP）。

远程管理员通过独立初始化命令创建随机口令，不复制本地管理员、玩家数据或本地弱口令。私密登录资料单独保存在服务器和操作者私有目录，不写入发布包、Git或网页静态目录。域名解析可用后，再按用户确认的子域名配置独立站点。

## 游戏目录升级

发布包同时包含三款游戏客户端、独立配置和盘面库。升级已有环境时，保留服务器 `.env`、数据库卷及已发布运营参数；使用新编译的 `app/apis/lobby/api/tools/import-game-catalog` 工具补齐游戏目录，按草稿/发布记录生成审计。该工具默认仅检查，传 `-apply` 才发布，存在未发布草稿时拒绝覆盖。`payload/lobby-etc/games.json` 已由打包器写入公网入口和容器 API 地址，不使用本地地址迁移。

体验账号的启用状态、时间间隔及已发布权重沿用测试环境配置；新增停止参数缺省兼容旧策略。两个服务各自执行兼容迁移，历史游戏配置和盘面库一并保留。
