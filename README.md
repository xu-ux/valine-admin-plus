## 参考
>[LeanCloud JavaScript SDK](https://leancloud.github.io/javascript-sdk/docs/)

https://github.com/DesertsP/Valine-Admin

## 开发者文档
以下内容仅用于 LeanEngine 开发

首先确认本机已经安装 Node.js 运行环境和 [LeanCloud 命令行工具](https://leancloud.cn/docs/leanengine_cli.html#hash1349493379) ，然后执行下列指令：


安装依赖：
```shell script
npm install
```



登录并关联应用：
```shell script
lean login

lean switch
```


启动项目：

```shell script
lean up
```


之后你就可以在 localhost:3000 访问到你的应用了。

部署到预备环境（若无预备环境则直接部署到生产环境）：

```shell script
lean deploy
```
