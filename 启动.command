#!/bin/bash
# 双击这个文件，网站就会启动并自动打开浏览器。
# 想关掉网站，把弹出的黑色终端窗口关掉就行。

cd "$(dirname "$0")" || exit 1

# 找到 node（双击运行时环境变量比较少，所以多找几个常见位置）
NODE=""
for candidate in \
  "$(command -v node 2>/dev/null)" \
  /opt/homebrew/bin/node \
  /usr/local/bin/node \
  /usr/bin/node
do
  if [ -x "$candidate" ]; then NODE="$candidate"; break; fi
done

if [ -z "$NODE" ]; then
  echo ""
  echo "  ✗ 没找到 Node.js。"
  echo "    请先去 https://nodejs.org 下载安装（选 LTS 版本），装完再双击本文件。"
  echo ""
  read -r -p "  按回车键关闭..." _
  exit 1
fi

clear
"$NODE" server.js

echo ""
echo "  网站已停止。按回车关闭窗口。"
read -r _
