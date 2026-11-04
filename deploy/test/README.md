# 公网测试环境

仅用于独立测试：模拟充值和模拟提现，创建全新数据库，不导入本机玩家、资金或生产数据。

## 组成

- Nginx：大厅 `/`，AG1 `/games/ag1/`；大厅 `/api/`、机台 `/api/v1/` 同源反向代理。
- 两个 Go 进程，两个独立 PostgreSQL 18 容器和持久化卷。
- 除 80/443 外无容器宿主机端口映射，`/internal/` 在公网入口返回404。
- Docker `unless-stopped` 自动重启，日志轮转，数据备份脚本；备份仍需另存到服务器之外。
- 敏感参数只保存在服务器 `/opt/aislots-test/.env`，权限600；禁止提交或输出。

## 构建和打包

先构建大厅 `slots_lobby` 及 Cocos AG1 Web Mobile，均使用相对/同源 API，不携带本机环境变量。

```sh
python3 deploy/test/prepare.py --origin https://YOUR_ORIGIN --output /tmp/aislots-test-release
(cd lobby_service && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o /tmp/aislots-test-release/payload/bin/lobby ./app/apis/lobby/api)
(cd slots_service && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o /tmp/aislots-test-release/payload/bin/game ./cmd/slots-server)
```

`prepare.py` 只复制构建产物、业务配置与机台盘面库，自动替换游戏/邀请公网地址和容器内部服务地址；不复制数据库或密钥。
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
