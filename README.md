# 展会打卡系统

## 目录结构
- server: Node.js 后端 + 后台管理页面 + SQLite
- miniapp: 微信小程序前端

## 后端启动
1. 进入 `server`
2. 安装依赖：`npm install`
3. 配置 `.env`
4. 启动：`npm run dev`

## 后台入口
浏览器访问：`http://localhost:3000/admin/`
后台二维码：`/api/admin/qr`

## 接口概览
- POST /api/admin/login
- POST /api/admin/logout
- GET /api/admin/summary
- GET /api/admin/exhibitions
- POST /api/admin/exhibitions
- POST /api/admin/exhibitions/:id/activate
- GET /api/admin/draw
- POST /api/admin/draw
- GET /api/admin/export

- GET /api/public/active
- POST /api/public/checkin
- GET /api/public/history?phone=xxx
- GET /api/public/my-checkins?phone=xxx
- POST /api/public/draw

## 部署提示
- Render/Railway 需要配置环境变量 `.env`
- `PUBLIC_BASE_URL` 用于小程序 API 基地址
