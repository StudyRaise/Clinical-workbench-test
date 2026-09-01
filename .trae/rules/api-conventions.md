---
description: 涉及 NestJS BFF（apps/api）时生效的 API 设计规范
alwaysApply: false
globs:
  - "apps/api/**"
---

# BFF API 规范

- 全局前缀 `/api`，端口 3001，Swagger 挂 `/api/docs`
- 每个功能域一个 module（auth / tenancy / audit / knowledge / business / users / inference）
- 认证用 JWT（`auth/jwt.strategy.ts`），授权用 `@Roles()` 装饰器 + `RolesGuard`，五角色：admin / doctor / nurse / researcher / patient
- 多租户：不要手动拼 `facility_id`，依赖 tenancy 的 interceptor/guard 自动注入
- 业务转发到推理服务一律走 `business/` 或 `inference/` 模块封装，controller 不直接 fetch
- 新增写操作需在 controller 上加审计装饰器（`audit/audit.decorator.ts`）
- 公共页面（健康检查等）用 `@Public()` 装饰器豁免认证
