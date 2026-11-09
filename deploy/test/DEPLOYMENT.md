# 当前公网测试实例

- 测试网址： https://43.160.234.135/
- 腾讯云轻量实例：`lhins-hoyqxi2v`，新加坡，Ubuntu 24.04 x86_64，2核/4GB/60GB。
- 服务器目录：`/opt/aislots-test`。
- 两个独立数据库，全新数据；模拟充值、模拟提现开启，机台使用大厅钱包，禁止独立测试钱包回退。
- 仅Docker入口映射80/443。腾讯云新增的唯一规则：TCP443、全部IPv4地址、备注 `AISlots test HTTPS`；原22、80、ICMP规则保留。
- HTTPS为Let's Encrypt公网IP短期证书，已完成受信任校验与Certbot模拟续期。
- 定时任务：`/etc/cron.d/aislots-test`。服务器时区Asia/Shanghai，每日03:10数据库备份、每6小时15分检查证书续期。
- 首份备份位于服务器 `backups/`，仍需异机备份才能防范整机丢失。
- 当前HTTPS发布包：服务器 `release-https.tar.gz`，不含.env、证书私钥、数据库内容。
- SSH客户端私钥仅保存在当前工作电脑 `~/.ssh/aislots_tencent_test`，不要上传、打印或提交。服务器主机指纹：`SHA256:fuXSKjJAzfgAVQS5IC77Vy5pJpyc9+qHNMYBCvS3pSQ`。

验证记录（2026-11-04）：大厅HTTPS200，HTTP308跳转，AG1资源200；游客资料加载，机台入口票据兑换与初始盘面加载到START；邀请100宝箱、佣金及返水无网络异常；存款12档位成功加载。未执行充值、提现、领取或投注。

后续发布请先备份，并保留同一数据库卷。不要重新生成已有.env，不要执行 `docker compose down -v`。

更新（2026-11-06）：大厅、AG1服务和独立大厅后台已发布至现有HTTPS IP。大厅 `/`、后台 `/ops/`、游戏资源 `/games/ag1/`；后台API `/admin/api/`。后台容器无宿主机端口映射，使用Secure/HttpOnly Cookie和独立远程管理员。账号口令不沿用本地、未写入发布包或Git，保存在服务器root私密文件及操作者私有目录。

本次发布前完成两个数据库备份，保留上一版payload、compose、Nginx与服务镜像。数据库容器/卷未替换。检查通过：全部后端容器健康，HTTPS大厅/后台/游戏资源200，后台登录和只读概览/配置200，浏览器确认大厅资源展示；未执行充值、取款、领取或投注。域名尚未接入，等待域名模板/解析就绪后按testwww/testop/testgame配置。
