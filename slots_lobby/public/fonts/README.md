# 大厅字体

- `nunito-variable.woff2`：本地 [Nunito](https://github.com/google/fonts/tree/main/ofl/nunito)，200–1000 字重，负责英文、印尼文和数字。许可证见 `OFL-Nunito.txt`。
- `huninn.woff2`：本地 [粉圓体 Huninn](https://github.com/google/fonts/tree/main/ofl/huninn)，400 字重，负责圆润繁体中文；重点文字允许浏览器合成粗体。许可证见 `OFL-Huninn.txt`。
- 两个文件均由官方 TTF 转换为 WOFF2，保留完整字符集。大厅正文与 Ant Design 通过 `--lobby-font` 共用，运行时无第三方字体请求。

## 缺字回退


`noto-sans-tc-lobby.woff2` 是 [Noto Sans TC](https://github.com/google/fonts/tree/main/ofl/notosanstc) 的可变字体子集，保留 400–900 字重，覆盖大厅翻译目录已有的常用字符、拉丁字母、数字和标点。动态内容中的未收录字符交由系统字体显示。原始许可证见 [OFL-NotoSansTC.txt](OFL-NotoSansTC.txt)。
